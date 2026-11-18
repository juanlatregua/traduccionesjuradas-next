import { assertCents, assertNonNegativeCents, divRoundHalfUp, scaledIntFromDecimal, spread, sumCents, type Cents } from "./money.ts";
import { addVat, assertRegime, vatOn, splitGross, type GrossSplit, type VatBreakdown, type VatRegime } from "./vat.ts";

export const PAPER_SHIPPING_BASE_CENTS: Cents = 1200;

export type QuoteLineMoney = {
  /** Decimal(10,2) in the schema: read with 2 decimals. */
  quantity: number | string | { toString(): string };
  unitPriceCents: Cents;
};

export type Discount =
  | { kind: "none" }
  /** Percent of the subtotal, e.g. 10 or 7.5. */
  | { kind: "percent"; percent: number | string | { toString(): string } }
  | { kind: "fixed"; cents: Cents };

export type QuoteTotals = {
  lineTotals: Cents[];
  subtotal: Cents;
  discount: Cents;
  shipping: Cents;
  taxableBase: Cents;
  vat: Cents;
  total: Cents;
};

export function lineTotalCents(line: QuoteLineMoney): Cents {
  const qtyHundredths = scaledIntFromDecimal(line.quantity, 2, "cantidad");
  if (qtyHundredths < 0) throw new RangeError("cantidad negativa");
  assertNonNegativeCents(line.unitPriceCents, "precio unitario");
  return divRoundHalfUp(qtyHundredths * line.unitPriceCents, 100);
}

export function discountCents(subtotal: Cents, discount: Discount): Cents {
  assertNonNegativeCents(subtotal, "subtotal");
  let amount: Cents;
  if (discount.kind === "none") amount = 0;
  else if (discount.kind === "fixed") amount = assertNonNegativeCents(discount.cents, "descuento");
  else {
    const pctHundredths = scaledIntFromDecimal(discount.percent, 2, "descuento %");
    if (pctHundredths < 0) throw new RangeError("descuento % negativo");
    amount = divRoundHalfUp(subtotal * pctHundredths, 10000);
  }
  return amount;
}

export type QuoteTotalsResult =
  | { ok: true; totals: QuoteTotals }
  | { ok: false; error: "discount_exceeds_subtotal"; subtotal: Cents; discount: Cents };

export function quoteTotals(input: {
  lines: readonly QuoteLineMoney[];
  discount: Discount;
  shippingCents: Cents;
  regime: VatRegime;
}): QuoteTotalsResult {
  assertRegime(input.regime);
  const lineTotals = input.lines.map(lineTotalCents);
  const subtotal = sumCents(lineTotals);
  const discount = discountCents(subtotal, input.discount);
  // A discount above the subtotal is an input error, never silently capped (nor allowed to eat the shipping).
  if (discount > subtotal) return { ok: false, error: "discount_exceeds_subtotal", subtotal, discount };
  const shipping = assertNonNegativeCents(input.shippingCents, "envío");
  const taxableBase = subtotal - discount + shipping;
  const { vat, total } = addVat(taxableBase, input.regime);
  return { ok: true, totals: { lineTotals, subtotal, discount, shipping, taxableBase, vat, total } };
}

/** Invoice lines are bases (no VAT). Negative lines only for rectifications (R1). */
export function invoiceTotalsFromLines(
  lineBases: readonly Cents[],
  regime: VatRegime,
  opts: { allowNegative?: boolean } = {}
): VatBreakdown {
  for (const l of lineBases) (opts.allowNegative ? assertCents : assertNonNegativeCents)(l, "línea");
  const base = sumCents(lineBases);
  if (!opts.allowNegative) return addVat(base, regime);
  const vat = vatOn(base, regime);
  return { base, vat, total: base + vat };
}

/** Only for amounts born VAT-included; new invoices are issued from lines (base). See splitGross. */
export function invoiceTotalsFromGross(totalCents: Cents, regime: VatRegime): GrossSplit {
  return splitGross(totalCents, regime);
}

/** Splits a VAT-included total into installments by integer weights (e.g. [40, 60]); they add up exactly. */
export function splitInstallments(totalWithVatCents: Cents, weights: readonly number[]): Cents[] {
  if (weights.length === 0 || weights.some((w) => !(Number.isSafeInteger(w) && w > 0))) {
    throw new RangeError("plazos: pesos enteros positivos");
  }
  const parts = spread(totalWithVatCents, weights);
  if (parts.some((p) => p === 0)) throw new RangeError("plazos: algún plazo saldría a 0");
  return parts;
}
