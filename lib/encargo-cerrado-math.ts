// lib/encargo-cerrado-math.ts — ENCARGO CERRADO (orden Juan 21-nov-2026): el
// presupuesto sale con la regla de coste de cada jurado, sin pedirle precio antes;
// al pagar, el jurado recibe el encargo listo con coste y plazo fijos. Puro.

import { autoClientPriceCentsFromCost } from "./quote-math.ts";
import { DOC_FLOOR_CENTS, roundUpEuro, roundDownEuro, canAutoQuote, marginPctOf, MIN_AUTO_MARGIN_PCT } from "./learned-rates-math.ts";
import { DIRECT_AUTO_MAX_CENTS, spreadCents } from "./lavori-directo-math.ts";

export const ENCARGO_CERRADO_AUTO_PRICED_BY = "encargo-cerrado";

// Plazo de reserva si el jurado tiene <3 plazos en su historial (medianas medidas el 21-nov).
export const ENCARGO_CERRADO_JURADOS: Record<string, { miembroId: string; nombre: string; plazoReservaDias: number }> = {
  pt: { miembroId: "nhucqnd3q4znddxhe8qs5c51", nombre: "Cristina Aguilera Viladés", plazoReservaDias: 2 },
  en: { miembroId: "exwzhhwv5fyegllvblt76uvb", nombre: "María Lourdes Yagüe Lobo", plazoReservaDias: 2 },
  de: { miembroId: "ngus1uku6x5uw2pqbmflpbbt", nombre: "Morton Sebastian Peter Münster", plazoReservaDias: 2 },
};

/** ENCARGO_CERRADO=pt,en,de (lista); vacío u "off" = apagado (comportamiento de siempre). */
export function encargoCerradoLangs(raw: string | null | undefined): Set<string> {
  const v = String(raw || "").trim().toLowerCase();
  if (!v || v === "off" || v === "none") return new Set();
  return new Set(v.split(",").map((x) => x.trim()).filter((x) => x in ENCARGO_CERRADO_JURADOS));
}

/** ENCARGO_CERRADO_AUTOSEND=on: lo que cumple la regla sale solo; si no, borrador + aviso a Juan. */
export function isEncargoCerradoAutosend(raw: string | null | undefined): boolean {
  return String(raw || "").trim().toLowerCase() === "on";
}

/** Presupuesto con coste cerrado por regla (el carril, o el montado a mano con la regla, p. ej. 2026-00413). */
export function isEncargoCerradoQuote(autoPricedBy: string | null | undefined): boolean {
  const v = String(autoPricedBy || "");
  return v === ENCARGO_CERRADO_AUTO_PRICED_BY || v.startsWith("regla-");
}

export type ClosedDoc = {
  docType: string;
  words: number | null;
  apostille: boolean;
  /** Tipo legible del análisis (specific_type_es) y nombre del archivo: solo para detectar el carnet de conducir. */
  label?: string | null;
  fileName?: string | null;
};

export type ClosedCostResult =
  | { ok: true; lang: string; miembroId: string; nombre: string; costs: number[]; regla: string }
  | { ok: false; reason: string };

const DRIVING_RE = /permiso de conducir|carn[eé] de conducir|licencia de conduc|f(ü|ue)hrerschein|driving licen[cs]e|driver'?s licen[cs]e/i;

export function isDrivingLicence(d: Pick<ClosedDoc, "label" | "fileName">): boolean {
  return DRIVING_RE.test(`${d.label || ""} ${d.fileName || ""}`);
}

// PT>ES Cristina: documento suelto max(40 €, 0,09 €/pal.); lote con más de 4000 palabras, 0,058 €/pal. sobre el total.
export const PT_WORD_CENTS = 9;
export const PT_BATCH_WORD_CENTS = 5.8;
export const PT_BATCH_MIN_WORDS = 4000;
// EN>ES Lourdes: 35 € el documento corto, uno solo.
export const EN_SHORT_DOC_CENTS = 3500;
export const EN_SHORT_MAX_WORDS = 750;
const EN_SHORT_TYPES = new Set(["birth_certificate", "marriage_certificate", "death_certificate", "criminal_record", "id_card", "passport", "degree"]);
// DE>ES Morton: SOLO su lista del 3-sep; nunca por palabra.
export const DE_LIST_CENTS = { criminal_record: 1500, id_card: 1000, passport: 1000, driving_licence: 1000, apostille: 1000 } as const;
export const DE_MAX_WORDS = 1000; // por encima, un «penal» o un DNI es otra cosa: a ciegas

function deListCents(d: ClosedDoc): number | null {
  if (d.docType === "apostille") return DE_LIST_CENTS.apostille;
  const base =
    d.docType === "criminal_record" ? DE_LIST_CENTS.criminal_record
    : d.docType === "id_card" || d.docType === "passport" ? DE_LIST_CENTS.id_card
    : isDrivingLicence(d) ? DE_LIST_CENTS.driving_licence
    : null;
  if (base == null) return null;
  return base + (d.apostille ? DE_LIST_CENTS.apostille : 0);
}

