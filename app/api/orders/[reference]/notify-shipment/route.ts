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

  let body: { trackingNumber?: string; courier?: string; trackingUrl?: string; proofUrl?: string; proofName?: string } = {};
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
  const trackingUrl = String(body.trackingUrl || "").trim() || null;
  if (trackingUrl && (!/^https?:\/\/[^\s"'<>]+$/i.test(trackingUrl) || trackingUrl.length > 500)) {
    return NextResponse.json({ ok: false, error: "El enlace de seguimiento debe empezar por https://." }, { status: 400 });
  }
  // Justificante: solo ficheros subidos a NUESTRO store por uploadStaffFile (shipments/<ref>/…).
  const proofUrl = String(body.proofUrl || "").trim() || null;
  if (proofUrl && !isOwnShipmentBlob(proofUrl, params.reference)) {
    return NextResponse.json({ ok: false, error: "Justificante no válido: vuelve a subir el fichero." }, { status: 400 });
  }
  const proofName = proofUrl ? String(body.proofName || "").trim().slice(0, 200) || "justificante" : null;

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    select: { id: true, reference: true, clientEmail: true, clientLocale: true, caseRef: true, deliveryType: true, shippedAt: true, paymentStatus: true, trackingNumber: true, shippingProofUrl: true, shippingProofName: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  // Del trámite solo entran en el sobre los de papel, sin sellar y COBRADOS: un
  // digital ya entregado no se anuncia por mensajería, un envío hecho no se
  // reescribe, y un hermano sin pagar no se le anuncia al cliente como enviado
  // (misma regla que /api/orders/[ref]/delivery: no se entrega sin cobrar).
  // CORREGIR un envío ya notificado: solo su sobre (mismo nº anterior), nunca
  // hermanos del trámite que aún no han salido, y sin tocar la fecha de envío.
  const isCorrection = !!order.shippedAt;
  let targets: { id: string; reference: string }[];
  if (isCorrection) {
    targets =
      order.caseRef && order.trackingNumber
        ? await prisma.order.findMany({
            where: { caseRef: order.caseRef, trackingNumber: order.trackingNumber, shippedAt: { not: null } },
            select: { id: true, reference: true },
          })
        : [{ id: order.id, reference: order.reference }];
    if (!targets.some((t) => t.id === order.id)) targets.unshift({ id: order.id, reference: order.reference });
  } else {
    const members = await getCaseMembers(order.caseRef, order.id);
    const shippable = selectShippableMembers(members);
    // El pedido pulsado manda aunque su deliveryType diga otra cosa: hoy el botón
    // lo decide el staff y hay pedidos de papel nacidos como "pdf".
    targets = shippable.some((m) => m.id === order.id) ? shippable : [{ id: order.id, reference: order.reference }, ...shippable];
  }
  if (targets.length === 0) {
    return NextResponse.json({ ok: false, error: "No queda ningún pedido por enviar en este trámite." }, { status: 409 });
  }

  const now = new Date();
  const references = targets.map((t) => t.reference);
  const finalProofUrl = proofUrl || order.shippingProofUrl || null;
  const finalProofName = proofUrl ? proofName : order.shippingProofName || null;
  const conRef = order.caseRef ? ` · trámite ${order.caseRef}` : "";
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      // Sin justificante nuevo se conserva el que hubiera. Transportista y enlace se
      // guardan tal cual llegan: el formulario los precarga para poder vaciarlos.
      data: {
        trackingNumber,
        ...(isCorrection ? {} : { shippedAt: now }),
        shippingCourier: courier,
        trackingUrl,
        ...(proofUrl ? { shippingProofUrl: proofUrl, shippingProofName: proofName } : {}),
      },
    }),
    prisma.orderEvent.createMany({
      data: targets.map((t) => ({
        orderId: t.id,
        type: isCorrection ? "shipment.updated" : "shipment.notified",
        message: `${isCorrection ? "Envío corregido y reenviado al cliente" : "Envío notificado al cliente"}. Nº de seguimiento: ${trackingNumber}${courier ? ` (${courier})` : ""}${
          references.length > 1 ? ` · en el mismo sobre que ${references.filter((r) => r !== t.reference).join(", ")}` : ""
        }.`,
        payload: { trackingNumber, courier, trackingUrl, proofUrl: finalProofUrl, proofName: finalProofName, correction: isCorrection, actorEmail: access.email, caseRef: order.caseRef, references },
      })),
    }),
  ]);

  if (order.clientEmail) {
    const lang = order.clientLocale === "fr" ? "fr" : "es";
    // Con await: en serverless el envío sin esperar puede morir al responder.
    await sendEmailWithRetry(() =>
      sendShipmentNotificationEmail({
        toEmail: order.clientEmail,
        references,
        trackingNumber,
        courier,
        trackingUrl,
        proofUrl: finalProofUrl,
        update: isCorrection,
        lang,
      })
    ).catch((e) => console.error(`[notify-shipment] client email failed${conRef}`, e));
  }

  return NextResponse.json({ ok: true, trackingNumber, references, caseRef: order.caseRef });
}

// Blob de NUESTRO store (el del BLOB_READ_WRITE_TOKEN) y bajo shipments/<ref>/: el
// sufijo .blob.vercel-storage.com solo no basta (es común a todas las cuentas).
function isOwnShipmentBlob(url: string, reference: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const store = (process.env.BLOB_READ_WRITE_TOKEN || "").match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1]?.toLowerCase();
  const hostOk = store ? u.hostname === `${store}.public.blob.vercel-storage.com` : u.hostname.endsWith(".public.blob.vercel-storage.com");
  return u.protocol === "https:" && hostOk && u.pathname.startsWith(`/shipments/${reference}/`);
}
