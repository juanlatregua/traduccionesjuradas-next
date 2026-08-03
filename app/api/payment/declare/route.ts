// app/api/payment/declare/route.ts — botón "Ya he pagado" (Bizum/transferencia)
// del checkout del funnel. Crea el Order desde la sesión (idempotente por
// referencia) SIN marcar pago —solo la pasarela o el staff confirman— y devuelve
// la URL firmada de la pantalla de pago del pedido para subir el justificante.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdFromRequest } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createOrderFromSession } from "@/lib/orders";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { sendNewOrderStaffEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `payment-declare:${sessionId}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { method?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }
  const method = String(body?.method || "").toUpperCase() === "BIZUM" ? "BIZUM" : "TRANSFER";

  try {
    const session = await prisma.orderSession.findUnique({
      where: { id: sessionId },
      include: { docs: true },
    });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 404 });
    }
    if (session.step !== "CHECKOUT") {
      return NextResponse.json(
        { ok: false, error: "La sesion no esta en paso de checkout." },
        { status: 400 }
      );
    }
    if (!session.totalCents || session.totalCents <= 0) {
      return NextResponse.json({ ok: false, error: "La sesion no tiene importe." }, { status: 400 });
    }
    const clientEmail = (session.clientEmail || session.userId || "").trim().toLowerCase();
    if (!clientEmail) {
      return NextResponse.json(
        { ok: false, error: "Falta tu email para crear el pedido: vuelve al paso anterior." },
        { status: 400 }
      );
    }

    const order = await createOrderFromSession({
      session,
      docs: session.docs,
      clientEmail,
      clientPhone: session.clientPhone,
    });

    await prisma.orderSession.update({
      where: { id: session.id },
      data: { paymentMethod: method.toLowerCase() },
    });

    // Idempotente: reintentos del botón no duplican evento ni email a staff.
    const alreadyDeclared = await prisma.orderEvent.findFirst({
      where: { orderId: order.id, type: "payment.declared" },
      select: { id: true },
    });
    if (!alreadyDeclared) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "payment.declared",
          message: `El cliente declara haber pagado por ${method}. Pendiente de justificante/confirmacion.`,
          payload: { method, sessionId: session.id },
        },
      });
      sendNewOrderStaffEmail({
        reference: order.reference,
        title: `${order.title} — pago declarado por ${method}, pendiente de confirmar`,
        amountCents: order.amountCents,
        clientEmail,
        langPair: order.langPair || undefined,
      }).catch((err) => console.error("[payment-declare] staff email failed", err));
    }

    return NextResponse.json({
      ok: true,
      reference: order.reference,
      payUrl: buildSignedOrderUrl(order.reference, "pagar"),
    });
  } catch (err) {
    console.error("[payment-declare] error", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo registrar el aviso de pago." },
      { status: 500 }
    );
  }
}
