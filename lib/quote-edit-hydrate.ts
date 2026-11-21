// lib/quote-edit-hydrate.ts — Página única del presupuesto (PRESUPUESTO_PAGINA_UNICA):
// el constructor se abre sobre un presupuesto YA creado. Aquí vive lo puro: el estado
// del constructor a partir del presupuesto, el análisis de cada línea (por URL del PDF y
// rango de páginas), el cuerpo del PATCH /api/quotes/[id] (mismo formato que
// QuoteEditForm), qué deja hacer cada estado y la guarda del pago congelado.

import { round2, PAPER_SHIPPING_BASE_EUR } from "./quote-math.ts";
import { MIN_AUTO_MARGIN_PCT } from "./learned-rates-math.ts";

export function presupuestoPaginaUnicaOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.PRESUPUESTO_PAGINA_UNICA === "on";
}

export type EditableLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  supplierUnitCost: number | null;
  sourceFileUrl: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  docKind: string | null;
};

export type EditableQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  sourceLang: string;
  targetLang: string;
  deliveryType: string;
  shippingBase: number;
  vatRate: number;
  discountType: string;
  discountValue: number;
  notesLegal: string | null;
  deliveryTerm: string | null;
  holderNames: string | null;
  validityDays: number;
  marginPct: number | null;
  paymentMethods: string[];
  contactWhatsapp: string | null;
  pdfLang: string | null;
  paymentFrozenAt: string | null;
  updatedAt: string;
  total: number;
  lines: EditableLine[];
};

/** Un documento del análisis guardado (DocumentAnalysis → toBuilderDocuments o sus columnas). */
export type AnalysisDoc = {
  fileUrl: string;
  fileName: string;
  pageStart: number | null;
  pageEnd: number | null;
  documentType?: string | null;
  documentTypeEs?: string | null;
  category?: string | null;
  sourceLang?: string | null;
  sourceName?: string | null;
  targetLang?: string | null;
  targetName?: string | null;
  words?: number | null;
  pages?: number | null;
  complexity?: string | null;
  countryCode?: string | null;
  hasApostille?: boolean;
  hasTables?: boolean;
  hasHandwriting?: boolean;
  apostilleSeparatePage?: boolean;
  absorbedPages?: number[] | null;
  mode?: "text" | "vision";
};

// ── Estado según el estado del presupuesto ──
export type EditGate = "draft" | "live" | "readonly";

export function editGateFor(status: string): EditGate {
  if (status === "DRAFT") return "draft";
  if (status === "SENT" || status === "OPENED" || status === "ACCEPTED") return "live";
  return "readonly";
}

// ── Análisis por línea ──
/** Claves de sesión de DocumentAnalysis que corresponden al expedienteRef del presupuesto. */
export function sessionKeysForExpediente(expedienteRef: string | null | undefined): string[] {
  const ref = (expedienteRef || "").trim();
  if (!ref) return [];
  if (ref.startsWith("puerta:")) return [ref.slice("puerta:".length), ref];
  if (ref.startsWith("exp:")) return [ref, ref.slice(4)];
  return [`exp:${ref}`, ref];
}

/** Una fila por URL: la de la sesión del presupuesto si la hay; si no, la más reciente. */
export function preferAnalysisRows<T extends { fileUrl: string; sessionToken: string | null; createdAt: Date | string }>(rows: T[], sessionKeys: string[]): T[] {
  const best = new Map<string, T>();
  const score = (r: T) => (r.sessionToken && sessionKeys.includes(r.sessionToken) ? 1 : 0);
  for (const r of rows) {
    const cur = best.get(r.fileUrl);
    if (!cur || score(r) > score(cur) || (score(r) === score(cur) && new Date(r.createdAt) > new Date(cur.createdAt))) best.set(r.fileUrl, r);
  }
  return [...best.values()];
}

/** El documento analizado de una línea: mismo PDF y mismo rango; con un solo documento en el PDF, ese. */
export function matchAnalysis(line: EditableLine, docs: AnalysisDoc[]): AnalysisDoc | null {
  if (!line.sourceFileUrl) return null;
  const same = docs.filter((d) => d.fileUrl === line.sourceFileUrl);
  if (same.length === 0) return null;
  const exact = same.find((d) => d.pageStart === line.pageStart && d.pageEnd === line.pageEnd);
  if (exact) return exact;
  return same.length === 1 && line.pageStart == null && line.pageEnd == null ? same[0] : null;
}

