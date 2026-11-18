import { divRoundHalfUp, type Cents } from "./money.ts";
import { COMPLEXITY_TENTHS, type Complexity } from "./tariff-fr.ts";

// Internal per-word engine for languages other than French. Its figure is an estimate
// of the translator's COST: never a client price (that needs a real cost and a decision).
const WORD_CENTS: Record<string, number> = { en: 11, de: 12, nl: 14, it: 12, pt: 12, ca: 8, sv: 14, no: 14, ar: 10, ro: 9 };
const LANG_MIN_CENTS: Record<string, Cents> = { en: 5000, de: 5000, nl: 5000, it: 5000, pt: 5000, ca: 5000, sv: 5000, no: 5000, ro: 5000, ar: 5500 };
const LANG_APOSTILLE_CENTS: Record<string, Cents> = { en: 1500, de: 1500, nl: 1500, it: 1500, pt: 1500, ca: 1500, sv: 1500, no: 1500, ro: 1500, ar: 1500 };
const TYPE_MIN_CENTS: Record<string, Cents> = {
  birth_certificate: 4200, marriage_certificate: 4200, death_certificate: 4200, criminal_record: 4200,
  passport: 3500, id_card: 4500, divorce_decree: 5500, degree: 5000, transcript: 5500, apostille: 2000,
  contract: 6000, power_of_attorney: 5500, company_registration: 6000, payslip: 3500, medical_report: 5000,
  tax_return: 5000, other: 4200,
};
const DEFAULT_TYPE_MIN_CENTS: Cents = 4200;
// Two pages weigh even when the word count is short; simple certificates are exempt.
const PAGE_MIN_CENTS = 4000;
const PAGE_MIN_MAX_PAGES = 2;
const PAGE_MIN_EXEMPT = new Set(["birth_certificate", "marriage_certificate", "death_certificate", "criminal_record", "passport", "id_card", "apostille"]);
const URGENT_PCT = 125;

export const ESTIMATE_LANGS: ReadonlySet<string> = new Set(Object.keys(WORD_CENTS));

export type EstimateInput = {
  /** Non-Spanish side of an es↔X pair. */
  lang: string;
  docType: string;
  words: number;
  pages: number;
  complexity?: Complexity;
  apostille: boolean;
};

export type InternalCostEstimate = {
  readonly kind: "internalCostEstimate";
  internalCostCents: Cents;
  urgentInternalCostCents: Cents;
  minimumCents: Cents;
  minimumApplied: boolean;
  apostilleCents: Cents;
};

export type EstimateResult = InternalCostEstimate | { readonly kind: "noEstimate"; reason: string };

export function estimateInternalCost(input: EstimateInput): EstimateResult {
  const lang = String(input.lang || "").trim().toLowerCase();
  const type = String(input.docType || "").trim().toLowerCase();
  const wordCents = WORD_CENTS[lang];
  if (!wordCents) return { kind: "noEstimate", reason: lang === "fr" ? "el francés tiene tarifa propia (tariff-fr)" : `idioma sin tarifa por palabra: «${lang}»` };
  if (!Number.isSafeInteger(input.words) || input.words < 0) return { kind: "noEstimate", reason: "palabras no válidas" };
  const tenths = COMPLEXITY_TENTHS[input.complexity ?? "standard"];
  if (!tenths) return { kind: "noEstimate", reason: `complejidad desconocida «${String(input.complexity)}»` };

  const pages = Math.max(1, Math.floor(Number(input.pages) || 1));
  const pageMin = PAGE_MIN_EXEMPT.has(type) ? 0 : PAGE_MIN_CENTS * Math.min(PAGE_MIN_MAX_PAGES, pages);
  const minimumCents = Math.max(TYPE_MIN_CENTS[type] || DEFAULT_TYPE_MIN_CENTS, LANG_MIN_CENTS[lang] ?? 0, pageMin);
  const apostilleCents = input.apostille ? LANG_APOSTILLE_CENTS[lang] : 0;

  const wordTenthCents = input.words * wordCents * tenths;
  const baseTenthCents = Math.max(wordTenthCents, minimumCents * 10) + apostilleCents * 10;
  return {
    kind: "internalCostEstimate",
    internalCostCents: divRoundHalfUp(baseTenthCents, 10),
    urgentInternalCostCents: divRoundHalfUp(baseTenthCents * URGENT_PCT, 1000),
    minimumCents,
    minimumApplied: wordTenthCents < minimumCents * 10,
    apostilleCents,
  };
}
