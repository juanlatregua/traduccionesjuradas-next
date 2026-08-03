import { prisma } from "@/lib/prisma";

const DEFAULT_DOC_PRICE_CENTS = 4000;
const DEFAULT_VAT_RATE = 0.21;

export const PURPOSE_REGULARIZACION_2026 = "REGULARIZACION_2026";

export type SessionPricingSnapshot = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
};

function snapshotFromSubtotal(subtotalCents: number): SessionPricingSnapshot {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const vatCents = Math.round(subtotal * DEFAULT_VAT_RATE);
  return {
    subtotalCents: subtotal,
    vatCents,
    totalCents: subtotal + vatCents,
    currency: "EUR",
  };
}

// Envío en papel: recargo fijo (sin IVA) que se suma al subtotal y luego tributa.
export const PAPER_SHIPPING_CENTS = 1200; // 12 €

export async function computeSessionPricing(sessionId: string): Promise<SessionPricingSnapshot> {
  const [docs, session] = await Promise.all([
    prisma.orderDocument.findMany({ where: { sessionId }, select: { quotedCents: true } }),
    prisma.orderSession.findUnique({ where: { id: sessionId }, select: { deliveryType: true } }),
  ]);

  const shippingCents = session?.deliveryType === "paper" ? PAPER_SHIPPING_CENTS : 0;

  // Sesiones de la puerta (v2): cada documento trae su precio del
  // pricing-engine, calculado por idioma (el 30 € de campaña solo se aplica
  // a documentos FR, en checkout/route.ts). Si todos lo tienen, el subtotal
  // es la suma + el envío en papel (si aplica).
  if (docs.length > 0 && docs.every((d) => d.quotedCents != null)) {
    return snapshotFromSubtotal(
      docs.reduce((sum, d) => sum + (d.quotedCents || 0), 0) + shippingCents
    );
  }

  // Fallback (funnel viejo /start, ya colapsado): precio plano por documento,
  // sin precio de campaña. El 30 € de regularización es ciego al idioma aquí,
  // así que no se aplica en este camino — solo en la puerta, que sí conoce el
  // idioma de cada documento.
  return snapshotFromSubtotal(docs.length * DEFAULT_DOC_PRICE_CENTS + shippingCents);
}