// ── Filas del constructor ──
export type HydratedRow = {
  localId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "done" | "manual";
  include: boolean;
  unitPrice: number; // coste TOTAL de la línea (modelo del constructor)
  clientPrice: number; // precio cliente TOTAL de la línea
  autoPriced: false;
  basis?: "unit";
  unitCount?: number;
  unitRate?: number;
  lineDescription: string; // texto de la línea tal cual; editable
  origLine: EditableLine;
  hydratedSig: string;
  blobUrl?: string;
  pageStart?: number;
  pageEnd?: number;
  documentType?: string;
  documentTypeEs?: string;
  category?: string;
  sourceLang?: string;
  sourceName?: string;
  targetLang?: string;
  targetName?: string;
  words?: number;
  pages?: number;
  complexity?: string;
  countryCode?: string;
  hasApostille?: boolean;
  hasTables?: boolean;
  hasHandwriting?: boolean;
  apostilleSeparatePage?: boolean;
  absorbedPages?: number[];
  mode?: "text" | "vision";
};

type SigRow = {
  include: boolean;
  unitPrice: number;
  clientPrice?: number;
  lineDescription?: string;
  basis?: string;
  unitCount?: number;
  unitRate?: number;
  blobUrl?: string;
  pageStart?: number;
  pageEnd?: number;
  documentType?: string;
};

/** Huella de lo que cambia la línea emitida: si no cambia, la línea sale tal cual estaba. */
export function rowSignature(r: SigRow): string {
  return JSON.stringify([
    r.include,
    r.unitPrice,
    r.clientPrice ?? null,
    r.lineDescription ?? null,
    r.basis ?? null,
    r.unitCount ?? null,
    r.unitRate ?? null,
    r.blobUrl ?? null,
    r.pageStart ?? null,
    r.pageEnd ?? null,
    r.documentType ?? null,
  ]);
}

const opt = <T,>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

export function hydrateRows(lines: EditableLine[], docs: AnalysisDoc[], idOf: (i: number) => string = (i) => `q${i}`): HydratedRow[] {
  return lines.map((line, i) => {
    const qty = Number(line.quantity) || 0;
    const unit = Number(line.unitPrice) || 0;
    const cost = line.supplierUnitCost;
    const asUnits = qty > 1 && Number.isInteger(qty);
    const a = matchAnalysis(line, docs);
    const range = line.pageStart ? (line.pageEnd && line.pageEnd > line.pageStart ? ` · págs ${line.pageStart}-${line.pageEnd}` : ` · pág ${line.pageStart}`) : "";
    const row: Omit<HydratedRow, "hydratedSig"> = {
      localId: idOf(i),
      fileName: a ? `${a.fileName}${range}` : line.description,
      fileSize: 0,
      mimeType: line.sourceFileUrl ? "application/pdf" : "",
      status: a ? "done" : "manual",
      include: true,
      // Misma fórmula que el efecto «por documento» del constructor: no lo recalcula.
      unitPrice: asUnits ? Math.round(qty * (cost ?? 0) * 100) / 100 : round2(qty * (cost ?? 0)),
      clientPrice: round2(qty * unit),
      autoPriced: false,
      ...(asUnits ? { basis: "unit" as const, unitCount: qty, unitRate: cost ?? 0 } : {}),
      lineDescription: line.description,
      origLine: line,
      blobUrl: opt(line.sourceFileUrl),
      pageStart: opt(line.pageStart),
      pageEnd: opt(line.pageEnd),
      documentType: opt(a?.documentType) ?? opt(line.docKind),
      // Solo el tipo del análisis: el texto de la línea (puede llevar nombres) no viaja a lavori.
      documentTypeEs: opt(a?.documentTypeEs),
      category: opt(a?.category),
      sourceLang: opt(a?.sourceLang),
      sourceName: opt(a?.sourceName),
      targetLang: opt(a?.targetLang),
      targetName: opt(a?.targetName),
      words: opt(a?.words),
      pages: opt(a?.pages) ?? (line.pageStart && line.pageEnd ? line.pageEnd - line.pageStart + 1 : undefined),
      complexity: opt(a?.complexity),
      countryCode: opt(a?.countryCode),
      hasApostille: a?.hasApostille,
      hasTables: a?.hasTables,
      hasHandwriting: a?.hasHandwriting,
      apostilleSeparatePage: a?.apostilleSeparatePage,
      absorbedPages: a?.absorbedPages?.length ? a.absorbedPages : undefined,
      mode: a?.mode,
    };
    return { ...row, hydratedSig: rowSignature(row) };
  });
}

