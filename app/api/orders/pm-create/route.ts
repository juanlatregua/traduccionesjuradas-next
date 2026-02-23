import { NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { sendOrderCreatedEmail } from "@/lib/email";

export const runtime = "nodejs";

type Body = {
  clientEmail?: string;
  clientName?: string;
  title?: string;
  langPair?: string;
  pagesLabel?: string;
  amountCents?: number;
  amountEur?: number;
  sourceChannel?: "whatsapp" | "email" | "web";
  urgencyNotes?: string;
  sendEmail?: boolean;
};

function normalizeChannel(raw?: string | null) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "whatsapp" || value === "wa") return "whatsapp" as const;
  if (value === "email") return "email" as const;
  return "web" as const;
}

function sanitizeLangPair(raw?: string | null) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return undefined;
  if (!/^[a-z]{2}-[a-z]{2}$/.test(value)) return undefined;
  return value;
}

function buildPaymentUrl(reference: string, channel: "whatsapp" | "email" | "web") {
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const url = new URL(`/area-cliente/pedido/${reference}/pagar`, baseUrl);
  if (channel === "whatsapp") {
    url.searchParams.set("src", "wa");
  } else if (channel === "email") {
    url.searchParams.set("src", "email");
  } else {
    url.searchParams.set("src", "web");
  }
  url.searchParams.set("agent", "pm");
  return url.toString();
}

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `orders:pm-create:${actorEmail}:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas altas en poco tiempo. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as Body;
    const clientEmail = String(body.clientEmail || "").trim().toLowerCase();
    const clientName = String(body.clientName || "").trim() || undefined;
    const title = String(body.title || "").trim();
    const langPair = sanitizeLangPair(body.langPair);
    const pagesLabel = String(body.pagesLabel || "").trim() || undefined;
    const channel = normalizeChannel(body.sourceChannel);
    const urgencyNotes = String(body.urgencyNotes || "").trim() || null;
    const sendEmail = body.sendEmail !== false;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ ok: false, error: "Email de cliente no valido." }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ ok: false, error: "Titulo requerido." }, { status: 400 });
    }

    const amountFromEur = Number(body.amountEur);
    const amountFromCents = Number(body.amountCents);
    const amountCents = Number.isFinite(amountFromCents)
      ? Math.round(amountFromCents)
      : Number.isFinite(amountFromEur)
        ? Math.round(amountFromEur * 100)
        : NaN;
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      return NextResponse.json(
        { ok: false, error: "Importe invalido. Debe ser minimo 1 EUR." },
        { status: 400 }
      );
    }

    const order = await createOrder({
      clientEmail,
      clientName,
      source: "file",
      title,
      langPair,
      pagesLabel,
      amountCents,
      currency: "eur",
    });

    const acquisitionSource = channel === "whatsapp" ? "WHATSAPP" : "WEB";
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.acquisition",
        message: `Origen de captacion: ${acquisitionSource}.`,
        payload: {
          source: acquisitionSource,
          sourceRaw: channel,
          actorEmail,
        },
      },
    });

    if (channel === "whatsapp") {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "wa.lead_received",
          message: "Lead registrado desde WhatsApp por PM en zona traductor.",
          payload: {
            actorEmail,
          },
        },
      });
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "workflow.state_changed",
        message: "Workflow inicial en BORRADOR (alta PM).",
        payload: {
          from: null,
          to: "BORRADOR",
          actorEmail,
          reason: "pm_manual_create",
        },
      },
    });

    await transitionWorkflowState({
      reference: order.reference,
      to: "PENDIENTE_PAGO",
      actorEmail,
      reason: "Alta manual PM con enlace directo a pago.",
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.pm_created",
        message: "Pedido creado manualmente por PM desde zona traductor.",
        payload: {
          actorEmail,
          channel,
          urgencyNotes,
        },
      },
    });

    if (urgencyNotes) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.urgency_notes",
          message: "Observaciones de urgencia registradas por PM.",
          payload: {
            actorEmail,
            notes: urgencyNotes,
          },
        },
      });
    }

    const paymentUrl = buildPaymentUrl(order.reference, channel);
    let emailWarning: string | null = null;
    if (sendEmail) {
      try {
        await sendOrderCreatedEmail({
          toEmail: clientEmail,
          clientName,
          reference: order.reference,
          title,
          amountCents,
          paymentUrl,
        });
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "order.payment_link_sent",
            message: "Enlace de pago enviado al cliente por PM.",
            payload: {
              actorEmail,
              paymentUrl,
            },
          },
        });
      } catch (err: any) {
        emailWarning = "Pedido creado, pero fallo el envio de email al cliente.";
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "order.payment_link_send_failed",
            message: "Fallo el envio del enlace de pago al cliente.",
            payload: {
              actorEmail,
              error: String(err?.message || err || "unknown"),
            },
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      order: {
        reference: order.reference,
        clientEmail,
      },
      paymentUrl,
      emailSent: sendEmail && !emailWarning,
      warning: emailWarning,
    });
  } catch (err: any) {
    console.error("[orders-pm-create] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo crear el pedido desde PM." },
      { status: 500 }
    );
  }
}
