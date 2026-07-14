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

// Tratamiento de IVA del gasto: general | ISP intracomunitario | ISP importación | exento.
export const TAX_TREATMENTS = ["general", "isp_intracom", "isp_import", "exempt"] as const;

export const TAX_TREATMENT_OPTIONS = [
  { value: "general", label: "General" },
  { value: "isp_intracom", label: "ISP intracomunitario (UE)" },
  { value: "isp_import", label: "ISP importación de servicios (extra-UE)" },
  { value: "exempt", label: "Exento/no sujeto" },
] as const;

export function taxTreatmentLabel(v: string | null | undefined): string {
  return TAX_TREATMENT_OPTIONS.find((o) => o.value === v)?.label || "General";
}

export function clampTaxTreatment(v: string | null | undefined): string {
  return (TAX_TREATMENTS as readonly string[]).includes(v || "") ? (v as string) : "general";
}

// Ventana de sospecha de duplicado sin nº de factura: mismo proveedor + mismo
// importe con fechas a ≤ N días de distancia (por defecto ±3).
export const DUPLICATE_WINDOW_DAYS = 3;

export function isWithinDuplicateWindow(a: Date | string, b: Date | string, days: number = DUPLICATE_WINDOW_DAYS): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) <= days * 24 * 60 * 60 * 1000;
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
