import { divRoundHalfUp, type Cents } from "./money.ts";
import { formatEuros } from "./format.ts";

// Published French → Spanish tariff (the owner translates: own work, cost 0). Net amounts, no VAT.
export const FR_PAGE_CENTS = 3000;
export const FR_DOC_2_PAGES_CENTS = 3500;
export const FR_DOC_LONG_CENTS = 5500;
export const FR_DOC_MAX_PAGES = 2;
export const FR_DOC_LONG_WORDS = 900;
export const FR_APOSTILLE_EXTRA_CENTS = 500;
export const FR_CRIMINAL_RECORD_CENTS = 6198; // Bulletin n°3 with EU annex (≥3 pages): 75,00 € with VAT
export const FR_CRIMINAL_RECORD_MIN_PAGES = 3;
export const FR_REGULARIZATION_DOC_CENTS = 2500;
export const FR_REGULARIZATION_MAX_PAGES = 2;
export const FR_SAME_DAY_FACTOR_PCT = 140;
export const FR_WORD_CENTS = 8;
export const FR_WORD_MIN_CENTS = 3500;
export const FR_WORD_MIN_MULTIPAGE_CENTS = 5500;
export const COMPLEXITY_TENTHS = { standard: 10, complex: 12, highly_complex: 15 } as const;
export type Complexity = keyof typeof COMPLEXITY_TENTHS;

export const FR_RC_BASE_CENTS = 3000;
/** Company register extract: each page after the 1st adds by its tier. */
const FR_RC_PAGE_TIERS: readonly { upToPage: number; cents: Cents }[] = [
  { upToPage: 5, cents: 500 },
  { upToPage: 12, cents: 2000 },
  { upToPage: 19, cents: 1200 },
  { upToPage: Infinity, cents: 1000 },
];

export const FR_BANK_DOC_CENTS = 3000;
export const FR_BANK_BULK_MIN_DOCS = 5;
export const FR_BANK_BULK_1_PAGE_CENTS = 1500;
export const FR_BANK_BULK_EXTRA_PAGE_CENTS = 500;

/** Charged per page of the original beyond the per-document band. */
const PAGE_PRICED_TYPES = new Set([
  "birth_certificate", "marriage_certificate", "death_certificate", "criminal_record", "passport",
  "id_card", "degree", "transcript", "grades", "bank_statement",
]);
/** Priced by word or by hand, never by this tariff. A lone apostille may hide the act inside the same PDF. */
const WORD_PRICED_TYPES = new Set(["contract", "power_of_attorney", "divorce_decree", "apostille"]);

export type FrDocType =
  | "birth_certificate" | "marriage_certificate" | "death_certificate" | "criminal_record" | "passport"
  | "id_card" | "degree" | "transcript" | "grades" | "bank_statement" | "company_registration"
  | "contract" | "power_of_attorney" | "divorce_decree" | "apostille" | "payslip" | "medical_report"
  | "tax_return" | "other";

export type FrDocInput = {
  /** Original in French, translation into Spanish. */
  docType: FrDocType | (string & {});
  /** Analysis category; «legal» (judgments, deeds) stays out of the per-document band. */
  category?: string | null;
  pages: number;
  words?: number | null;
  apostille: boolean;
  /** Apostilles on this one translation (several documents joined into one): each adds its supplement. Default 1. */
  apostilles?: number;
  /** The analysis says explicitly that the apostille takes its own sheet. */
  apostilleOnSeparatePage?: boolean;
  /** Bank statements in the same quote (bulk price from 5). */
  bankStatementsInQuote?: number;
  /** Purpose «regularización 2026»: flat 25 € per document up to 2 pages. */
  regularization?: boolean;
  /** Only for the per-word rule (contracts, deeds, long documents). Default standard. */
  complexity?: Complexity;
};

export type FrRule = "regularization" | "criminalRecord" | "perDocument" | "companyRegister" | "bankStatement" | "perPage" | "perWord";

export type FrPrice =
  | { kind: "priced"; cents: Cents; rule: FrRule; pages: number; why: string[] }
  | { kind: "noTariff"; reason: string };

