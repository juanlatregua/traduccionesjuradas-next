import { prisma } from "@/lib/prisma";

const DEFAULT_DOC_PRICE_CENTS = 4000;
const REGULARIZACION_2026_DOC_PRICE_CENTS = 2500;
const DEFAULT_VAT_RATE = 0.21;

export const PURPOSE_REGULARIZACION_2026 = "REGULARIZACION_2026";

export type SessionPricingSnapshot = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
};

function priceForPurpose(purpose: string | null | undefined): number {
  if (purpose === PURPOSE_REGULARIZACION_2026) {
    return REGULARIZACION_2026_DOC_PRICE_CENTS;
  }
  return DEFAULT_DOC_PRICE_CENTS;
}

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

function computeFromCount(docCount: number, perDocCents: number): SessionPricingSnapshot {
  return snapshotFromSubtotal(Math.max(0, docCount) * perDocCents);
}

export async function computeSessionPricing(sessionId: string): Promise<SessionPricingSnapshot> {
  const [session, docs] = await Promise.all([
    prisma.orderSession.findUnique({
      where: { id: sessionId },
      select: { purpose: true },
    }),
    prisma.orderDocument.findMany({
      where: { sessionId },
      select: { quotedCents: true },
    }),
  ]);

  // Sesiones de la puerta (v2): cada documento trae su precio del
  // pricing-engine. Si todos lo tienen, el subtotal es la suma.
  if (docs.length > 0 && docs.every((d) => d.quotedCents != null)) {
    return snapshotFromSubtotal(
      docs.reduce((sum, d) => sum + (d.quotedCents || 0), 0)
    );
  }

  // Funnel viejo /start: precio plano por documento.
  return computeFromCount(docs.length, priceForPurpose(session?.purpose));
}
