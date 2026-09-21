// lib/lavori-directo-math.ts — Aritmética del FUNNEL DIRECTO tj.net→lavori
// (Juan, 15-sep-2026). Para ciertas lenguas hay un jurado DIRECTO: la puerta le
// lanza la solicitud de precio SOLO a él y, cuando llega su precio_propuesto
// (cifra + plazo), el presupuesto se monta con +20 % sobre su BASE. Puro, sin
// imports de servidor — mismo espíritu que lib/learned-rates-math.ts.

import { DOC_FLOOR_CENTS, SIZE_TOLERANCE, roundUp50, canAutoQuote, priceDocWithRate } from "./learned-rates-math.ts";

export { DOC_FLOOR_CENTS, roundUp50, canAutoQuote };

export const DIRECT_MARGIN_PCT = 20;
export const DIRECT_AUTO_MAX_CENTS = 30000; // 300 € netos, tope del carril directo
export const DIRECT_FALLBACK_HOURS = 6;

export type PriceBasis = "base" | "payable_iva_irpf";

/** El jurado da su cifra en dos formatos: "base" (neta, tal cual) o el líquido
 * a cobrar (base + 21 % IVA − 15 % IRPF = base × 1,06). Verificado con
 * facturas reales: Daniela cobra 100 € líquidos sobre una base de 94,34 €. */
export function channelPriceToBaseCents(priceCents: number, basis: PriceBasis): number {
  if (basis === "base") return priceCents;
  return Math.round(priceCents / 1.06);
}

/** La inversa: una base (coste del tarifario) expresada en el formato en que
 * cotiza el jurado. channelPriceToBaseCents(baseToChannelPriceCents(b)) === b. */
export function baseToChannelPriceCents(baseCents: number, basis: PriceBasis): number {
  if (basis === "base") return baseCents;
  return Math.round(baseCents * 1.06);
}

/** ¿La solicitud es del carril directo de la puerta (en cualquiera de sus estados)? */
export function isDirectLeadRequest(createdBy: string | null | undefined): boolean {
  return String(createdBy || "").startsWith("puerta-directo");
}

/** Gana el PRIMER precio en el carril directo (orden Juan 21-sep-2026): con
 * cifra ya puesta solo se acepta la corrección del MISMO jurado. Fuera del
 * carril directo, la última cifra pisa (comportamiento de siempre). */
export function acceptsNewPrice(
  current: { priceCents: number | null; miembroId: string | null; createdBy: string | null },
  incomingMiembroId: string | null
): boolean {
  if (!isDirectLeadRequest(current.createdBy) || current.priceCents == null) return true;
  return !!current.miembroId && current.miembroId === incomingMiembroId;
}

/** Una aceptación de otro jurado distinto del que dio la cifra no se mezcla con ella. */
export function acceptanceMatchesPrice(
  current: { priceCents: number | null; miembroId: string | null },
  incomingMiembroId: string | null
): boolean {
  if (current.priceCents == null || !current.miembroId || !incomingMiembroId) return true;
  return current.miembroId === incomingMiembroId;
}

export type CifraDoc = {
  docType: string | null;
  words: number | null;
  rate: { unit: string; costCents: number; wordsRef: number | null } | null;
};

const TIPOS_DESCONOCIDOS = new Set(["", "other", "unknown", "any"]);

/** Cifra orientativa de una solicitud de precio (orden Juan 21-sep-2026): el
 * coste que ya se pagó por esos mismos tipos de documento. Solo si TODOS los
 * documentos tienen tipo conocido y tarifa con coste; si falta uno, null. */
