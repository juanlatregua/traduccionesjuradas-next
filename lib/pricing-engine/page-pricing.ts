// lib/pricing-engine/page-pricing.ts — Precio por PÁGINA del original (decisión
// de Juan, 8-oct-2026). Función pura y compartida: la usan el motor
// (calculator.ts), el diagnóstico de la puerta, el checkout, el builder de staff,
// el chatbot y el puente a lavori. Sin imports de servidor.
//
//  · FR→ES: 30 € + IVA por página. El traductor es Juan: coste 0, motor propio.
//  · DE→ES: 30 € + IVA por página; con TABLAS (notas, expedientes, extractos
//    bancarios) 35 €. Coste de Morton: 10 €/página, 15 € con tablas. El precio
//    sale AL MOMENTO (sin esperar a lavori) y al pagar el encargo va a Morton con
//    precio pactado (paraTi = coste).
//  · Solo documentos «por página» (certificados, actas, títulos, expedientes,
//    antecedentes, apostillas…). Contratos, escrituras y textos largos siguen
//    por palabra. ES→FR y ES→DE no se tocan (solo originales extranjeros).

import { clientPriceFromCost, round2 } from "../quote-math.ts";

export const PAGE_PRICE_EUR = 30;
export const PAGE_PRICE_DE_TABLES_EUR = 35;
export const PAGE_COST_DE_EUR = 10;
export const PAGE_COST_DE_TABLES_EUR = 15;

/** Idiomas con precio por página (siempre hacia el español). */
export const PAGE_PRICED_LANGS = new Set(["fr", "de"]);

/** Tipos (specific_type del análisis) que se cobran por página del original. */
export const PAGE_PRICED_TYPES = new Set([
  "birth_certificate",
  "marriage_certificate",
  "death_certificate",
  "criminal_record",
  "passport",
  "id_card",
  "degree",
  "transcript",
  "apostille",
  // El clasificador actual no los emite (caen en transcript/other); se dejan
  // para cuando el prompt los distinga, sin tocar el motor.
  "grades",
  "bank_statement",
]);

/** Tipos que implican tablas aunque el análisis no marque has_tables. */
export const TABLE_IMPLIED_TYPES = new Set(["transcript", "grades", "bank_statement"]);

export type PagePricing = {
  pages: number;
  tables: boolean;
  pricePerPage: number;
  priceEur: number; // precio CLIENTE sin IVA (total del documento)
  costPerPage: number; // coste del traductor por página (0 = Juan)
  costEur: number; // coste del traductor sin IVA (total del documento)
};

export function isPagePricedType(specificType: string | null | undefined): boolean {
  return PAGE_PRICED_TYPES.has(String(specificType || "").trim().toLowerCase());
}

/** ¿El documento lleva tablas? has_tables del análisis de IA, o por tipo. */
export function detectTables(input: {
  specificType?: string | null;
  hasTables?: boolean | null;
}): boolean {
  if (input.hasTables === true) return true;
  return TABLE_IMPLIED_TYPES.has(String(input.specificType || "").trim().toLowerCase());
}

