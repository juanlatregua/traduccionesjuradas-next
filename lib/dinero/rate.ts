import { assertNonNegativeCents, divRoundHalfUp, roundDownToEuro, type Cents } from "./money.ts";
import { canIssue, type Margin } from "./margin.ts";
import { knownCost } from "./supplier.ts";

export const DOC_FLOOR_CENTS: Cents = 4000;
export const PER_1000_WORDS_MIN_WORDS = 1000;
export const DOC_SIZE_MIN_PCT = 25;
export const DOC_SIZE_MAX_PCT = 130;

export type RateUnit = "doc" | "per1000Words";

/** An approved tariff is a pair: what the translator charges and what the client pays, per unit, without VAT. */
export type ApprovedRate = {
  unit: RateUnit;
  costCents: Cents | null;
  clientCents: Cents | null;
  /** Words of the reference document (doc unit). */
  wordsRef?: number | null;
};

export type RatePrice =
  | { kind: "priced"; clientCents: Cents; costCents: Cents; margin: Margin }
  | { kind: "blocked"; clientCents: Cents; costCents: Cents; margin: Margin; reason: string }
  | { kind: "noPrice"; reason: string };

/** A per-document tariff fits documents from ¼ of the reference up to +30 %; without data it fits. */
export function fitsDocSize(words: number | null | undefined, wordsRef: number | null | undefined): boolean {
  if (!words || !wordsRef) return true;
  return words * 100 >= wordsRef * DOC_SIZE_MIN_PCT && words * 100 <= wordsRef * DOC_SIZE_MAX_PCT;
}

/** Certificates (≤2 pages) are per document; from 1000 words, per 1000 words. */
export function unitFor(words: number | null | undefined, pages?: number | null): RateUnit {
  if (pages && pages <= 2) return "doc";
  return words && words >= PER_1000_WORDS_MIN_WORDS ? "per1000Words" : "doc";
}

export function priceWithRate(rate: ApprovedRate, words: number | null | undefined): RatePrice {
  if (rate.costCents == null || rate.clientCents == null) {
    return { kind: "noPrice", reason: "la tarifa no trae el par coste ↔ venta" };
  }
  assertNonNegativeCents(rate.costCents, "coste de la tarifa");
  assertNonNegativeCents(rate.clientCents, "venta de la tarifa");
  let costCents: Cents;
  let clientCents: Cents;
  if (rate.unit === "per1000Words") {
    if (!words || !(words > 0) || !Number.isSafeInteger(words)) return { kind: "noPrice", reason: "tarifa por 1000 palabras sin palabras" };
    costCents = divRoundHalfUp(words * rate.costCents, 1000);
    clientCents = Math.max(DOC_FLOOR_CENTS, Math.floor((words * rate.clientCents) / 100000) * 100);
  } else {
    costCents = rate.costCents;
    clientCents = Math.max(DOC_FLOOR_CENTS, roundDownToEuro(rate.clientCents));
  }
  const check = canIssue(clientCents, knownCost(costCents));
  if (!check.ok) return { kind: "blocked", clientCents, costCents, margin: check.margin, reason: check.reason };
  return { kind: "priced", clientCents, costCents, margin: check.margin };
}

export type RateCandidate = ApprovedRate & { approved: boolean };

/** Exact key first (with its size check); else the per-1000-words wildcard for long documents. */
export function selectRate(
  candidates: { exact: RateCandidate | null; wildcard: RateCandidate | null },
  doc: { words: number | null | undefined; pages: number | null | undefined }
): ApprovedRate | null {
  const { exact, wildcard } = candidates;
  if (exact?.approved) {
    if (exact.unit === "doc" && !fitsDocSize(doc.words, exact.wordsRef)) return null;
    if (exact.unit === "per1000Words" && !doc.words) return null;
    return exact;
  }
  if (unitFor(doc.words, doc.pages) === "per1000Words" && wildcard?.approved && wildcard.unit === "per1000Words") return wildcard;
  return null;
}
