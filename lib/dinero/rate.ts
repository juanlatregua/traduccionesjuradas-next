import { assertNonNegativeCents, divRoundHalfUp, roundDownToEuro, type Cents } from "./money.ts";
import { canIssue, type Margin } from "./margin.ts";
import { costFromStoredBase } from "./supplier.ts";

export const DOC_FLOOR_CENTS: Cents = 4000;
export const PER_1000_WORDS_MIN_WORDS = 1000;
export const DOC_SIZE_MIN_PCT = 25;
export const DOC_SIZE_MAX_PCT = 130;
const PER_1000_RULE = "el documento no se cobra por palabra (certificado de ≤ 2 páginas o menos de 1000 palabras)";

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

/** A per-document tariff fits documents from 25 % of the reference up to 130 % (rule in force). Unknown size on either side never fits. */
export function fitsDocSize(words: number | null | undefined, wordsRef: number | null | undefined): boolean {
  if (!wordsRef || !words) return false;
  return words * 100 >= wordsRef * DOC_SIZE_MIN_PCT && words * 100 <= wordsRef * DOC_SIZE_MAX_PCT;
}

/** The unit rule in force: certificates (≤2 pages) are per document, never per word; from 1000 words, per 1000 words. */
export function unitFor(words: number | null | undefined, pages?: number | null): RateUnit {
  if (pages && pages <= 2) return "doc";
  return words && words >= PER_1000_WORDS_MIN_WORDS ? "per1000Words" : "doc";
}

export function priceWithRate(rate: ApprovedRate, doc: { words: number | null | undefined; pages: number | null | undefined }): RatePrice {
  const words = doc.words;
  if (!rate.costCents || !rate.clientCents) {
    return { kind: "noPrice", reason: "la tarifa no trae el par coste ↔ venta (los dos > 0)" };
  }
  assertNonNegativeCents(rate.costCents, "coste de la tarifa");
  assertNonNegativeCents(rate.clientCents, "venta de la tarifa");
  let costCents: Cents;
  let clientCents: Cents;
  if (rate.unit === "per1000Words") {
    if (!words || !(words > 0) || !Number.isSafeInteger(words)) return { kind: "noPrice", reason: "tarifa por 1000 palabras sin palabras" };
    if (unitFor(words, doc.pages) !== "per1000Words") return { kind: "noPrice", reason: PER_1000_RULE };
    costCents = divRoundHalfUp(words * rate.costCents, 1000);
    clientCents = Math.max(DOC_FLOOR_CENTS, Math.floor((words * rate.clientCents) / 100000) * 100);
  } else {
    costCents = rate.costCents;
    clientCents = Math.max(DOC_FLOOR_CENTS, roundDownToEuro(rate.clientCents));
  }
  const check = canIssue(clientCents, costFromStoredBase(costCents));
  if (!check.ok) return { kind: "blocked", clientCents, costCents, margin: check.margin, reason: check.reason };
  return { kind: "priced", clientCents, costCents, margin: check.margin };
}

export type RateCandidate = ApprovedRate & { approved: boolean };

/** Exact key first (with its size check); else the per-1000-words wildcard for long documents. */
export type RateSelection = { kind: "rate"; rate: ApprovedRate } | { kind: "none"; reason: string };

export function selectRate(
  candidates: { exact: RateCandidate | null; wildcard: RateCandidate | null },
  doc: { words: number | null | undefined; pages: number | null | undefined }
): RateSelection {
  const { exact, wildcard } = candidates;
  if (exact?.approved) {
    if (exact.unit === "doc" && !exact.wordsRef) return { kind: "none", reason: "tarifa sin referencia de tamaño" };
    if (exact.unit === "doc" && !doc.words) return { kind: "none", reason: "documento sin recuento: no se puede comprobar el tamaño" };
    if (exact.unit === "doc" && !fitsDocSize(doc.words, exact.wordsRef)) return { kind: "none", reason: `el documento no encaja en el tamaño de la tarifa (de ${DOC_SIZE_MIN_PCT} % a ${DOC_SIZE_MAX_PCT} % de la referencia)` };
    if (exact.unit === "per1000Words" && !doc.words) return { kind: "none", reason: "tarifa por 1000 palabras sin palabras" };
    if (exact.unit === "per1000Words" && unitFor(doc.words, doc.pages) !== "per1000Words") return { kind: "none", reason: PER_1000_RULE };
    return { kind: "rate", rate: exact };
  }
  if (unitFor(doc.words, doc.pages) === "per1000Words" && wildcard?.approved && wildcard.unit === "per1000Words") return { kind: "rate", rate: wildcard };
  return { kind: "none", reason: "sin tarifa aprobada" };
}
