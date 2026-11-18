import { assertNonNegativeCents, divRoundHalfUp, type Cents } from "./money.ts";

/**
 * How a sworn translator quotes. No defaults: each translator's rates are stated.
 * - base: net, as is.
 * - payable: what they get paid, base + round(base × VAT) − round(base × IRPF) (Daniela: 2100 / 1500).
 * - totalWithVat: a company quoting its invoice total, base + round(base × VAT).
 */
export type SupplierBasis =
  | { kind: "base" }
  | { kind: "payable"; vatBp: number; irpfBp: number }
  | { kind: "totalWithVat"; vatBp: number };

const roundBp = (base: Cents, bp: number) => Math.floor((base * bp + 5000) / 10000);

function checkBasis(basis: SupplierBasis) {
  const bps = basis.kind === "payable" ? [basis.vatBp, basis.irpfBp] : basis.kind === "totalWithVat" ? [basis.vatBp] : [];
  for (const bp of bps) if (!Number.isSafeInteger(bp) || bp < 0 || bp >= 10000) throw new RangeError(`tipo ${bp} pb no válido`);
  if (basis.kind === "payable" && basis.irpfBp > basis.vatBp + 10000) throw new RangeError("IRPF mayor que base + IVA");
}

/** The figure the translator's own invoice gives for a base: VAT and IRPF rounded separately. */
export function fromBase(baseCents: Cents, basis: SupplierBasis): Cents {
  assertNonNegativeCents(baseCents, "base");
  checkBasis(basis);
  if (basis.kind === "base") return baseCents;
  const vat = roundBp(baseCents, basis.vatBp);
  return basis.kind === "totalWithVat" ? baseCents + vat : baseCents + vat - roundBp(baseCents, basis.irpfBp);
}

/**
 * The base whose invoice gives EXACTLY the figure communicated. When no base does
 * (the figure is not reachable by the invoice rounding), the closest one and `exact: false`.
 */
export function toBase(amountCents: Cents, basis: SupplierBasis): { baseCents: Cents; exact: boolean } {
  assertNonNegativeCents(amountCents, "cifra del jurado");
  checkBasis(basis);
  if (basis.kind === "base") return { baseCents: amountCents, exact: true };
  const factorBp = 10000 + basis.vatBp - (basis.kind === "payable" ? basis.irpfBp : 0);
  const guess = divRoundHalfUp(amountCents * 10000, factorBp);
  let best = { baseCents: guess, exact: false, gap: Infinity };
  for (let d = 0; d <= 3; d++) {
    for (const b of d === 0 ? [guess] : [guess - d, guess + d]) {
      if (b < 0) continue;
      const gap = Math.abs(fromBase(b, basis) - amountCents);
      if (gap < best.gap) best = { baseCents: b, exact: gap === 0, gap };
    }
    if (best.exact) break;
  }
  return { baseCents: best.baseCents, exact: best.exact };
}

/** Boundary: lavori's stored PriceBasis string plus the translator's rates (required unless «base»). */
export function parseSupplierBasis(stored: unknown, rates?: { vatBp: number; irpfBp?: number }): SupplierBasis {
  if (stored === "base") return { kind: "base" };
  if (!rates) throw new RangeError(`la base «${String(stored)}» necesita los tipos de IVA/IRPF del jurado`);
  if (stored === "payable_iva_irpf") {
    if (rates.irpfBp === undefined) throw new RangeError("falta el IRPF del jurado");
    return { kind: "payable", vatBp: rates.vatBp, irpfBp: rates.irpfBp };
  }
  if (stored === "total_con_iva") return { kind: "totalWithVat", vatBp: rates.vatBp };
  throw new RangeError(`base de la cifra del jurado desconocida: ${String(stored)}`);
}

declare const knownBrand: unique symbol;

/** A known external cost is always > 0; a cost of 0 exists only as the owner's own work. */
export type SupplierCost =
  | { known: true; baseCents: Cents; ownWork: false; readonly [knownBrand]: true }
  | { known: true; baseCents: 0; ownWork: true }
  | { known: false };

export const UNKNOWN_COST: SupplierCost = { known: false };
export const OWN_WORK: SupplierCost = { known: true, baseCents: 0, ownWork: true };

function known(baseCents: Cents): SupplierCost {
  return { known: true, baseCents, ownWork: false } as SupplierCost;
}

/** From the figure the translator communicated, in their basis. 0 means «not informed». */
export function costFromSupplierFigure(amountCents: Cents, basis: SupplierBasis): { cost: SupplierCost; exact: boolean } {
  const { baseCents, exact } = toBase(amountCents, basis);
  return { cost: baseCents > 0 ? known(baseCents) : UNKNOWN_COST, exact };
}

/** From a field already stored as base (e.g. QuoteLine.supplierUnitCost). 0 or empty means «not informed». */
export function costFromStoredBase(baseCents: Cents | null | undefined): SupplierCost {
  if (baseCents == null) return UNKNOWN_COST;
  assertNonNegativeCents(baseCents, "coste");
  return baseCents > 0 ? known(baseCents) : UNKNOWN_COST;
}

/** Sum of several costs: unknown if any one is unknown; own work only if all are. */
export function sumCosts(costs: readonly SupplierCost[]): SupplierCost {
  if (costs.length === 0) return UNKNOWN_COST;
  let total = 0;
  for (const c of costs) {
    if (!c.known) return UNKNOWN_COST;
    total += c.baseCents;
  }
  if (costs.every((c) => c.known && c.ownWork)) return OWN_WORK;
  return known(total);
}