// ── Cuerpo del PATCH (mismo formato que QuoteEditForm) ──
export type PatchLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  supplierUnitCost?: number;
  sourceFileUrl?: string;
  pageStart?: number;
  pageEnd?: number;
  docKind?: string;
};

export function patchLineFromQuoteLine(l: EditableLine): PatchLine {
  return {
    description: l.description.trim() || "Línea",
    quantity: Number(l.quantity) || 1,
    unitPrice: Number(l.unitPrice) || 0,
    ...(l.supplierUnitCost != null ? { supplierUnitCost: Number(l.supplierUnitCost) } : {}),
    ...(l.sourceFileUrl ? { sourceFileUrl: l.sourceFileUrl } : {}),
    ...(l.pageStart != null ? { pageStart: Number(l.pageStart) } : {}),
    ...(l.pageEnd != null ? { pageEnd: Number(l.pageEnd) } : {}),
    ...(l.docKind ? { docKind: l.docKind } : {}),
  };
}

/** Fila sin tocar desde que se cargó → la línea guardada, exacta (conserva coste null y descripción). */
export function editLineFor<R extends SigRow & { origLine?: EditableLine; hydratedSig?: string }>(row: R, compose: (row: R) => PatchLine): PatchLine {
  if (row.origLine && row.hydratedSig === rowSignature(row)) return patchLineFromQuoteLine(row.origLine);
  const line = compose(row);
  // Línea guardada sin coste y nadie se lo ha puesto: sigue sin coste (null ≠ 0 €).
  if (row.origLine && row.origLine.supplierUnitCost == null && !(row.unitPrice > 0)) {
    const { supplierUnitCost: _drop, ...rest } = line;
    return rest;
  }
  return line;
}

export type EditForm = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sourceLang: string;
  targetLang: string;
  deliveryType: string;
  shippingBase: number;
  discountType: string;
  discountValue: number;
  vatRate: number;
  validityDays: number;
  notesLegal: string;
  deliveryTerm: string;
  holderNames: string;
  marginPct: number | null;
  paymentMethods: string[];
  contactWhatsapp: string;
  pdfLang: string | null;
};

export function editFormFromQuote(q: EditableQuote): EditForm {
  return {
    customerName: q.customerName || "",
    customerEmail: q.customerEmail || "",
    customerPhone: q.customerPhone || "",
    sourceLang: q.sourceLang || "",
    targetLang: q.targetLang || "",
    deliveryType: q.deliveryType === "PAPER_SHIP" ? "PAPER_SHIP" : "DIGITAL_PDF",
    shippingBase: Number(q.shippingBase) || 0,
    discountType: q.discountType === "PERCENT" || q.discountType === "FIXED" ? q.discountType : "NONE",
    discountValue: Number(q.discountValue) || 0,
    vatRate: Number.isFinite(Number(q.vatRate)) ? Number(q.vatRate) : 0.21,
    validityDays: q.validityDays ?? 15,
    notesLegal: q.notesLegal || "",
    deliveryTerm: q.deliveryTerm || "",
    holderNames: q.holderNames || "",
    marginPct: q.marginPct ?? null,
    paymentMethods: q.paymentMethods || [],
    contactWhatsapp: q.contactWhatsapp || "",
    pdfLang: q.pdfLang ?? null,
  };
}

/** shippingBase que el PATCH recalcula: el guardado si sigue en papel; si no, el estándar. */
export function shippingBaseFor(form: Pick<EditForm, "deliveryType" | "shippingBase">): number {
  return form.deliveryType === "PAPER_SHIP" ? form.shippingBase || PAPER_SHIPPING_BASE_EUR : 0;
}

