// lib/expense-math.ts — Matemática pura de gastos (sin BD). Importable en cliente.
// IRPF de actividad profesional (modelo 111/190): solo 0 / 7% / 15%. El 19% es
// retención de arrendamiento (modelo 115), categoría aparte — fuera de aquí.

export function clampIrpfPct(v: number | string | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const f = n > 1 ? n / 100 : n;
  if (Math.abs(f - 0.15) < 0.005) return 0.15;
  if (Math.abs(f - 0.07) < 0.005) return 0.07;
  return 0;
}

// total = base + IVA (importe de la factura recibida).
// payable = base + IVA − IRPF (lo que se transfiere al proveedor; el IRPF lo ingresa
// HBTJ en el 111). IRPF es ortogonal al IVA: no toca el 303.
export function computeExpenseTotals(baseCents: number, vatRate: number, irpfPct: number) {
  const base = Math.max(0, Math.round(Number(baseCents) || 0));
  const vat = Math.round(base * vatRate);
  const irpf = Math.round(base * irpfPct);
  return {
    baseCents: base,
    vatCents: vat,
    irpfCents: irpf,
    totalCents: base + vat,
    payableCents: base + vat - irpf,
  };
}
