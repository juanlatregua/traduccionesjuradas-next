// lib/quote-math.ts — Matemática pura de presupuestos, sin dependencias de
// Node (crypto, prisma): segura para importar desde componentes "use client".
// Fuente única de verdad para los totales: el builder la usa para el resumen en
// vivo y el servidor para persistir → la UI nunca miente sobre el precio.

export type QuoteLineInput = {
  description: string;
  quantity: number;
  unitPrice: number; // precio CLIENTE (sin IVA)
  supplierUnitCost?: number; // coste del traductor (sin IVA) — solo interno
};

export type QuoteDiscountType = "NONE" | "PERCENT" | "FIXED";
export type QuoteDeliveryType = "DIGITAL_PDF" | "PAPER_SHIP";

export const PAPER_SHIPPING_BASE_EUR = 12;
export const DEFAULT_VAT_RATE = 0.21;

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ── Margen comercial tiered FR-aware (decisión Juan 2026-06-12) ──────────────
// Para idiomas NO franceses, el precio del motor es el COSTE y el cliente paga
// coste × (1 + margen), con margen por tramo de COSTE (base sin IVA):
//   coste < 100 € → 30 % · 100–190 € → 25 % · ≥ 190 € → 20 %.
// Francés: SIN margen (lo hace Juan; coste = precio cliente). El IVA va FUERA de
// estos helpers (cada borde aplica el IVA donde ya lo hace hoy).

export function marginPctForCost(costEur: number): number {
  const cost = Number.isFinite(costEur) ? Math.max(0, costEur) : 0;
  if (cost < 100) return 30;
  if (cost < 190) return 25;
  return 20;
}

// ¿El idioma extranjero del par/lengua es francés? Acepta par ("fr-es","es-fr")
// o código suelto ("fr"). El lado no-ES del par es el idioma extranjero.
export function isFrenchForeign(foreignLangOrPair: string | null | undefined): boolean {
  const c = String(foreignLangOrPair || "").trim().toLowerCase();
  if (!c) return false;
  if (c.includes("-")) {
    const [from, to] = c.split("-");
    const foreign = from === "es" ? to : from;
    return foreign === "fr";
  }
  return c === "fr";
}

// Precio CLIENTE sin IVA a partir del COSTE sin IVA. FR → coste tal cual.
// No-FR → coste × (1 + margen tiered). IVA FUERA (se aplica en el borde).
export function clientPriceFromCost(
  costEur: number,
  foreignLangOrPair: string | null | undefined
): number {
  const cost = Number.isFinite(costEur) ? Math.max(0, costEur) : 0;
  if (isFrenchForeign(foreignLangOrPair)) return round2(cost);
  return round2(cost * (1 + marginPctForCost(cost) / 100));
}

export function computeQuoteTotals(params: {
  lines: QuoteLineInput[];
  discountType: QuoteDiscountType;
  discountValue: number;
  vatRate: number;
  deliveryType: QuoteDeliveryType;
  shippingBase?: number;
}) {
  const safeVatRate = Number.isFinite(params.vatRate) ? Math.max(0, params.vatRate) : DEFAULT_VAT_RATE;
  const shippingBase = Number.isFinite(Number(params.shippingBase))
    ? Math.max(0, Number(params.shippingBase))
    : PAPER_SHIPPING_BASE_EUR;

  const lines = params.lines.map((line) => {
    const lineTotal = round2(line.quantity * line.unitPrice);
    return {
      description: line.description,
      quantity: round2(line.quantity),
      unitPrice: round2(line.unitPrice),
      lineTotal,
      supplierUnitCost: line.supplierUnitCost !== undefined ? round2(line.supplierUnitCost) : null,
    };
  });

  const subtotal = round2(lines.reduce((acc, line) => acc + line.lineTotal, 0));
  const shippingAmount = params.deliveryType === "PAPER_SHIP" ? round2(shippingBase) : 0;

  let discountAmount = 0;
  if (params.discountType === "PERCENT") {
    const pct = Math.max(0, Number(params.discountValue || 0));
    discountAmount = round2(subtotal * (pct / 100));
  } else if (params.discountType === "FIXED") {
    discountAmount = round2(Math.max(0, Number(params.discountValue || 0)));
  }

  const maxDiscount = subtotal + shippingAmount;
  discountAmount = Math.min(discountAmount, maxDiscount);

  const taxableBase = round2(Math.max(0, subtotal + shippingAmount - discountAmount));
  const vatAmount = round2(taxableBase * safeVatRate);
  const total = round2(taxableBase + vatAmount);

  return {
    lines,
    subtotal,
    discountAmount,
    shippingAmount,
    vatAmount,
    total,
    vatRate: safeVatRate,
  };
}
