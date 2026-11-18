import { assertCents, assertNonNegativeCents, divRoundHalfUp, scaledIntFromDecimal, type Cents } from "./money.ts";

export type VatRateBp = 2100 | 1000 | 400;

export type VatRegime =
  | { kind: "general"; rateBp: VatRateBp }
  | { kind: "notSubject" }
  | { kind: "reverseCharge" }
  | { kind: "exempt" };

export type ZeroVatKind = "notSubject" | "reverseCharge" | "exempt";

export const VAT_GENERAL_21: VatRegime = { kind: "general", rateBp: 2100 };
export const VAT_REDUCED_10: VatRegime = { kind: "general", rateBp: 1000 };
export const VAT_SUPER_REDUCED_4: VatRegime = { kind: "general", rateBp: 400 };
export const VAT_NOT_SUBJECT: VatRegime = { kind: "notSubject" };
export const VAT_REVERSE_CHARGE: VatRegime = { kind: "reverseCharge" };
export const VAT_EXEMPT: VatRegime = { kind: "exempt" };

const ALLOWED_BP = new Set<number>([2100, 1000, 400]);

export type VatBreakdown = { base: Cents; vat: Cents; total: Cents };

const ZERO_KINDS = new Set<string>(["notSubject", "reverseCharge", "exempt"]);

/** Runtime check: a regime that arrived malformed (cast, JSON) throws, so no total can ever be NaN. */
export function assertRegime(regime: unknown): VatRegime {
  const r = regime as { kind?: unknown; rateBp?: unknown } | null;
  if (r && typeof r === "object") {
    if (r.kind === "general" && typeof r.rateBp === "number" && ALLOWED_BP.has(r.rateBp)) return r as VatRegime;
    if (typeof r.kind === "string" && ZERO_KINDS.has(r.kind)) return r as VatRegime;
  }
  throw new RangeError(`régimen de IVA mal formado: ${JSON.stringify(regime)}`);
}

export function rateBpOf(regime: VatRegime): number {
  const r = assertRegime(regime);
  return r.kind === "general" ? r.rateBp : 0;
}

/** The single VAT rounding rule: half up on exact integers. Negative bases (rectifications) mirror the positive ones. */
export function vatOn(baseCents: Cents, regime: VatRegime): Cents {
  assertCents(baseCents, "base");
  const bp = rateBpOf(regime);
  if (bp === 0 || baseCents === 0) return 0;
  const magnitude = Math.floor((Math.abs(baseCents) * bp + 5000) / 10000);
  return baseCents < 0 ? -magnitude : magnitude;
}

export function addVat(baseCents: Cents, regime: VatRegime): VatBreakdown {
  assertNonNegativeCents(baseCents, "base");
  const vat = vatOn(baseCents, regime);
  return { base: baseCents, vat, total: baseCents + vat };
}

export type GrossSplit =
  | (VatBreakdown & { consistent: true })
  | (VatBreakdown & { consistent: false; expectedVat: Cents });

/**
 * Only for amounts born VAT-included (a charge already paid): keeps the total, base = round(total/(1+r)),
 * vat = total − base. New invoices are issued from the BASE (lines). When this vat is not the base→vat
 * rule, the result says so (`consistent: false`) and carries the vat the base would give.
 */
export function splitGross(totalCents: Cents, regime: VatRegime): GrossSplit {
  assertNonNegativeCents(totalCents, "total");
  const bp = rateBpOf(regime);
  const base = bp === 0 ? totalCents : divRoundHalfUp(totalCents * 10000, 10000 + bp);
  const vat = totalCents - base;
  const expectedVat = vatOn(base, regime);
  return vat === expectedVat ? { base, vat, total: totalCents, consistent: true } : { base, vat, total: totalCents, consistent: false, expectedVat };
}

/**
 * Reads a stored `vatRate` (fraction 0.21, Prisma Decimal, "0.2100" or percent 21).
 * A stored 0 does not say which zero-VAT regime applies, so the caller must say it;
 * anything not understood throws instead of falling back to 21 %.
 */
export function parseVatRate(stored: unknown, opts: { zeroAs?: ZeroVatKind } = {}): VatRegime {
  if (opts.zeroAs !== undefined && !ZERO_KINDS.has(opts.zeroAs)) throw new RangeError(`zeroAs «${String(opts.zeroAs)}» no es un régimen de tipo cero`);
  if (stored === null || stored === undefined || stored === "") throw new RangeError("vatRate vacío: régimen de IVA desconocido");
  const isDecimalObject =
    typeof stored === "object" && !Array.isArray(stored) &&
    typeof (stored as { toString?: unknown }).toString === "function" &&
    (stored as object).toString !== Object.prototype.toString;
  if (typeof stored !== "number" && typeof stored !== "string" && !isDecimalObject) {
    throw new RangeError(`vatRate ${String(stored)} no entendido`);
  }
  const tenThousandths = scaledIntFromDecimal(stored as number | string | { toString(): string }, 4, "vatRate");
  if (tenThousandths === 0) {
    if (!opts.zeroAs) throw new RangeError("vatRate 0: indica si es no sujeto, inversión del sujeto pasivo o exento");
    return { kind: opts.zeroAs };
  }
  // ≤ 1 is a fraction (0.21 → 2100 bp); > 1 is a percentage (21 → 2100 bp).
  const bp = tenThousandths <= 10000 ? tenThousandths : tenThousandths / 100;
  if (!ALLOWED_BP.has(bp)) throw new RangeError(`vatRate ${String(stored)} no es un tipo de IVA admitido (21/10/4 %)`);
  return { kind: "general", rateBp: bp as VatRateBp };
}

/** Boundary: regime → fraction for the Prisma `vatRate` column. */
export function vatRateFraction(regime: VatRegime): number {
  return rateBpOf(regime) / 10000;
}

/** Boundary: what to write next to `vatRate` so a 0 % keeps which regime it was. */
export function vatFields(regime: VatRegime): { vatRate: number; vatRegime: VatRegime["kind"] } {
  return { vatRate: vatRateFraction(regime), vatRegime: assertRegime(regime).kind };
}

/** Exact inverse of vatFields: rate and regime must agree (general needs a rate > 0, the others 0). */
export function parseVatFields(fields: { vatRate: unknown; vatRegime: unknown }): VatRegime {
  const { vatRate, vatRegime } = fields ?? ({} as never);
  if (vatRegime === "general") {
    const r = parseVatRate(vatRate);
    if (r.kind !== "general") throw new RangeError("régimen general con tipo 0");
    return r;
  }
  if (typeof vatRegime !== "string" || !ZERO_KINDS.has(vatRegime)) throw new RangeError(`vatRegime «${String(vatRegime)}» desconocido`);
  const r = parseVatRate(vatRate, { zeroAs: vatRegime as ZeroVatKind });
  if (r.kind !== vatRegime) throw new RangeError(`régimen ${vatRegime} con tipo ${String(vatRate)} distinto de 0`);
  return r;
}
