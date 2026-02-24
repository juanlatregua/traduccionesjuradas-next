import { prisma } from "@/lib/prisma";

const DEFAULT_DOC_PRICE_CENTS = 4000;
const DEFAULT_VAT_RATE = 0.21;

export type SessionPricingSnapshot = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
};

function computeFromDocCount(docCount: number): SessionPricingSnapshot {
  const subtotalCents = Math.max(0, docCount) * DEFAULT_DOC_PRICE_CENTS;
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
  const count = await prisma.orderDocument.count({
    where: { sessionId },
  });
  return computeFromDocCount(count);
}