export function proposedCostCents(docs: CifraDoc[], basis: PriceBasis): number | null {
  if (docs.length === 0) return null;
  let total = 0;
  for (const d of docs) {
    if (TIPOS_DESCONOCIDOS.has(String(d.docType || "").trim().toLowerCase())) return null;
    const r = d.rate;
    if (!r || !(r.costCents > 0)) return null;
    if (r.unit === "kword" && !(d.words && d.words > 0)) return null;
    if (r.unit === "doc" && r.wordsRef && d.words && Math.abs(d.words - r.wordsRef) / r.wordsRef > SIZE_TOLERANCE) return null;
    total += priceDocWithRate({ unit: r.unit, costCents: r.costCents, clientCents: null }, d.words).costCents;
  }
  return baseToChannelPriceCents(total, basis);
}

/** Reparte la base del jurado entre los documentos del expediente, proporcional
 * a palabras (a partes iguales si algún documento no trae palabras). El último
 * documento absorbe el redondeo para que la suma de costes sea EXACTA. Precio
 * al cliente por documento: +20 % sobre su coste, con el mismo suelo de 40 €
 * netos/doc del tarifario aprendido. */
export function spreadCents(baseCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const total = weights.reduce((a, w) => a + (w > 0 ? w : 0), 0);
  const equalParts = total <= 0 || weights.some((w) => !w || w <= 0);
  const shares = equalParts ? weights.map(() => baseCents / n) : weights.map((w) => (baseCents * w) / total);
  const out: number[] = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      out.push(baseCents - assigned);
    } else {
      const c = Math.round(shares[i]);
      out.push(c);
      assigned += c;
    }
  }
  return out;
}

/** Precio al cliente de una línea cuando ya se conoce el coste real del jurado:
 * manda el precio del MOTOR (el que Juan ya tiene puesto en el borrador) y solo
 * se sube si con ese precio el margen no llega (+20 %, suelo de 40 €/doc). */
export function clientCentsWithMotorPrice(motorCents: number, costCents: number): number {
  const minimo = Math.max(DOC_FLOOR_CENTS, roundUp50(costCents * (1 + DIRECT_MARGIN_PCT / 100)));
  if (motorCents <= 0) return minimo;
  return canAutoQuote(motorCents, costCents) && motorCents >= minimo ? motorCents : minimo;
}

export function directQuoteLines(
  baseCents: number,
  docs: { words: number | null }[]
): { clientCents: number; costCents: number }[] {
  const n = docs.length;
  if (n === 0) return [];
  const costs = spreadCents(baseCents, docs.map((d) => (d.words && d.words > 0 ? d.words : 0)));
  return costs.map((costCents) => ({
    costCents,
    clientCents: Math.max(DOC_FLOOR_CENTS, roundUp50(costCents * (1 + DIRECT_MARGIN_PCT / 100))),
  }));
}

/** ¿La cifra €/palabra de este jurado se sale de madre frente a su propio
 * historial? Sin madurez del historial (<3 muestras) no se afirma nada. */
export function isAnomalousPrice(centsPerWord: number, historyCentsPerWord: number[]): boolean {
  if (historyCentsPerWord.length < 3) return false;
  const sorted = [...historyCentsPerWord].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return centsPerWord > 2 * median;
}

/** Estados desde los que el staff puede DESCARTAR una solicitud de precio de
 * lead sin presupuesto (botón "Descartar" en /zona-traductor/presupuestos):
 * SENT (esperando precio) o PRICED (con precio pero sin montar presupuesto).
 * ACCEPTED/ESCALATED/DISCARDED quedan fuera del alcance del botón. */
export function isDiscardableLeadStatus(status: string): boolean {
  return status === "SENT" || status === "PRICED";
}

/** Guardia ALTA 1 (Juan, 15-sep-2026, revisión adversarial): una cifra que el
 * jurado cambia DESPUÉS de que el presupuesto ya salió no puede comunicarse
 * como aceptación si supera lo que las líneas ya tienen presupuestado como
 * coste — tolerancia de 1 céntimo de redondeo, mismo patrón que
 * evaluateChannelPrice en learned-rates-math.ts. */
export function exceedsQuotedCost(basePriceCents: number, quotedCostCents: number): boolean {
  return basePriceCents > quotedCostCents + 1;
}
