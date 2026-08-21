import { prisma } from "@/lib/prisma";

// Regla de Juan (21-ago-2026, literal: "si es por Bizum que no haya factura"):
// un pedido cobrado por BIZUM queda EXCLUIDO de facturación en el momento del
// cobro — no aparece en "Pedidos cobrados sin factura" ni se le emite factura
// desde la ficha. Reversible desde la ficha (billing-exclude excluded:false).
export const BIZUM_NO_INVOICE_REASON = "Bizum — sin factura (regla 21-ago-2026)";

export async function excludeFromBillingIfBizum(orderId: string, method: string | null | undefined) {
  if (String(method || "").toUpperCase() !== "BIZUM") return false;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { billingExcluded: true, clientInvoice: { select: { status: true } } },
  });
  if (!order || order.billingExcluded) return false;
  // Si ya hay factura EMITIDA no se toca (la exclusión es para que no se emita).
  if (order.clientInvoice && order.clientInvoice.status === "ISSUED") return false;
  await prisma.order.update({
    where: { id: orderId },
    data: { billingExcluded: true, billingExcludedReason: BIZUM_NO_INVOICE_REASON },
  });
  await prisma.orderEvent
    .create({
      data: {
        orderId,
        type: "billing.excluded",
        message: `Excluido de facturación: ${BIZUM_NO_INVOICE_REASON}`,
        payload: { reason: BIZUM_NO_INVOICE_REASON, auto: true, method: "BIZUM" },
      },
    })
    .catch((e) => console.error("[billing-exclusion] event", e));
  return true;
}
