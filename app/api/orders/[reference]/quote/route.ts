import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getWorkflowState } from "@/lib/workflow";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { sendOrderCreatedEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type QuoteLineInput = {
  documentName?: string;
  amountCents?: number;
  notes?: string;
};

type Body = {
  lines?: QuoteLineInput[];
  sendToClient?: boolean;
  quotePreviewFileKey?: string | null;
  quotePreviewFileUrl?: string | null;
};

type NormalizedLine = {
  documentName: string;
  amountCents: number;
  notes: string | null;
};

const SEND_ALLOWED_STATES = new Set([
  "BORRADOR",
  "PENDIENTE_REVISION",
  "PRESUPUESTO_ENVIADO",
  "PENDIENTE_PAGO",
  "JUSTIFICANTE_SUBIDO",
]);

function normalizeLines(lines: QuoteLineInput[] | undefined) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false as const, error: "Debes añadir al menos una linea de coste." };
  }

  const normalized: NormalizedLine[] = [];

  for (const rawLine of lines) {
    const documentName = String(rawLine?.documentName || "").trim();
    const amountCentsRaw = Number(rawLine?.amountCents);
    const notes = String(rawLine?.notes || "").trim();

    if (!documentName) {
      return { ok: false as const, error: "Cada linea debe tener nombre de documento." };
    }

    if (!Number.isFinite(amountCentsRaw) || amountCentsRaw < 0) {
      return { ok: false as const, error: "Importe invalido en una de las lineas." };
    }

    normalized.push({
      documentName,
      amountCents: Math.round(amountCentsRaw),
      notes: notes || null,
    });
  }

  return { ok: true as const, lines: normalized };
}

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as Body;
    const parsed = normalizeLines(body.lines);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const lines = parsed.lines;
    const totalCents = lines.reduce((acc, line) => acc + line.amountCents, 0);
    if (totalCents < 100) {
      return NextResponse.json(
        { ok: false, error: "El total del presupuesto debe ser al menos 1 EUR." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        title: true,
        clientEmail: true,
        clientName: true,
        clientLocale: true,
        amountCents: true,
        paymentStatus: true,
        deliveryState: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            type: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    let workflowState = getWorkflowState(order);
    if (body.sendToClient && !SEND_ALLOWED_STATES.has(workflowState)) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se puede enviar presupuesto en estado ${workflowState}.`,
        },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: { reference: params.reference },
      data: {
        amountCents: totalCents,
        quoteSnapshotJson: {
          lines,
          totalCents,
          currency: "EUR",
          updatedAt: new Date().toISOString(),
          terms:
            "Presupuesto para traduccion jurada. Incluye revision y gestion administrativa segun encargo.",
        },
        quotePreviewFileKey: body.quotePreviewFileKey
          ? String(body.quotePreviewFileKey).trim()
          : undefined,
        quotePreviewFileUrl: body.quotePreviewFileUrl
          ? String(body.quotePreviewFileUrl).trim()
          : undefined,
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "quote.documents.updated",
        message: "Costes por documento actualizados para presupuesto final.",
        payload: {
          lines,
          totalCents,
          currency: "EUR",
          actorEmail,
          sendToClient: Boolean(body.sendToClient),
        },
      },
    });

    let emailWarning: string | null = null;

    if (body.sendToClient) {
      if (workflowState === "BORRADOR") {
        await transitionWorkflowState({
          reference: params.reference,
          to: "PENDIENTE_REVISION",
          actorEmail,
          reason: "Preparando envio de presupuesto final.",
        });
        workflowState = "PENDIENTE_REVISION";
      }

      if (workflowState === "PENDIENTE_REVISION") {
        await transitionWorkflowState({
          reference: params.reference,
          to: "PRESUPUESTO_ENVIADO",
          actorEmail,
          reason: "Presupuesto final enviado al cliente.",
        });
        workflowState = "PRESUPUESTO_ENVIADO";
      }

      if (workflowState === "PRESUPUESTO_ENVIADO") {
        await transitionWorkflowState({
          reference: params.reference,
          to: "PENDIENTE_PAGO",
          actorEmail,
          reason: "Presupuesto enviado, se habilita pago.",
        });
        workflowState = "PENDIENTE_PAGO";
      }

      if (!["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO"].includes(workflowState)) {
        return NextResponse.json(
          {
            ok: false,
            error: `No se puede enviar presupuesto en estado ${workflowState}.`,
          },
          { status: 400 }
        );
      }

      const { buildSignedOrderUrl } = await import("@/lib/order-token");
      const paymentUrl = buildSignedOrderUrl(order.reference, "pagar");

      try {
        const emailResult = await sendOrderCreatedEmail({
          toEmail: order.clientEmail,
          clientName: order.clientName || undefined,
          reference: order.reference,
          title: order.title,
          amountCents: totalCents,
          paymentUrl,
          lang: order.clientLocale === "fr" ? "fr" : "es",
        });
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "quote.sent_to_client",
            message: "Presupuesto final enviado al cliente con enlace de pago.",
            payload: {
              actorEmail,
              totalCents,
              lines,
              toEmail: order.clientEmail,
              subject: emailResult.subject,
              paymentUrl,
              sentAt: new Date().toISOString(),
              provider: "graph",
              providerMessageId: emailResult.messageId,
            },
          },
        });
        // SMS notification (fire & forget)
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const { smsPresupuestoListo } = await import("@/lib/sms-templates");
        const phone = await getOrderPhone(order.id).catch(() => null);
        if (phone) {
          sendNotification({
            to: formatPhoneSpain(phone),
            body: smsPresupuestoListo({
              ref: order.reference,
              precio: (totalCents / 100).toFixed(2),
              url: paymentUrl,
            }),
          }).catch((err) => console.error("[SMS]", err));
        }
      } catch (sendErr: any) {
        emailWarning = "Presupuesto guardado, pero fallo el email al cliente.";
        await prisma.orderEvent
          .create({
            data: {
              orderId: order.id,
              type: "quote.send_failed",
              message: "Fallo al enviar presupuesto final al cliente.",
              payload: {
                actorEmail,
                error: String(sendErr?.message || sendErr || "unknown"),
                totalCents,
                lines,
                toEmail: order.clientEmail,
                paymentUrl,
                failedAt: new Date().toISOString(),
              },
            },
          })
          .catch(() => undefined);
      }
    }

    return NextResponse.json({
      ok: true,
      totalCents,
      workflowState,
      sentToClient: Boolean(body.sendToClient),
      warning: emailWarning,
    });
  } catch (err: any) {
    console.error("[orders-quote] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo guardar el presupuesto." },
      { status: 500 }
    );
  }
}