/** Páginas facturables: mínimo 1, enteras. */
export function billablePages(pages: number | null | undefined): number {
  const n = Math.floor(Number(pages));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Precio por página, o null si el documento no entra (otro idioma, original en
 * español, tipo «por palabra»). `inbound` = el original NO está en español.
 */
export function computePagePricing(input: {
  specificType: string | null | undefined;
  foreignLang: string | null | undefined;
  inbound: boolean;
  pages: number | null | undefined;
  hasTables?: boolean | null;
}): PagePricing | null {
  const lang = String(input.foreignLang || "").trim().toLowerCase();
  if (!input.inbound || !PAGE_PRICED_LANGS.has(lang)) return null;
  if (!isPagePricedType(input.specificType)) return null;
  const pages = billablePages(input.pages);
  const tables = lang === "de" && detectTables({ specificType: input.specificType, hasTables: input.hasTables });
  const pricePerPage = tables ? PAGE_PRICE_DE_TABLES_EUR : PAGE_PRICE_EUR;
  const costPerPage = lang === "de" ? (tables ? PAGE_COST_DE_TABLES_EUR : PAGE_COST_DE_EUR) : 0;
  return {
    pages,
    tables,
    pricePerPage,
    priceEur: round2(pages * pricePerPage),
    costPerPage,
    costEur: round2(pages * costPerPage),
  };
}

type QuoteLike = { basePrice: number; urgentPrice: number; pagePricing?: PagePricing | null };

/** Precio CLIENTE sin IVA de un Quote del motor. Con tarifa por página el motor
 * ya devuelve el precio de venta (no un coste): NO se le añade el margen tiered. */
export function clientBaseFromQuote(quote: QuoteLike, foreignLang: string | null | undefined): number {
  return quote.pagePricing ? round2(quote.basePrice) : clientPriceFromCost(quote.basePrice, foreignLang);
}

export function clientUrgentFromQuote(quote: QuoteLike, foreignLang: string | null | undefined): number {
  return quote.pagePricing ? round2(quote.urgentPrice) : clientPriceFromCost(quote.urgentPrice, foreignLang);
}

/** ¿Esta línea de presupuesto (precio cliente, coste del traductor) es la
 * tarifa por página DE→ES de Morton? 30·n ↔ 10·n, o 35·n ↔ 15·n, n entero. El
 * coste viene de una tarifa pactada, no inventado: no necesita solicitud previa
 * en el canal (ver verifyTranslatorChannelPrice) ni suelo de 40 €/doc. */
export function isDePageTariffLine(unitPriceEur: number, supplierCostEur: number | null | undefined): boolean {
  const price = Math.round(Number(unitPriceEur) * 100);
  const cost = Math.round(Number(supplierCostEur) * 100);
  if (!(price > 0) || !(cost > 0)) return false;
  const match = (pp: number, cp: number) =>
    price % (pp * 100) === 0 && cost % (cp * 100) === 0 && price / (pp * 100) === cost / (cp * 100);
  return match(PAGE_PRICE_EUR, PAGE_COST_DE_EUR) || match(PAGE_PRICE_DE_TABLES_EUR, PAGE_COST_DE_TABLES_EUR);
}

/** ¿Todas las líneas con precio son la tarifa por página DE→ES (30↔10 / 35↔15 por página)? */
export function isDePageTariffQuote(input: {
  sourceLang: string | null | undefined;
  targetLang: string | null | undefined;
  lines: Array<{ quantity: number; unitPrice: number; supplierUnitCost?: number | null }>;
}): boolean {
  const src = String(input.sourceLang || "").trim().toLowerCase();
  const tgt = String(input.targetLang || "").trim().toLowerCase();
  if (src !== "de" || tgt !== "es") return false;
  const priced = input.lines.filter((l) => Number(l.unitPrice) > 0);
  return (
    priced.length > 0 &&
    priced.every((l) => (Number(l.quantity) || 1) === 1 && isDePageTariffLine(Number(l.unitPrice), l.supplierUnitCost))
  );
}

export type DePagePactado = { costCents: number; pages: number; tablePages: number; priceCents: number };

/** Coste pactado con Morton (paraTi) de un pedido DE→ES por página: suma del
 * coste de cada documento. null si algún documento NO es DE→ES «por página» (en
 * ese caso no hay precio pactado y el pedido sigue el flujo de siempre). */
export function dePagePactado(
  docs: Array<{ specificType?: string | null; sourceLang?: string | null; pages?: number | null; hasTables?: boolean | null }>
): DePagePactado | null {
  if (docs.length === 0) return null;
  let costCents = 0;
  let priceCents = 0;
  let pages = 0;
  let tablePages = 0;
  for (const d of docs) {
    const p = computePagePricing({
      specificType: d.specificType,
      foreignLang: d.sourceLang,
      inbound: String(d.sourceLang || "").trim().toLowerCase() !== "es",
      pages: d.pages,
      hasTables: d.hasTables,
    });
    if (!p || p.costPerPage <= 0) return null;
    costCents += Math.round(p.costEur * 100);
    priceCents += Math.round(p.priceEur * 100);
    pages += p.pages;
    if (p.tables) tablePages += p.pages;
  }
  return { costCents, priceCents, pages, tablePages };
}
