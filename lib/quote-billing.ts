// Datos de facturación que el cliente deja en /q ANTES de pagar. Sin schema nuevo:
// viven como un StripeEventLog (eventId único por presupuesto, payload JSON) y se
// copian a BillingData y a la ficha del Customer cuando nace el pedido
// (createOrderShellFromQuote es el único sitio que crea pedidos desde presupuesto).

import { prisma } from "@/lib/prisma";
import { saveBillingData } from "@/lib/orders";
import { BILLING_EVENT, EMPTY_BILLING, isWhatsappPlaceholder, type BillingForm } from "@/lib/q-journey";

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
}): Promise<void> {
  await prisma.stripeEventLog.upsert({
    where: { eventId: billingEventId(input.quoteId) },
    create: { eventId: billingEventId(input.quoteId), eventType: BILLING_EVENT, quoteId: input.quoteId, payload: input.value },
    update: { payload: input.value, processedAt: new Date() },
  });
  // Si el pedido ya existe (p. ej. "Ya he transferido"), los datos van directos a él.
  const order = await prisma.order.findFirst({ where: { quoteId: input.quoteId }, select: { id: true } });
  if (order) await copyBillingToOrder(order.id, input.quoteId, input.customerEmail, input.value);
}

async function copyBillingToOrder(orderId: string, quoteId: string, customerEmail: string, value: BillingForm) {
  await saveBillingData(orderId, { ...value, email: customerEmail, requested: true });
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { customerId: true } });
  if (quote && !isWhatsappPlaceholder(customerEmail)) await fillCustomerBlanks(quote.customerId, value);
  await prisma.orderEvent.create({
    data: {
      orderId,
      type: "billing.from_quote",
      message: `Datos de facturación indicados por el cliente en el presupuesto: ${value.fiscalName}${value.nif ? ` (${value.nif})` : " (sin NIF)"}.`,
    },
  });
}

// La ficha del Customer la cura el staff (B2B, crédito…): solo se rellenan huecos.
async function fillCustomerBlanks(customerId: string, v: BillingForm) {
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) return;
  const data: Record<string, string> = {};
  if (!c.fiscalName?.trim() && v.fiscalName) data.fiscalName = v.fiscalName;
  if (!c.nif?.trim() && v.nif) data.nif = v.nif;
  if (!c.address?.trim() && v.address) data.address = v.address;
  if (!c.city?.trim() && v.city) data.city = v.city;
  if (!c.postalCode?.trim() && v.postalCode) data.postalCode = v.postalCode;
  if (Object.keys(data).length) await prisma.customer.update({ where: { id: customerId }, data });
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