function billablePages(pages: number): number {
  const n = Math.floor(Number(pages));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function rcCents(pages: number): Cents {
  let cents = FR_RC_BASE_CENTS;
  for (let page = 2; page <= pages; page++) cents += FR_RC_PAGE_TIERS.find((t) => page <= t.upToPage)!.cents;
  return cents;
}

export const FR_MAX_APOSTILLES = 50;

function apostilleCount(doc: FrDocInput): number {
  if (doc.apostilles === undefined) return doc.apostille ? 1 : 0;
  const n = doc.apostilles;
  if (!Number.isSafeInteger(n) || n < 1 || n > FR_MAX_APOSTILLES) throw new RangeError(`apostillas: ${n} no es un entero de 1 a ${FR_MAX_APOSTILLES}`);
  if (doc.apostille !== true) throw new RangeError(`apostillas: ${n} sin apostilla en el documento`);
  return n;
}

function withApostille(cents: Cents, count: number, why: string[]): Cents {
  if (count === 0) return cents;
  if (count === 1) why.push(`+ ${formatEuros(FR_APOSTILLE_EXTRA_CENTS)} por la apostilla (no cuenta como página)`);
  else why.push(`+ ${count} × ${formatEuros(FR_APOSTILLE_EXTRA_CENTS)} por ${count} apostillas (no cuentan como página)`);
  return cents + FR_APOSTILLE_EXTRA_CENTS * count;
}

export function priceFrToEs(doc: FrDocInput): FrPrice {
  const type = String(doc.docType || "").trim().toLowerCase();
  const rawPages = billablePages(doc.pages);
  const why: string[] = [];

  if (type === "criminal_record" && rawPages >= FR_CRIMINAL_RECORD_MIN_PAGES) {
    why.push(`Certificado de penales francés de ${rawPages} páginas (formulario UE): ${formatEuros(FR_CRIMINAL_RECORD_CENTS)}`);
    const cents = withApostille(FR_CRIMINAL_RECORD_CENTS, apostilleCount(doc), why);
    return { kind: "priced", cents, rule: "criminalRecord", pages: rawPages, why };
  }

  if (doc.regularization && rawPages <= FR_REGULARIZATION_MAX_PAGES) {
    why.push(`Regularización: ${formatEuros(FR_REGULARIZATION_DOC_CENTS)} por documento de hasta ${FR_REGULARIZATION_MAX_PAGES} páginas`);
    return { kind: "priced", cents: FR_REGULARIZATION_DOC_CENTS, rule: "regularization", pages: rawPages, why };
  }

  // In doubt the apostille sheet is charged as a page; only an explicit «separate page» discounts it.
  const pages = doc.apostille && doc.apostilleOnSeparatePage === true ? Math.max(1, rawPages - 1) : rawPages;
  if (pages !== rawPages) why.push(`${rawPages} páginas, la de la apostilla no cuenta: ${pages}`);

  const perDocType =
    type !== "company_registration" &&
    type !== "bank_statement" &&
    !WORD_PRICED_TYPES.has(type) &&
    String(doc.category || "").trim().toLowerCase() !== "legal";

  if (perDocType && pages <= FR_DOC_MAX_PAGES) {
    const long = Number(doc.words) > FR_DOC_LONG_WORDS;
    const cents = long ? FR_DOC_LONG_CENTS : pages === 1 ? FR_PAGE_CENTS : FR_DOC_2_PAGES_CENTS;
    why.push(
      long
        ? `Documento de hasta ${FR_DOC_MAX_PAGES} páginas con más de ${FR_DOC_LONG_WORDS} palabras: ${formatEuros(cents)}`
        : `Documento de ${pages} página${pages === 1 ? "" : "s"}: ${formatEuros(cents)}`
    );
    return { kind: "priced", cents: withApostille(cents, apostilleCount(doc), why), rule: "perDocument", pages, why };
  }

  if (type === "company_registration") {
    const cents = rcCents(pages);
    why.push(`Extracto del registro mercantil de ${pages} páginas por tramos: ${formatEuros(cents)}`);
    return { kind: "priced", cents: withApostille(cents, apostilleCount(doc), why), rule: "companyRegister", pages, why };
  }

  if (type === "bank_statement") {
    const inQuote = Number(doc.bankStatementsInQuote) || 1;
    const bulk = inQuote >= FR_BANK_BULK_MIN_DOCS;
    const cents = bulk ? FR_BANK_BULK_1_PAGE_CENTS + FR_BANK_BULK_EXTRA_PAGE_CENTS * (pages - 1) : FR_BANK_DOC_CENTS;
    why.push(
      bulk
        ? `Extracto bancario en lote (${inQuote} en el presupuesto), ${pages} páginas: ${formatEuros(cents)}`
        : `Extracto bancario: ${formatEuros(cents)} por documento`
    );
    return { kind: "priced", cents: withApostille(cents, apostilleCount(doc), why), rule: "bankStatement", pages, why };
  }

  if (PAGE_PRICED_TYPES.has(type)) {
    const cents = pages * FR_PAGE_CENTS;
    why.push(`${pages} páginas × ${formatEuros(FR_PAGE_CENTS)}`);
    return { kind: "priced", cents: withApostille(cents, apostilleCount(doc), why), rule: "perPage", pages, why };
  }

  if (type === "apostille") return { kind: "noTariff", reason: "apostilla suelta: puede llevar el acta dentro, presupuesto a mano" };

  // Contracts, powers, judgments, legal-category and long documents: per word with its minimum.
  const words = Number(doc.words);
  if (!Number.isSafeInteger(words) || words <= 0) return { kind: "noTariff", reason: "por palabra sin recuento de palabras" };
  const complexity = doc.complexity ?? "standard";
  const tenths = COMPLEXITY_TENTHS[complexity];
  if (!tenths) return { kind: "noTariff", reason: `complejidad desconocida «${String(complexity)}»` };
  const minimum = rawPages >= 2 ? FR_WORD_MIN_MULTIPAGE_CENTS : FR_WORD_MIN_CENTS;
  const wordTenthCents = words * FR_WORD_CENTS * tenths;
  const useMinimum = wordTenthCents < minimum * 10;
  why.push(
    useMinimum
      ? `${words} palabras × ${FR_WORD_CENTS} c${tenths !== 10 ? ` × ${tenths / 10}` : ""} por debajo del mínimo: ${formatEuros(minimum)}`
      : `${words} palabras × ${FR_WORD_CENTS} c${tenths !== 10 ? ` × ${tenths / 10} (complejidad)` : ""}`
  );
  const cents = divRoundHalfUp(Math.max(wordTenthCents, minimum * 10), 10);
  return { kind: "priced", cents: withApostille(cents, apostilleCount(doc), why), rule: "perWord", pages: rawPages, why };
}

/** Same-day delivery for French: +40 %. */
export function frSameDayCents(cents: Cents): Cents {
  return divRoundHalfUp(cents * FR_SAME_DAY_FACTOR_PCT, 100);
}
