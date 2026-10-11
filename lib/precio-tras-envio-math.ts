// lib/precio-tras-envio-math.ts — La cifra del jurado llega DESPUÉS de enviar el
// presupuesto (Florian 2026-00250, Bianca 2026-00245, 11-oct-2026). Puro: decide
// qué hacer con el coste real sin tocar el precio al cliente.
//   ok           → margen ≥ mínimo: se escribe el coste real en las líneas.
//   margen_bajo  → 0 ≤ margen < mínimo: se escribe igual, aviso por dos canales.
//   perdida      → margen < 0: NO se escribe (el freno ALTA 1(b) sigue mirando el
//                  coste estimado) y se congela el pago.

import { MIN_AUTO_MARGIN_PCT, marginPctOf } from "./learned-rates-math.ts";
import { spreadCents } from "./lavori-directo-math.ts";

export const SENT_PRICE_STATUSES = ["SENT", "OPENED", "ACCEPTED"] as const;

export type SentPriceLine = { quantity: number; unitPrice: number; supplierUnitCost: number | null };

export type SentPriceDecision = {
  kind: "ok" | "margen_bajo" | "perdida";
  clientBaseCents: number;
  realCostCents: number;
  estimatedCostCents: number;
  marginCents: number;
  marginPct: number;
  estimatedMarginCents: number;
  /** El margen real es peor que el que se calculó con el coste estimado. */
  marginDown: boolean;
  /** Coste unitario nuevo por línea (céntimos), en el orden de entrada; null si no se escribe. */
  newLineCostCents: number[] | null;
  /** Por qué no se reparte el coste en las líneas (lo hace el staff a mano). */
  noSpreadReason: string | null;
  /** Las líneas ya tienen exactamente ese coste: evento repetido, nada que hacer. */
  unchanged: boolean;
};

const cents = (n: number | null | undefined) => Math.round((Number(n) || 0) * 100);

export function decideSentQuotePrice(input: {
  lines: SentPriceLine[];
  discountCents: number;
  realCostCents: number;
  /** Otra solicitud con precio atada al mismo presupuesto: no se sabe qué línea es de quién. */
  otherPricedRequests?: boolean;
}): SentPriceDecision {
  const lineTotal = (l: SentPriceLine, unit: number | null | undefined) => Math.round((Number(l.quantity) || 1) * (Number(unit) || 0) * 100);
  const clientBaseCents = input.lines.reduce((a, l) => a + lineTotal(l, l.unitPrice), 0) - Math.max(0, Math.round(input.discountCents || 0));
  const estimatedCostCents = input.lines.reduce((a, l) => a + lineTotal(l, l.supplierUnitCost), 0);
  const realCostCents = Math.max(0, Math.round(input.realCostCents));
  const marginCents = clientBaseCents - realCostCents;
  const marginPct = marginPctOf(clientBaseCents, realCostCents);
  const estimatedMarginCents = clientBaseCents - estimatedCostCents;
  const kind: SentPriceDecision["kind"] =
    marginCents < 0 ? "perdida" : marginCents > 0 && marginPct >= MIN_AUTO_MARGIN_PCT ? "ok" : "margen_bajo";
  const marginDown = estimatedCostCents > 0 ? marginCents < estimatedMarginCents : kind !== "ok";

  let noSpreadReason: string | null = null;
  let newLineCostCents: number[] | null = null;
  if (kind !== "perdida") {
    const conPrecio = input.lines.map((l, i) => ({ l, i })).filter(({ l }) => cents(l.unitPrice) > 0);
    if (input.otherPricedRequests) noSpreadReason = "hay otra solicitud con precio atada a este presupuesto";
    else if (input.lines.some((l) => Number(l.quantity) !== 1)) noSpreadReason = "hay líneas con cantidad distinta de 1";
    else if (conPrecio.length === 0) noSpreadReason = "el presupuesto no tiene líneas con precio";
    else {
      // Mismo reparto que el relleno del borrador (lib/lavori-quote-fill): pesos = coste
      // estimado de cada línea; a falta de él, su precio. Las líneas a 0 € no cargan coste.
      const previos = conPrecio.map(({ l }) => cents(l.supplierUnitCost));
      const pesos = previos.some((c) => c > 0) ? previos : conPrecio.map(({ l }) => cents(l.unitPrice));
      const reparto = spreadCents(realCostCents, pesos);
      newLineCostCents = input.lines.map((l) => cents(l.supplierUnitCost));
      conPrecio.forEach(({ i }, k) => {
        newLineCostCents![i] = reparto[k];
      });
    }
  }
  const unchanged = newLineCostCents != null && newLineCostCents.every((c, i) => c === cents(input.lines[i].supplierUnitCost));
  return {
    kind,
    clientBaseCents,
    realCostCents,
    estimatedCostCents,
    marginCents,
    marginPct,
    estimatedMarginCents,
    marginDown,
    newLineCostCents,
    noSpreadReason,
    unchanged,
  };
}

/** Clave de la congelación: el mismo evento repetido no vuelve a congelar ni a avisar. */
export function freezeKeyFor(leadRef: string, priceCents: number, miembroId: string | null | undefined): string {
  return `${leadRef}:${priceCents}:${miembroId || "-"}`;
}

/** ¿Hay que congelar? Solo con pérdida y si no lo congeló ya esta misma cifra. */
export function shouldFreeze(decision: Pick<SentPriceDecision, "kind">, quote: { paymentFrozenAt: Date | null; paymentFreezeKey: string | null }, key: string): boolean {
  if (decision.kind !== "perdida") return false;
  return !(quote.paymentFreezeKey === key);
}

/** Presupuesto vivo para este carril: enviado, sin cobrar y sin pedido. */
export function isUnpaidSentQuote(q: { status: string; paidAt: Date | null; ordersCount: number }): boolean {
  return (SENT_PRICE_STATUSES as readonly string[]).includes(q.status) && !q.paidAt && q.ordersCount === 0;
}

/** Pago bloqueado: congelado y aún sin cobrar. */
export function isPaymentFrozen(q: { paymentFrozenAt: Date | null; paidAt?: Date | null }): boolean {
  return Boolean(q.paymentFrozenAt) && !q.paidAt;
}

export const FROZEN_PAYMENT_ERROR = "Estamos actualizando tu presupuesto; te escribimos en breve.";
