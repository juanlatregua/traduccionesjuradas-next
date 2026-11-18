import { assertNonNegativeCents, divRoundHalfUp, type Cents } from "./money.ts";
import { checkedCost, type SupplierCost } from "./supplier.ts";

/** Usual floor per document; callers pass it (or 0) explicitly. */
export const SUGGEST_DOC_FLOOR_CENTS: Cents = 4000;
export const SUGGEST_MIN_MARGIN_CENTS: Cents = 1000;
export const SUGGEST_MAX_MARKUP_PCT = 160;

/** Margin over cost by cost band: < 100 € → 30 %, < 190 € → 25 %, otherwise 20 %. */
export function marginPctForCostCents(costCents: Cents): number {
  if (costCents < 10000) return 30;
  if (costCents < 19000) return 25;
  return 20;
}

export type PriceSuggestion = {
  readonly kind: "suggestion";
  suggestedCents: Cents;
  bound: "floor" | "markupCap" | "bandMargin" | "minMargin";
};

/**
 * Suggested client price (no VAT) for the manager to accept or change — never a price that leaves on its own:
 * max(floor, min(cost × 1.6, max(cost × (1 + band), cost + 10 €))).
 */
export function suggestClientPrice(cost: SupplierCost, opts: { floorCents: Cents }): PriceSuggestion | null {
  const checked = checkedCost(cost);
  if (!checked.known) return null;
  const c = assertNonNegativeCents(checked.baseCents, "coste");
  const floor = assertNonNegativeCents(opts.floorCents, "suelo");
  // Hundredths of a cent, so every candidate is exact before the single rounding.
  const band = c * (100 + marginPctForCostCents(c));
  const minMargin = (c + SUGGEST_MIN_MARGIN_CENTS) * 100;
  const cap = c * SUGGEST_MAX_MARKUP_PCT;
  const withMargin = Math.max(band, minMargin);
  const capped = Math.min(cap, withMargin);
  const value = Math.max(floor * 100, capped);
  const bound = value === floor * 100 && floor * 100 >= capped ? "floor" : capped === cap && cap < withMargin ? "markupCap" : withMargin === band ? "bandMargin" : "minMargin";
  return { kind: "suggestion", suggestedCents: divRoundHalfUp(value, 100), bound };
}
