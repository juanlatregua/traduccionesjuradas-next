import { prisma } from "@/lib/prisma";
import { emailKey } from "@/lib/client-identity";
import { PRIOR_STATUSES, pickPriorMatches, type PriorLine, type PriorPrice } from "@/lib/prior-prices-match";

export async function findPriorPrices(items: { source: string; target: string; label: string }[], customerEmail?: string | null) {
  const own = emailKey(customerEmail);
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const pairs = new Map<string, { source: string; target: string }>();
  for (const it of items) pairs.set(`${it.source}>${it.target}`, { source: it.source, target: it.target });

  const byPair = new Map<string, PriorLine[]>();
  for (const [key, { source, target }] of Array.from(pairs)) {
    const query = (extra: object, take: number) =>
      prisma.quoteLine.findMany({
        where: {
          quote: {
            deletedAt: null,
            status: { in: [...PRIOR_STATUSES] },
            issuedAt: { gte: since },
            sourceLang: { equals: source, mode: "insensitive" },
            targetLang: { equals: target, mode: "insensitive" },
            ...extra,
          },
        },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          description: true,
          unitPrice: true,
          supplierUnitCost: true,
          quote: { select: { quoteNumber: true, issuedAt: true, status: true, paidAt: true, translatorName: true } },
        },
      });
    // Cliente que vuelve: sus propios precios se piden aparte para que el tope de 600 no los deje fuera.
    const [general, mine] = await Promise.all([
      query({}, 600),
      own ? query({ customerEmail: { equals: own, mode: "insensitive" } }, 100) : Promise.resolve([]),
    ]);
    const mineIds = new Set(mine.map((r) => r.id));
    const rows = [...mine, ...general.filter((r) => !mineIds.has(r.id))];
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
        own: mineIds.has(r.id),
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
