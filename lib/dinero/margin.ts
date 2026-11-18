import { assertCents, type Cents } from "./money.ts";
import { formatEuros } from "./format.ts";
import type { SupplierCost } from "./supplier.ts";

/** Minimum margin, as a percentage over the supplier's base cost. */
export const MIN_MARGIN_PCT_OVER_COST = 10;

export type MarginClass = "unknown" | "loss" | "low" | "ok";

export type Margin =
  | { class: "unknown" }
  | { class: Exclude<MarginClass, "unknown">; marginCents: Cents; netRevenueCents: Cents; costCents: Cents; ownWork: boolean };

/** margin = net revenue − supplier base cost, both without VAT. */
export function marginOf(netRevenueCents: Cents, cost: SupplierCost): Margin {
  assertCents(netRevenueCents, "ingreso neto");
  if (!cost.known) return { class: "unknown" };
  const marginCents = netRevenueCents - cost.baseCents;
  const ownWork = cost.ownWork === true;
  const base = { marginCents, netRevenueCents, costCents: cost.baseCents, ownWork };
  if (ownWork) return { class: "ok", ...base };
  if (marginCents <= 0) return { class: "loss", ...base };
  if (marginCents * 100 < MIN_MARGIN_PCT_OVER_COST * cost.baseCents) return { class: "low", ...base };
  return { class: "ok", ...base };
}

/** Margin as % over cost (display only); null when the cost is unknown or zero. */
export function pctOverCost(netRevenueCents: Cents, cost: SupplierCost): number | null {
  if (!cost.known || cost.baseCents === 0) return null;
  return ((netRevenueCents - cost.baseCents) / cost.baseCents) * 100;
}

export type IssueCheck = { ok: true; margin: Margin } | { ok: false; margin: Margin; reason: string };

export function canIssue(netRevenueCents: Cents, cost: SupplierCost): IssueCheck {
  const margin = marginOf(netRevenueCents, cost);
  if (margin.class === "ok") return { ok: true, margin };
  if (margin.class === "unknown") return { ok: false, margin, reason: "Coste del traductor desconocido: no se puede comprobar el margen" };
  const detail = `ingreso ${formatEuros(margin.netRevenueCents)} − coste ${formatEuros(margin.costCents)} = ${formatEuros(margin.marginCents)}`;
  if (margin.class === "loss") return { ok: false, margin, reason: `Pérdida o margen cero: ${detail}` };
  const pct = pctOverCost(netRevenueCents, cost)!;
  return { ok: false, margin, reason: `Margen bajo: ${detail} (${pct.toFixed(1).replace(".", ",")} % sobre coste, mínimo ${MIN_MARGIN_PCT_OVER_COST} %)` };
}
