// lib/order-case.ts — TRÁMITE (Order.caseRef): agrupa N pedidos del mismo cliente
// que para él son UN solo encargo. Nace del caso real de Ana Suárez: fue añadiendo
// documentos y cada uno se convirtió en pedido propio, así que dos pedidos de papel
// con el mismo vencimiento eran físicamente el mismo sobre y el sistema no lo sabía.
//
// Lo que el trámite SÍ manda: el envío en papel (un tracking, un email), la vista
// del cliente y el rollup de coste (solo lectura).
// Lo que el trámite NO toca, a propósito:
//   · Cobro y factura → 1 pedido = 1 factura. Agrupar aquí reabriría cierres.
//   · getFinanceSnapshot / el freno de margen → es POR PEDIDO. Sumar el margen del
//     grupo escondería un pedido en pérdidas detrás de un hermano rentable y el
//     freno de "nunca puedo perder" (33d282e) dejaría de saltar.
//   · Los hitos al cliente (notifyClientMilestone) → siguen por pedido; su
//     idempotencia es por pedido y el grupo emitiría avisos contradictorios.

import { prisma } from "@/lib/prisma";

export { createCaseRef, selectShippableMembers, type ShippableMember } from "@/lib/order-case-logic";

/** Pedidos del trámite, en orden de creación. Sin caseRef → solo el pedido dado. */
export async function getCaseMembers(caseRef: string | null, fallbackOrderId: string) {
  if (!caseRef) {
    const one = await prisma.order.findUnique({
      where: { id: fallbackOrderId },
      select: { id: true, reference: true, deliveryType: true, shippedAt: true, paymentStatus: true, clientEmail: true, clientLocale: true },
    });
    return one ? [one] : [];
  }
  return prisma.order.findMany({
    where: { caseRef },
    select: { id: true, reference: true, deliveryType: true, shippedAt: true, paymentStatus: true, clientEmail: true, clientLocale: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Coste devengado de todo el trámite (solo lectura: no alimenta ningún freno). */
export async function getCaseAccrualRollup(caseRef: string) {
  const orders = await prisma.order.findMany({ where: { caseRef }, select: { reference: true } });
  if (orders.length === 0) return { orders: 0, accrualCents: 0, lines: [] as { orderReference: string | null; supplier: string | null; baseCents: number }[] };
  const refs = orders.map((o) => o.reference);
  const accruals = await prisma.expense.findMany({
    where: { orderReference: { in: refs }, isAccrual: true },
    select: { orderReference: true, supplier: true, baseCents: true },
  });
  return {
    orders: orders.length,
    accrualCents: accruals.reduce((a, e) => a + e.baseCents, 0),
    lines: accruals,
  };
}
