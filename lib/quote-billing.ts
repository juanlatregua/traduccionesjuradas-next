// Datos de facturación que el cliente deja en /q ANTES de pagar. Sin schema nuevo:
// viven como un StripeEventLog (eventId único por presupuesto, payload JSON) y se
// copian a BillingData del pedido (NUNCA al Customer: un despacho/intermediario
// tiene la ficha del despacho y se mezclaría con los datos de su cliente) cuando nace el pedido
// (createOrderShellFromQuote es el único sitio que crea pedidos desde presupuesto).

import { prisma } from "@/lib/prisma";
import { saveBillingData } from "@/lib/orders";
import { BILLING_EVENT, COMPLETION_EVENT, EMPTY_BILLING, type BillingForm } from "@/lib/q-journey";

const billingEventId = (quoteId: string) => `q-billing:${quoteId}`;

export async function getSavedQuoteBilling(quoteId: string): Promise<BillingForm | null> {
  const row = await prisma.stripeEventLog.findUnique({ where: { eventId: billingEventId(quoteId) } });
  const p = row?.payload as Partial<BillingForm> | null | undefined;
  return p && typeof p === "object" ? { ...EMPTY_BILLING, ...p } : null;
}

export async function saveQuoteBilling(input: {
  quoteId: string;
  customerEmail: string;
  value: BillingForm;
  // Pedido ya existente sin BillingData: los datos van directos a él para no perderse.
  orderId?: string | null;
}): Promise<void> {
  await prisma.stripeEventLog.upsert({
    where: { eventId: billingEventId(input.quoteId) },
    create: { eventId: billingEventId(input.quoteId), eventType: BILLING_EVENT, quoteId: input.quoteId, payload: input.value },
    update: { payload: input.value, processedAt: new Date() },
  });
  if (input.orderId) await copyBillingToOrder(input.orderId, input.quoteId, input.customerEmail, input.value);
}

async function copyBillingToOrder(orderId: string, quoteId: string, customerEmail: string, value: BillingForm) {
  await saveBillingData(orderId, { ...value, email: customerEmail, requested: true });
  await prisma.orderEvent.create({
    data: {
      orderId,
      type: "billing.from_quote",
      message: `Datos de facturación indicados por el cliente en el presupuesto: ${value.fiscalName}${value.nif ? ` (${value.nif})` : " (sin NIF)"}.`,
    },
  });
}

/** Al nacer el pedido desde el presupuesto: pasa lo que el cliente indicó. Nunca bloquea el pedido. */
export async function applySavedBillingToNewOrder(orderId: string, quoteId: string, customerEmail: string) {
  try {
    const saved = await getSavedQuoteBilling(quoteId);
    if (saved && saved.fiscalName.trim()) await copyBillingToOrder(orderId, quoteId, customerEmail, saved);
  } catch (e) {
    console.error("[quote-billing] no se pudieron pasar los datos de facturación al pedido", e);
  }
}

/** Envíos «Falta algo» anteriores de este presupuesto, para los topes. */
export async function completionHistory(quoteId: string) {
  const rows = await prisma.stripeEventLog.findMany({
    where: { quoteId, eventType: COMPLETION_EVENT },
    select: { processedAt: true, payload: true },
  });
  return rows.map((r) => ({
    at: r.processedAt,
    fileCount: Array.isArray((r.payload as any)?.files) ? (r.payload as any).files.length : 0,
  }));
}

/** Estado del pedido y de la factura del presupuesto, para decidir si los datos fiscales siguen abiertos. */
export async function billingLockState(quoteId: string) {
  const order = await prisma.order.findFirst({
    where: { quoteId },
    select: {
      id: true,
      paidAt: true,
      billing: { select: { id: true } },
      clientInvoice: { select: { status: true, annulledAt: true } },
    },
  });
  const inv = order?.clientInvoice;
  return {
    orderId: order?.id ?? null,
    orderPaidAt: order?.paidAt ?? null,
    orderHasBilling: !!order?.billing,
    invoiceIssued: !!inv && inv.status === "ISSUED" && !inv.annulledAt,
  };
}
