import { euroStringFromCents, type Cents } from "../dinero/money.ts";
import { VAT_GENERAL_21, vatFields } from "../dinero/vat.ts";
import { quoteTotals, type QuoteTotals } from "../dinero/totals.ts";
import { OWN_WORK, UNKNOWN_COST, costFromStoredBase, type SupplierCost } from "../dinero/supplier.ts";
import { canIssue } from "../dinero/margin.ts";
import { formatEuros } from "../dinero/format.ts";
import { priceFrToEs } from "../dinero/tariff-fr.ts";
import { labelOf, type WorkingDocument } from "./documents.ts";

export type LectureFile = { position: number | null; url: string | null; pageCount: number | null; name: string };

export type DraftLine = {
  documentId: string;
  description: string;
  unitPriceCents: Cents;
  priceSource: "fr_tariff" | "manual";
  tariffCents: Cents | null;
  tariffWhy: string[];
  cost: SupplierCost;
  sourceFileUrl: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  docKind: string;
};

export type LineIssue = { documentId: string | null; label: string; detail: string };

export type LinesResult = {
  sourceLang: string | null;
  targetLang: string;
  lines: DraftLine[];
  blockers: LineIssue[];
  warnings: LineIssue[];
  totals: QuoteTotals | null;
};

const lang = (s: string | null | undefined) => (s || "").trim().toLowerCase();
const isFrEs = (source: string, target: string) => lang(source) === "fr" && lang(target) === "es";

function fileRange(doc: WorkingDocument, files: readonly LectureFile[]) {
  const body = [...doc.parts, ...doc.annexes.flatMap((a) => a.parts)];
  const indices = new Set(body.map((p) => p.fileIndex));
  const first = files.find((f) => f.position === body[0]?.fileIndex) ?? null;
  if (!first?.url) return { sourceFileUrl: null, pageStart: null, pageEnd: null };
  if (indices.size !== 1 || !/\.pdf$/i.test(first.name)) return { sourceFileUrl: first.url, pageStart: null, pageEnd: null };
  const pages = body.map((p) => p.page);
  return { sourceFileUrl: first.url, pageStart: Math.min(...pages), pageEnd: Math.max(...pages) };
}

export function tariffFor(doc: WorkingDocument, targetLang: string, bankStatementsInQuote: number) {
  if (!isFrEs(doc.sourceLang, targetLang)) return null;
  return priceFrToEs({
    docType: doc.type,
    category: doc.category,
    pages: doc.pageCount,
    words: doc.words,
    apostille: doc.apostille !== null,
    apostilleOnSeparatePage: false,
    bankStatementsInQuote,
  });
}

