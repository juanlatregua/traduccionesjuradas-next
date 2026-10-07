import { prisma } from "@/lib/prisma";
import { PRIOR_STATUSES, pickPriorMatches, type PriorLine, type PriorPrice } from "@/lib/prior-prices-match";

export async function findPriorPrices(items: { source: string; target: string; label: string }[]) {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const pairs = new Map<string, { source: string; target: string }>();
  for (const it of items) pairs.set(`${it.source}>${it.target}`, { source: it.source, target: it.target });

  const byPair = new Map<string, PriorLine[]>();
  for (const [key, { source, target }] of Array.from(pairs)) {
    const rows = await prisma.quoteLine.findMany({
      where: {
        quote: {
          deletedAt: null,
          status: { in: [...PRIOR_STATUSES] },
          issuedAt: { gte: since },
          sourceLang: { equals: source, mode: "insensitive" },
          targetLang: { equals: target, mode: "insensitive" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 600,
      select: {
        description: true,
        unitPrice: true,
        supplierUnitCost: true,
        quote: { select: { quoteNumber: true, issuedAt: true, status: true, paidAt: true, translatorName: true } },
      },
    });
    byPair.set(
      key,
      rows.map((r) => ({
        description: r.description,
        unitPrice: Number(r.unitPrice),
        supplierUnitCost: r.supplierUnitCost == null ? null : Number(r.supplierUnitCost),
        quoteNumber: r.quote.quoteNumber,
        issuedAt: r.quote.issuedAt.toISOString(),
        issuedMs: r.quote.issuedAt.getTime(),
        status: r.quote.status,
        translatorName: r.quote.translatorName,
        paid: r.quote.status === "PAID" || r.quote.paidAt != null,
      }))
    );
  }

  const out: Record<string, PriorPrice[]> = {};
  for (const it of items) {
    out[`${it.source}>${it.target}|${it.label}`] = pickPriorMatches(byPair.get(`${it.source}>${it.target}`) || [], it.label);
  }
  return out;
}
