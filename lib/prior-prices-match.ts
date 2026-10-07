export type PriorPrice = {
  unitPrice: number;
  supplierUnitCost: number | null;
  quoteNumber: string;
  issuedAt: string;
  status: string;
  translatorName: string | null;
};

export type PriorLine = PriorPrice & { description: string; paid: boolean; issuedMs: number };

export const PRIOR_STATUSES = ["SENT", "OPENED", "ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED"] as const;
const MIN_FUZZY_CHARS = 8;
const MAX_MATCHES = 3;

export function normalizeLabel(raw: string | null | undefined) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function labelOfDescription(description: string | null | undefined) {
  return normalizeLabel(String(description || "").split(" (")[0]);
}

export function labelsMatch(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_FUZZY_CHARS && long.includes(short);
}

export function pickPriorMatches(lines: PriorLine[], label: string): PriorPrice[] {
  const target = normalizeLabel(label);
  return lines
    .filter((l) => labelsMatch(labelOfDescription(l.description), target))
    .sort((a, b) => Number(b.paid) - Number(a.paid) || b.issuedMs - a.issuedMs)
    .slice(0, MAX_MATCHES)
    .map(({ unitPrice, supplierUnitCost, quoteNumber, issuedAt, status, translatorName }) => ({
      unitPrice,
      supplierUnitCost,
      quoteNumber,
      issuedAt,
      status,
      translatorName,
    }));
}
