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

function computeFromCount(docCount: number, perDocCents: number): SessionPricingSnapshot {
  const subtotalCents = Math.max(0, docCount) * perDocCents;
  const vatCents = Math.round(subtotalCents * DEFAULT_VAT_RATE);
  const totalCents = subtotalCents + vatCents;
  return {
    subtotalCents,
    vatCents,
    totalCents,
    currency: "EUR",
  };
}

export async function computeSessionPricing(sessionId: string): Promise<SessionPricingSnapshot> {
  const [session, count] = await Promise.all([
    prisma.orderSession.findUnique({
      where: { id: sessionId },
      select: { purpose: true },
    }),
    prisma.orderDocument.count({ where: { sessionId } }),
  ]);
  return computeFromCount(count, priceForPurpose(session?.purpose));
}
