// lib/shipping-request.ts — Pedido en papel lanzado sin dirección de envío.
// El pedido se lanza igual (no se frena por la dirección); al cliente se le pide
// por email + SMS con un enlace firmado. Primer aviso al lanzarse (hook en
// transitionWorkflowState → PAGO_VALIDADO) y recordatorios desde el cron
// /api/cron/justificantes cada 48 h, máx. 3 en total.
import { prisma } from "@/lib/prisma";

export const SHIPPING_MAX_REQUESTS = 3;
export const SHIPPING_REMINDER_MS = 48 * 60 * 60 * 1000;
const LAUNCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export async function requestShippingData(
  reference: string,
  opts?: { onlyFirst?: boolean }
): Promise<{ sent: boolean }> {
  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      deliveryType: true,
      clientEmail: true,
      clientName: true,
      shippedAt: true,
      shippingRequestCount: true,
      shippingRequestedAt: true,
      shipping: { select: { id: true } },
    },
  });
  if (!order || order.deliveryType !== "paper" || order.shipping || order.shippedAt) return { sent: false };
  if (order.shippingRequestCount >= SHIPPING_MAX_REQUESTS) return { sent: false };
  if (opts?.onlyFirst && order.shippingRequestCount > 0) return { sent: false };

  const claimed = await prisma.order.updateMany({
    where: { id: order.id, shippingRequestCount: order.shippingRequestCount },
    data: { shippingRequestCount: { increment: 1 }, shippingRequestedAt: new Date() },
  });
  if (claimed.count !== 1) return { sent: false };

  const n = order.shippingRequestCount + 1;
  await prisma.orderEvent
    .create({
      data: {
        orderId: order.id,
        type: "shipping.data_requested",
        message: `Dirección de envío pedida al cliente (aviso ${n} de ${SHIPPING_MAX_REQUESTS}).`,
        payload: { attempt: n },
      },
    })
    .catch((e) => console.error("[shipping-request] evento", e));

  const { buildSignedOrderUrl } = await import("@/lib/order-token");
  const url = buildSignedOrderUrl(reference, "envio");
  const { sendMail } = await import("@/lib/azure-mail");
  const { renderSimpleEmailHtml } = await import("@/lib/quote-messages");
  const body = `Hola${order.clientName ? ` ${order.clientName}` : ""},
Tu pedido ${reference} ya está en marcha. Como pediste la traducción jurada en papel, necesitamos la dirección donde enviártela.
Complétala aquí (un minuto): ${url}
Sin la dirección no podemos mandar el envío cuando la traducción esté lista.
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;
  const email = sendMail({
    to: order.clientEmail,
    subject: n > 1 ? `Recordatorio: falta la dirección de envío (pedido ${reference})` : `Dirección de envío para tu pedido ${reference}`,
    text: body,
    html: renderSimpleEmailHtml(body),
  }).catch((e) => console.error("[shipping-request] email", e));

  const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
  const sms = getOrderPhone(order.id)
    .then((phone) =>
      phone
        ? sendNotification({
            to: formatPhoneSpain(phone),
            body: `TraduccionesJuradas: tu pedido ${reference} va en papel y nos falta la dirección de envío. Complétala aquí: ${url}`,
          })
        : null
    )
    .catch((e) => console.error("[shipping-request] SMS", e));
  await Promise.allSettled([email, sms]);

  return { sent: true };
}

/** Recordatorios del cron: pedidos en papel lanzados, sin dirección, último aviso hace ≥48 h. */
export async function remindPendingShipping(now = new Date()): Promise<{ checked: number; sent: number }> {
  const candidates = await prisma.order.findMany({
    where: {
      deliveryType: "paper",
      shipping: { is: null },
      shippedAt: null,
      shippingRequestCount: { lt: SHIPPING_MAX_REQUESTS },
      AND: [
        {
          OR: [
            { paymentStatus: "PAID", paidAt: { gte: new Date(now.getTime() - LAUNCH_WINDOW_MS) } },
            { shippingRequestedAt: { not: null } },
          ],
        },
        {
          OR: [
            { shippingRequestedAt: null },
            { shippingRequestedAt: { lte: new Date(now.getTime() - SHIPPING_REMINDER_MS) } },
          ],
        },
      ],
    },
    select: { reference: true },
    take: 20,
  });
  let sent = 0;
  for (const c of candidates) {
    const r = await requestShippingData(c.reference).catch((e) => {
      console.error("[shipping-request] recordatorio", c.reference, e);
      return { sent: false };
    });
    if (r.sent) sent++;
  }
  return { checked: candidates.length, sent };
}
