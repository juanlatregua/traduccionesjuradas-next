// app/api/orders/[reference]/notify-shipment/route.ts
// STAFF: registra el envío en papel (nº de seguimiento) y avisa al cliente por
// email con ese número. Para pedidos con entrega en papel (lo decide el staff
// al pulsar). Reusa sendShipmentNotificationEmail (es/fr) y sendEmailWithRetry.
// TODO(2026-07): cuando se propague deliveryType del Quote al Order, gatear el
// botón por entrega en papel y valorar mover trackingNumber a ShippingData.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendShipmentNotificationEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { reference: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let body: { trackingNumber?: string; courier?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }
  const trackingNumber = String(body.trackingNumber || "").trim();
  const courier = String(body.courier || "").trim() || null;
  if (!trackingNumber) {
    return NextResponse.json({ ok: false, error: "Falta el número de seguimiento." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    select: { id: true, reference: true, clientEmail: true, clientLocale: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  const now = new Date();
  await prisma.order.update({
    where: { id: order.id },
    data: { trackingNumber, shippedAt: now },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "shipment.notified",
      message: `Envío notificado al cliente. Nº de seguimiento: ${trackingNumber}${courier ? ` (${courier})` : ""}.`,
      payload: { trackingNumber, courier, actorEmail: access.email },
    },
  });

  if (order.clientEmail) {
    const lang = order.clientLocale === "fr" ? "fr" : "es";
    sendEmailWithRetry(() =>
      sendShipmentNotificationEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        trackingNumber,
        courier,
        lang,
      })
    ).catch((e) => console.error("[notify-shipment] client email failed", e));
  }

  return NextResponse.json({ ok: true, trackingNumber });
}
