// lib/lavori-directo-math.ts — Aritmética del FUNNEL DIRECTO tj.net→lavori
// (Juan, 15-sep-2026). Para ciertas lenguas hay un jurado DIRECTO: la puerta le
// lanza la solicitud de precio SOLO a él y, cuando llega su precio_propuesto
// (cifra + plazo), el presupuesto se monta con +20 % sobre su BASE. Puro, sin
// imports de servidor — mismo espíritu que lib/learned-rates-math.ts.

import { DOC_FLOOR_CENTS, roundUp50, canAutoQuote } from "./learned-rates-math.ts";

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

/** Reparte la base del jurado entre los documentos del expediente, proporcional
 * a palabras (a partes iguales si algún documento no trae palabras). El último
 * documento absorbe el redondeo para que la suma de costes sea EXACTA. Precio
 * al cliente por documento: +20 % sobre su coste, con el mismo suelo de 40 €
 * netos/doc del tarifario aprendido. */
export function directQuoteLines(
  baseCents: number,
  docs: { words: number | null }[]
): { clientCents: number; costCents: number }[] {
  const n = docs.length;
  if (n === 0) return [];
  const totalWords = docs.reduce((a, d) => a + (d.words && d.words > 0 ? d.words : 0), 0);
  const equalParts = totalWords <= 0 || docs.some((d) => !d.words || d.words <= 0);
  const shares = equalParts ? docs.map(() => baseCents / n) : docs.map((d) => (baseCents * (d.words as number)) / totalWords);

  const costs: number[] = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      costs.push(baseCents - assigned);
    } else {
      const c = Math.round(shares[i]);
      costs.push(c);
      assigned += c;
    }
  }
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

/** Guardia ALTA 1 (Juan, 15-sep-2026, revisión adversarial): una cifra que el
 * jurado cambia DESPUÉS de que el presupuesto ya salió no puede comunicarse
 * como aceptación si supera lo que las líneas ya tienen presupuestado como
 * coste — tolerancia de 1 céntimo de redondeo, mismo patrón que
 * evaluateChannelPrice en learned-rates-math.ts. */
export function exceedsQuotedCost(basePriceCents: number, quotedCostCents: number): boolean {
  return basePriceCents > quotedCostCents + 1;
}