/** Included documents → quote lines. Amounts only from lib/dinero; a person confirms every line before it exists. */
export function buildLines(documents: readonly WorkingDocument[], files: readonly LectureFile[], targetLang: string): LinesResult {
  const included = documents.filter((d) => d.included).sort((a, b) => a.position - b.position);
  const blockers: LineIssue[] = [];
  const warnings: LineIssue[] = [];
  const lines: DraftLine[] = [];
  const target = lang(targetLang);
  if (!/^[a-z]{2,3}$/.test(target)) blockers.push({ documentId: null, label: "Idioma de destino", detail: "falta el idioma de destino" });
  const sources = new Set(included.map((d) => lang(d.sourceLang)));
  const sourceLang = sources.size === 1 ? [...sources][0] : null;
  if (included.length === 0) blockers.push({ documentId: null, label: "Lote", detail: "no hay ningún documento incluido" });
  if (sources.size > 1) blockers.push({ documentId: null, label: "Idiomas de origen", detail: `${[...sources].join(", ")}: un presupuesto por par` });
  if (sourceLang && !/^[a-z]{2,3}$/.test(sourceLang)) blockers.push({ documentId: null, label: "Idioma de origen", detail: `«${sourceLang}» no es un idioma: corrige el tipo o sepáralo` });
  const bank = included.filter((d) => d.type === "bank_statement" && isFrEs(d.sourceLang, target)).length;

  for (const d of included) {
    const label = labelOf(d);
    const tariff = tariffFor(d, target, bank);
    const tariffCents = tariff?.kind === "priced" ? tariff.cents : null;
    const tariffWhy = tariff?.kind === "priced" ? tariff.why : tariff ? [tariff.reason] : [];
    const unit = d.manualPriceCents ?? tariffCents;
    if (unit === null) {
      blockers.push({ documentId: d.id, label, detail: tariff ? `sin tarifa francesa (${tariffWhy[0]}): pon el precio a mano` : "sin tarifa automática: pon el precio a mano" });
      continue;
    }
    if (unit <= 0) {
      blockers.push({ documentId: d.id, label, detail: "precio 0: no se presupuesta gratis" });
      continue;
    }
    const cost = isFrEs(d.sourceLang, target) && d.manualCostCents === null ? OWN_WORK : d.manualCostCents === null ? UNKNOWN_COST : costFromStoredBase(d.manualCostCents);
    const check = canIssue(unit, cost);
    if (!check.ok) {
      if (check.margin.class === "unknown") warnings.push({ documentId: d.id, label, detail: `${check.reason}: el freno de margen lo parará al enviar` });
      else blockers.push({ documentId: d.id, label, detail: check.reason });
    }
    lines.push({
      documentId: d.id,
      description: label,
      unitPriceCents: unit,
      priceSource: d.manualPriceCents !== null ? "manual" : "fr_tariff",
      tariffCents,
      tariffWhy,
      cost,
      ...fileRange(d, files),
      docKind: String(d.type),
    });
  }
  for (const d of documents) {
    if (!d.included) warnings.push({ documentId: d.id, label: labelOf(d), detail: `no incluido: ${d.excludedReason ?? "sin motivo"}` });
  }
  const totalsResult = lines.length
    ? quoteTotals({ lines: lines.map((l) => ({ quantity: 1, unitPriceCents: l.unitPriceCents })), discount: { kind: "none" }, shippingCents: 0, regime: VAT_GENERAL_21 })
    : null;
  return { sourceLang, targetLang: target, lines, blockers, warnings, totals: totalsResult?.ok ? totalsResult.totals : null };
}

export type QuoteLinePayload = {
  description: string;
  quantity: number;
  unitPrice: string;
  supplierUnitCost?: string;
  sourceFileUrl?: string;
  pageStart?: number;
  pageEnd?: number;
  docKind: string;
};

export type QuotePayload = {
  sourceLang: string;
  targetLang: string;
  deliveryType: "DIGITAL_PDF";
  vatRate: number;
  lines: QuoteLinePayload[];
};

/** What POST /api/quotes receives, euros as exact decimal strings. Only when there are no blockers. */
export function quotePayload(result: LinesResult): QuotePayload | null {
  if (result.blockers.length > 0 || !result.sourceLang || result.lines.length === 0) return null;
  return {
    sourceLang: result.sourceLang,
    targetLang: result.targetLang,
    deliveryType: "DIGITAL_PDF",
    vatRate: vatFields(VAT_GENERAL_21).vatRate,
    lines: result.lines.map((l) => ({
      description: l.description,
      quantity: 1,
      unitPrice: euroStringFromCents(l.unitPriceCents),
      ...(l.cost.known && !l.cost.ownWork ? { supplierUnitCost: euroStringFromCents(l.cost.baseCents) } : {}),
      ...(l.sourceFileUrl ? { sourceFileUrl: l.sourceFileUrl } : {}),
      ...(l.pageStart !== null ? { pageStart: l.pageStart } : {}),
      ...(l.pageEnd !== null ? { pageEnd: l.pageEnd } : {}),
      docKind: l.docKind,
    })),
  };
}

export type LinesView = {
  sourceLang: string | null;
  targetLang: string;
  lines: (Omit<DraftLine, "cost"> & { price: string; tariff: string | null; cost: string | null; ownWork: boolean })[];
  blockers: LineIssue[];
  warnings: LineIssue[];
  totals: { subtotal: string; vat: string; total: string } | null;
};

export function linesView(result: LinesResult): LinesView {
  return {
    sourceLang: result.sourceLang,
    targetLang: result.targetLang,
    lines: result.lines.map((l) => ({
      ...l,
      price: formatEuros(l.unitPriceCents),
      tariff: l.tariffCents === null ? null : formatEuros(l.tariffCents),
      cost: l.cost.known ? formatEuros(l.cost.baseCents) : null,
      ownWork: l.cost.known && l.cost.ownWork,
    })),
    blockers: result.blockers,
    warnings: result.warnings,
    totals: result.totals ? { subtotal: formatEuros(result.totals.subtotal), vat: formatEuros(result.totals.vat), total: formatEuros(result.totals.total) } : null,
  };
}