export function buildQuotePatchPayload(
  form: EditForm,
  lines: PatchLine[],
  opts: { overrideLowMargin?: boolean; frozenRepair?: boolean; expectedUpdatedAt?: string | null } = {}
) {
  return {
    ...(opts.overrideLowMargin ? { overrideLowMargin: true } : {}),
    ...(opts.frozenRepair ? { frozenRepair: true } : {}),
    ...(opts.expectedUpdatedAt ? { expectedUpdatedAt: opts.expectedUpdatedAt } : {}),
    customerName: form.customerName.trim(),
    customerEmail: form.customerEmail.trim(),
    customerPhone: form.customerPhone.trim() || undefined,
    sourceLang: form.sourceLang,
    targetLang: form.targetLang,
    deliveryType: form.deliveryType,
    shippingBase: shippingBaseFor(form),
    discountType: form.discountType,
    discountValue: Number(form.discountValue) || 0,
    vatRate: form.vatRate,
    validityDays: Number(form.validityDays) || 15,
    notesLegal: form.notesLegal.trim() || null,
    deliveryTerm: form.deliveryTerm.trim() || null,
    holderNames: form.holderNames.trim() || null,
    marginPct: form.marginPct ?? undefined,
    paymentMethods: form.paymentMethods,
    contactWhatsapp: form.contactWhatsapp.trim() || null,
    pdfLang: form.pdfLang,
    lines,
  };
}

// ── Guarda del pago congelado (servidor) ──
export const FROZEN_EDIT_CODE = "PAGO_CONGELADO";

type MoneyLine = { quantity: unknown; unitPrice: unknown; supplierUnitCost: unknown };
const cents = (v: unknown) => (v == null ? null : Math.round(Number(v) * 100));
const moneyKey = (lines: MoneyLine[], total: unknown) =>
  JSON.stringify([cents(total), lines.map((l) => [cents(l.quantity), cents(l.unitPrice), cents(l.supplierUnitCost)])]);

/**
 * Presupuesto con el pago CONGELADO: cambiar líneas o importe solo desde la reparación
 * («Editar las líneas con la cifra del jurado»), que manda frozenRepair tras enseñar el aviso.
 * Datos sin dinero (cliente, notas, plazo) se guardan siempre.
 */
export function frozenEditBlocked(input: {
  frozen: boolean;
  frozenRepair: boolean;
  current: { lines: MoneyLine[]; total: unknown };
  next: { lines: MoneyLine[]; total: unknown };
}): boolean {
  if (!input.frozen || input.frozenRepair) return false;
  return moneyKey(input.current.lines, input.current.total) !== moneyKey(input.next.lines, input.next.total);
}

// ── Concurrencia optimista del PATCH ──
export const STALE_EDIT_CODE = "stale";
export const STALE_EDIT_ERROR =
  "El presupuesto ha cambiado desde que lo abriste (p. ej. llegó la cifra del jurado). Recarga para ver la versión actual.";

/** expectedUpdatedAt ausente → como siempre; presente y distinto (o ilegible) → obsoleto. */
export function isStaleEdit(expected: unknown, actual: Date | string): boolean {
  if (expected == null || expected === "") return false;
  const t = new Date(String(expected)).getTime();
  return !Number.isFinite(t) || t !== new Date(actual).getTime();
}

/** Decisión previa del PATCH /api/quotes/[id] antes de escribir (estado, obsoleto, congelado). */
export function patchPrecheck(input: {
  status: string;
  updatedAt: Date | string;
  expectedUpdatedAt: unknown;
  frozen: boolean;
  frozenRepair: boolean;
  current: { lines: MoneyLine[]; total: unknown };
  next: { lines: MoneyLine[]; total: unknown };
}): { status: number; body: { ok: false; code?: string; error: string } } | null {
  if (!["DRAFT", "SENT", "OPENED", "ACCEPTED"].includes(input.status)) {
    return { status: 400, body: { ok: false, error: `No se puede editar en estado ${input.status}.` } };
  }
  if (isStaleEdit(input.expectedUpdatedAt, input.updatedAt)) {
    return { status: 409, body: { ok: false, code: STALE_EDIT_CODE, error: STALE_EDIT_ERROR } };
  }
  if (frozenEditBlocked(input)) {
    return { status: 409, body: { ok: false, code: FROZEN_EDIT_CODE, error: "Pago congelado: descongela antes de editar" } };
  }
  return null;
}

