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
  /** Líneas que no son de esta solicitud (otro par, apostilla…): ver foreignLinesReason. */
  foreignLinesReason?: string | null;
}): SentPriceDecision {
  const lineTotal = (l: SentPriceLine, unit: number | null | undefined) => Math.round((Number(l.quantity) || 1) * (Number(unit) || 0) * 100);
  const clientBaseCents = input.lines.reduce((a, l) => a + lineTotal(l, l.unitPrice), 0) - Math.max(0, Math.round(input.discountCents || 0));
  const estimatedCostCents = input.lines.reduce((a, l) => a + lineTotal(l, l.supplierUnitCost), 0);
  const realCostCents = Math.max(0, Math.round(input.realCostCents));
  const marginCents = clientBaseCents - realCostCents;
  const marginPct = marginPctOf(clientBaseCents, realCostCents);
  const estimatedMarginCents = clientBaseCents - estimatedCostCents;
  // Margen ≤ 0 = pérdida (a cero también se pierde: comisiones, IVA de gastos…).
  // Con líneas ajenas a la solicitud el margen no es fiable: como mucho «margen bajo».
  const kind: SentPriceDecision["kind"] =
    marginCents <= 0
      ? "perdida"
      : marginPct >= MIN_AUTO_MARGIN_PCT && !input.foreignLinesReason
        ? "ok"
        : "margen_bajo";
  const marginDown = estimatedCostCents > 0 ? marginCents < estimatedMarginCents : kind !== "ok";

  let noSpreadReason: string | null = null;
  let newLineCostCents: number[] | null = null;
  if (kind !== "perdida") {
    const conPrecio = input.lines.map((l, i) => ({ l, i })).filter(({ l }) => cents(l.unitPrice) > 0);
    if (input.foreignLinesReason) noSpreadReason = input.foreignLinesReason;
    else if (input.otherPricedRequests) noSpreadReason = "hay otra solicitud con precio atada a este presupuesto";
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

/** ¿Hay que congelar? Solo con pérdida y si no lo congeló ya esta misma cifra (la clave
 *  solo sobrevive a «Desbloquear igualmente»; un margen correcto la borra). */
export function shouldFreeze(decision: Pick<SentPriceDecision, "kind">, quote: { paymentFreezeKey: string | null; paymentFrozenAt?: Date | null }, key: string): boolean {
  if (decision.kind !== "perdida") return false;
  return quote.paymentFreezeKey !== key;
}

export type FreezeState = { paymentFrozenAt: Date | null; paymentFreezeKey: string | null };

/** Estado de congelación tras una cifra: pérdida nueva congela con su clave; margen
 *  correcto descongela y BORRA la clave (X pérdida → Y ok → X otra vez vuelve a congelar). */
export function nextFreezeState(state: FreezeState, decision: Pick<SentPriceDecision, "kind">, key: string, now: Date): { state: FreezeState; action: "freeze" | "repetido" | "clear" } {
  if (decision.kind === "perdida") {
    return shouldFreeze(decision, state, key) ? { state: { paymentFrozenAt: now, paymentFreezeKey: key }, action: "freeze" } : { state, action: "repetido" };
  }
  return { state: { paymentFrozenAt: null, paymentFreezeKey: null }, action: "clear" };
}

const LANG_PAIR_RE = /\(([^\s,()→]+)\s*→\s*([^\s,()]+)/g;

/** Líneas del presupuesto que no son de esta solicitud: otro par, más de un par, apostillas.
 *  Entonces la cifra del jurado no se puede repartir sola. */
export function foreignLinesReason(input: { descriptions: string[]; leadPar: string; sourceLang: string; targetLang: string }): string | null {
  const norm = (p: string) => p.replace("->", ">").replace(/\s+/g, "").toUpperCase();
  const quotePar = norm(`${input.sourceLang}>${input.targetLang}`);
  if (input.leadPar && norm(input.leadPar) !== quotePar) return `el par de la solicitud (${norm(input.leadPar)}) no es el del presupuesto (${quotePar})`;
  if (input.descriptions.some((d) => /apostill/i.test(d))) return "hay líneas de apostilla";
  const pares = new Set<string>();
  for (const d of input.descriptions) for (const m of d.matchAll(LANG_PAIR_RE)) pares.add(`${m[1].toLowerCase()}→${m[2].toLowerCase()}`);
  if (pares.size > 1) return `hay líneas de más de un par (${Array.from(pares).join(", ")})`;
  return null;
}

/** Presupuesto vivo para este carril: enviado y sin cobrar. Un pedido SIN pagar (transferencia
 *  declarada, crédito) no lo saca: también se congela, y la confirmación manual no asigna sola. */
export function isUnpaidSentQuote(q: { status: string; paidAt: Date | null; paidOrdersCount: number }): boolean {
  return (SENT_PRICE_STATUSES as readonly string[]).includes(q.status) && !q.paidAt && q.paidOrdersCount === 0;
}

export function isSentPriceStatus(status: string | null | undefined): boolean {
  return (SENT_PRICE_STATUSES as readonly string[]).includes(String(status || ""));
}

/** Pago bloqueado: congelado y aún sin cobrar. */
export function isPaymentFrozen(q: { paymentFrozenAt: Date | null; paidAt?: Date | null }): boolean {
  return Boolean(q.paymentFrozenAt) && !q.paidAt;
}

export const FROZEN_PAYMENT_ERROR = "Estamos actualizando tu presupuesto; te escribimos en breve.";