/** Coste BASE por documento según la regla del jurado del par; null-razón si el caso no la cumple. */
export function closedCostFor(sourceLang: string | null | undefined, targetLang: string | null | undefined, docs: ClosedDoc[]): ClosedCostResult {
  const s = String(sourceLang || "").toLowerCase();
  const t = String(targetLang || "es").toLowerCase();
  if (docs.length === 0) return { ok: false, reason: "sin documentos" };
  if (t !== "es") return { ok: false, reason: `${s.toUpperCase()}>${t.toUpperCase()}: la regla solo cubre hacia español` };
  const j = ENCARGO_CERRADO_JURADOS[s];
  if (!j) return { ok: false, reason: `${s.toUpperCase()}>ES sin regla de encargo cerrado` };
  const base = { lang: s, miembroId: j.miembroId, nombre: j.nombre };

  if (s === "pt") {
    if (docs.some((d) => !(d.words && d.words > 0))) return { ok: false, reason: "PT: falta el conteo de palabras de algún documento" };
    const words = docs.map((d) => d.words as number);
    const total = words.reduce((a, w) => a + w, 0);
    if (docs.length > 1 && total > PT_BATCH_MIN_WORDS) {
      return { ok: true, ...base, costs: spreadCents(Math.round(total * PT_BATCH_WORD_CENTS), words), regla: `lote ${total} pal. × 0,058 €` };
    }
    return { ok: true, ...base, costs: words.map((w) => Math.max(DOC_FLOOR_CENTS, Math.round(w * PT_WORD_CENTS))), regla: "por documento max(40 €, 0,09 €/pal.)" };
  }

  if (s === "en") {
    if (docs.length !== 1) return { ok: false, reason: "EN: lote de 2+ documentos, precio de Lourdes" };
    const d = docs[0];
    if (!EN_SHORT_TYPES.has(d.docType) && !isDrivingLicence(d)) return { ok: false, reason: `EN: tipo ${d.docType} no es documento corto (certificado, identidad, título)` };
    if (!(d.words && d.words > 0)) return { ok: false, reason: "EN: sin conteo de palabras" };
    if (d.words > EN_SHORT_MAX_WORDS) return { ok: false, reason: `EN: ${d.words} pal. (> ${EN_SHORT_MAX_WORDS}), precio de Lourdes` };
    return { ok: true, ...base, costs: [EN_SHORT_DOC_CENTS], regla: "documento corto 35 €" };
  }

  if (s === "de") {
    const costs: number[] = [];
    for (const d of docs) {
      const c = deListCents(d);
      if (c == null) return { ok: false, reason: `DE: ${d.docType} fuera de la lista de Morton: a ciegas` };
      if (d.words && d.words > DE_MAX_WORDS) return { ok: false, reason: `DE: ${d.words} pal. en ${d.docType}: a ciegas` };
      costs.push(c);
    }
    return { ok: true, ...base, costs, regla: "lista de Morton (3-sep)" };
  }
  return { ok: false, reason: `${s.toUpperCase()}>ES sin regla` };
}

/** Precio al cliente por documento: tarifa APROBADA si la hay (nunca por debajo de la regla de margen), si no autoClientPriceFromCost. */
export function closedQuoteLines(costs: number[], tariffCents: (number | null | undefined)[] = []): { clientCents: number; costCents: number }[] {
  return costs.map((costCents, i) => {
    const minimo = roundUpEuro(autoClientPriceCentsFromCost(costCents, DOC_FLOOR_CENTS));
    const tariff = tariffCents[i];
    return { costCents, clientCents: tariff && tariff > 0 ? Math.max(minimo, roundDownEuro(tariff)) : minimo };
  });
}

export type ClosedVerdict =
  | { ok: true; subtotalCents: number; costCents: number; marginPct: number; overCap: boolean }
  | { ok: false; reason: string };

/** Freno de margen (≥10 % en cada línea y en el total) y tope automático de 300 € netos. */
export function evaluateClosedQuote(lines: { clientCents: number; costCents: number }[]): ClosedVerdict {
  if (lines.length === 0) return { ok: false, reason: "sin líneas" };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!(l.costCents > 0)) return { ok: false, reason: `documento ${i + 1} sin coste` };
    if (!canAutoQuote(l.clientCents, l.costCents)) {
      return { ok: false, reason: `margen insuficiente en documento ${i + 1}: ${(l.clientCents / 100).toFixed(2)} € − ${(l.costCents / 100).toFixed(2)} €` };
    }
  }
  const subtotalCents = lines.reduce((a, l) => a + l.clientCents, 0);
  const costCents = lines.reduce((a, l) => a + l.costCents, 0);
  const marginPct = marginPctOf(subtotalCents, costCents);
  if (marginPct < MIN_AUTO_MARGIN_PCT) return { ok: false, reason: `margen total ${marginPct.toFixed(0)} % (< ${MIN_AUTO_MARGIN_PCT} %)` };
  return { ok: true, subtotalCents, costCents, marginPct: Math.round(marginPct), overCap: subtotalCents > DIRECT_AUTO_MAX_CENTS };
}

/** Mediana de los plazos que dio el jurado; con <3 muestras, su plazo de reserva. */
export function medianPlazoDias(values: (number | null | undefined)[], fallback: number, minSamples = 3): number {
  const v = values.filter((x): x is number => typeof x === "number" && x > 0).sort((a, b) => a - b);
  if (v.length < minSamples) return fallback;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.ceil((v[mid - 1] + v[mid]) / 2);
}

export function closedDeliveryTerm(plazoDias: number): string {
  return `${plazoDias}-${plazoDias + 1} días hábiles`;
}

/** Solicitudes de precio que siguen vivas sin adjudicar y que el encargo cerrado debe retirar al pagar. */
export const CLOSED_RETIRE_STATUSES = ["SENT", "PRICED"] as const;

/** Filtro de esas solicitudes: mismo par y mismo caso (presupuesto, caso, expediente o la ref del lead que lo originó). */
export function closedRetireWhere(quote: { id: string; casoId: string | null; expedienteRef: string | null }, par: string) {
  return {
    par,
    status: { in: [...CLOSED_RETIRE_STATUSES] },
    OR: [
      { quoteId: quote.id },
      ...(quote.casoId ? [{ casoId: quote.casoId }] : []),
      ...(quote.expedienteRef ? [{ expedienteRef: quote.expedienteRef }, { ref: quote.expedienteRef }] : []),
    ],
  };
}