// ── Filas guardadas: el precio al cliente no se mueve solo ──
type PriceRow = { unitPrice: number; clientPrice?: number; origLine?: EditableLine };

/**
 * Parche de una fila del constructor. En creación, cambiar coste o idioma deja el precio
 * en manos del margen (como siempre). En una fila del presupuesto guardado (keepClientPrice),
 * el precio al cliente se queda; recalcularlo es un botón explícito.
 */
export function patchRow<R extends PriceRow>(row: R, data: Partial<R>, keepClientPrice: boolean): R {
  const touchesCost = ["unitPrice", "sourceLang", "targetLang"].some((k) => k in data);
  if (keepClientPrice && row.origLine && touchesCost && data.clientPrice === undefined) return { ...row, ...data, clientPrice: row.clientPrice };
  return { ...row, ...data, ...(touchesCost && !("clientPrice" in data) ? { clientPrice: undefined } : {}) };
}

/** Nuevo coste por base (por palabra / por documento): igual que patchRow para el precio. */
export function withBasisCost<R extends PriceRow>(row: R, cost: number, keepClientPrice: boolean): R {
  if (row.unitPrice === cost) return row;
  return { ...row, unitPrice: cost, ...(keepClientPrice && row.origLine ? {} : { clientPrice: undefined }) };
}

/** Margen de una fila (precio − coste) y si queda por debajo del mínimo; sin coste no se juzga. */
export function rowMargin(clientEur: number, costEur: number): { marginEur: number; pct: number | null; low: boolean } {
  const marginEur = round2(clientEur - costEur);
  if (!(costEur > 0)) return { marginEur, pct: null, low: false };
  const pct = (marginEur / costEur) * 100;
  return { marginEur, pct, low: marginEur <= 0 || pct < MIN_AUTO_MARGIN_PCT };
}

/** Unir dos filas guardadas: precio y coste son la suma de las dos (no los de una sola). */
export function mergedSavedPrices(a: { unitPrice: number }, b: { unitPrice: number }, clientA: number, clientB: number) {
  return { unitPrice: round2((a.unitPrice || 0) + (b.unitPrice || 0)), clientPrice: round2(clientA + clientB), basis: undefined, unitCount: undefined, unitRate: undefined };
}

/** Parte numérica de la línea (cantidad × unitario, coste por unidad) — la usa composeLine. */
export function quoteLineAmounts(input: { basis?: string; unitCount?: number; clientPrice: number; cost: number }) {
  const count = input.basis === "unit" && input.unitCount && input.unitCount > 1 ? input.unitCount : 1;
  const perUnit = Math.round((input.clientPrice / count) * 100) / 100;
  const asUnits = count > 1 && Math.round(perUnit * count * 100) === Math.round(input.clientPrice * 100);
  return {
    quantity: asUnits ? count : 1,
    unitPrice: asUnits ? perUnit : input.clientPrice,
    supplierUnitCost: asUnits ? Math.round((input.cost / count) * 100) / 100 : input.cost,
  };
}

// ── Solicitud lavori pedida desde la página única: ¿queda atada al presupuesto? ──
export type AttachDecision = { atar: boolean; atada: boolean; motivo?: string };

export function attachDecision(input: {
  anchorQuoteId: string | null | undefined;
  lpr: { quoteId: string | null; par: string };
  quote: { par: string | null; editable: boolean } | null;
}): AttachDecision {
  const { anchorQuoteId, lpr, quote } = input;
  if (!anchorQuoteId) return { atar: false, atada: false };
  if (lpr.quoteId === anchorQuoteId) return { atar: false, atada: true };
  if (lpr.quoteId) return { atar: false, atada: false, motivo: "la solicitud ya está atada a otro presupuesto" };
  if (!quote) return { atar: false, atada: false, motivo: "presupuesto no encontrado" };
  if (!quote.editable) return { atar: false, atada: false, motivo: "el presupuesto ya no es editable" };
  if (quote.par !== lpr.par.toUpperCase()) {
    return { atar: false, atada: false, motivo: `el par guardado del presupuesto es ${quote.par || "—"} y la solicitud es ${lpr.par}: guarda primero` };
  }
  return { atar: true, atada: true };
}
