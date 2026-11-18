import { assertNonNegativeCents, divRoundHalfUp, type Cents } from "./money.ts";

/**
 * How a sworn translator quotes:
 * - base: net, as is.
 * - payableVatIrpf: what they get paid, base + 21 % VAT − 15 % IRPF = base × 1.06.
 * - totalWithVat: a company quoting its invoice total, base × 1.21.
 */
export type SupplierBasis = "base" | "payableVatIrpf" | "totalWithVat";

const FACTOR_BP: Record<SupplierBasis, number> = { base: 10000, payableVatIrpf: 10600, totalWithVat: 12100 };

export function toBase(amountCents: Cents, basis: SupplierBasis): Cents {
  assertNonNegativeCents(amountCents, "cifra del jurado");
  return basis === "base" ? amountCents : divRoundHalfUp(amountCents * 10000, FACTOR_BP[basis]);
}

export function fromBase(baseCents: Cents, basis: SupplierBasis): Cents {
  assertNonNegativeCents(baseCents, "base");
  return basis === "base" ? baseCents : divRoundHalfUp(baseCents * FACTOR_BP[basis], 10000);
}

/** Boundary: the stored PriceBasis strings of lavori. */
export function parseSupplierBasis(stored: unknown): SupplierBasis {
  if (stored === "base") return "base";
  if (stored === "payable_iva_irpf") return "payableVatIrpf";
  if (stored === "total_con_iva") return "totalWithVat";
  throw new RangeError(`base de la cifra del jurado desconocida: ${String(stored)}`);
}

export type SupplierCost =
  | { known: true; baseCents: Cents; ownWork?: false }
  /** Work done by the owner (French): cost 0 by construction. */
  | { known: true; baseCents: 0; ownWork: true }
  | { known: false };

export const UNKNOWN_COST: SupplierCost = { known: false };
export const OWN_WORK: SupplierCost = { known: true, baseCents: 0, ownWork: true };

export function knownCost(baseCents: Cents): SupplierCost {
  return { known: true, baseCents: assertNonNegativeCents(baseCents, "coste") };
}

export function costFromSupplier(amountCents: Cents, basis: SupplierBasis): SupplierCost {
  return knownCost(toBase(amountCents, basis));
}

/** Sum of several costs: unknown if any one is unknown; own work only if all are. */
export function sumCosts(costs: readonly SupplierCost[]): SupplierCost {
  if (costs.length === 0) return UNKNOWN_COST;
  let total = 0;
  for (const c of costs) {
    if (!c.known) return UNKNOWN_COST;
    total += c.baseCents;
  }
  if (costs.every((c) => c.known && c.ownWork === true)) return OWN_WORK;
  return knownCost(total);
}
