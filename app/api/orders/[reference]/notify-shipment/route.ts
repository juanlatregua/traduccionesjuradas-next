// app/api/orders/[reference]/notify-shipment/route.ts
// STAFF: registra el envío en papel (nº de seguimiento) y avisa al cliente por
// email con ese número. Reusa sendShipmentNotificationEmail (es/fr) y sendEmailWithRetry.
//
// TRÁMITE: si el pedido está agrupado (Order.caseRef), el sobre es UNO solo — se
// sellan de golpe todos los hermanos de papel sin enviar y sale UN email con
// todas las referencias. Antes había que meter el mismo tracking N veces y el
// cliente recibía N emails idénticos (caso Ana Suárez, 26_EB4037 + 26_349A82).
// TODO(2026-07): gatear el botón por deliveryType y valorar mover trackingNumber
// a ShippingData (es @@unique(orderId), 1:1 — no resuelve la agrupación).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendShipmentNotificationEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { getCaseMembers, selectShippableMembers } from "@/lib/order-case";

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
    select: { id: true, reference: true, clientEmail: true, clientLocale: true, caseRef: true, deliveryType: true, shippedAt: true, paymentStatus: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  // Del trámite solo entran en el sobre los de papel, sin sellar y COBRADOS: un
  // digital ya entregado no se anuncia por mensajería, un envío hecho no se
  // reescribe, y un hermano sin pagar no se le anuncia al cliente como enviado
  // (misma regla que /api/orders/[ref]/delivery: no se entrega sin cobrar).
  const members = await getCaseMembers(order.caseRef, order.id);
  const shippable = selectShippableMembers(members);
  // El pedido pulsado manda aunque su deliveryType diga otra cosa: hoy el botón
  // lo decide el staff y hay pedidos de papel nacidos como "pdf".
  const targets = shippable.some((m) => m.id === order.id)
    ? shippable
    : [{ id: order.id, reference: order.reference, deliveryType: order.deliveryType, shippedAt: order.shippedAt, paymentStatus: order.paymentStatus }, ...shippable];
  if (targets.length === 0) {
    return NextResponse.json({ ok: false, error: "No queda ningún pedido por enviar en este trámite." }, { status: 409 });
  }

  const now = new Date();
  const references = targets.map((t) => t.reference);
  const conRef = order.caseRef ? ` · trámite ${order.caseRef}` : "";
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { trackingNumber, shippedAt: now },
    }),
    prisma.orderEvent.createMany({
      data: targets.map((t) => ({
        orderId: t.id,
        type: "shipment.notified",
        message: `Envío notificado al cliente. Nº de seguimiento: ${trackingNumber}${courier ? ` (${courier})` : ""}${
          references.length > 1 ? ` · en el mismo sobre que ${references.filter((r) => r !== t.reference).join(", ")}` : ""
        }.`,
        payload: { trackingNumber, courier, actorEmail: access.email, caseRef: order.caseRef, references },
      })),
    }),
  ]);

  if (order.clientEmail) {
    const lang = order.clientLocale === "fr" ? "fr" : "es";
    sendEmailWithRetry(() =>
      sendShipmentNotificationEmail({
        toEmail: order.clientEmail,
        references,
        trackingNumber,
        courier,
        lang,
      })
    ).catch((e) => console.error(`[notify-shipment] client email failed${conRef}`, e));
  }

  return NextResponse.json({ ok: true, trackingNumber, references, caseRef: order.caseRef });
}
