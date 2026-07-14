// lib/invoice-math.ts — Matemática pura de facturación (sin BD): validación del
// número fiscal, normalización del IVA y cálculo de base/IVA/total. Separado de
// client-invoice.ts para poder testearlo sin arrastrar Prisma.

export type InvoiceLine = { description: string; detail?: string; amountCents: number };

// Número fiscal HBTJ: AA_NNN (p.ej. 26_018).
export function isValidInvoiceNumber(n: string): boolean {
  return /^\d{2}_\d{3,}$/.test(n.trim());
}

// Serie por tipo de documento: factura AA_NNN, presupuesto P·AA_NNN (P26_001).
// Cada serie rechaza el formato de la otra.
export function isValidDocNumber(n: string, docKind: string): boolean {
  const v = n.trim();
  return docKind === "quote" ? /^P\d{2}_\d{3,}$/.test(v) : /^\d{2}_\d{3,}$/.test(v);
}

// Siguiente número de la serie del docKind para un año (yearYY = "26"), a partir
// de los números existentes. Los presupuestos históricos SIN "P" (26_011…) no
// cuentan para la serie P (arranca limpia); para facturas se ignoran los "P…".
export function nextNumberInSeries(existing: Array<string | null | undefined>, docKind: string, yearYY: string): string {
  const prefix = docKind === "quote" ? `P${yearYY}_` : `${yearYY}_`;
  const re = docKind === "quote" ? /^P\d{2}_(\d+)$/ : /^\d{2}_(\d+)$/;
  let max = 0;
  for (const n of existing) {
    if (!n || !n.startsWith(prefix)) continue;
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// IVA como fracción (0.21). Tolera "21" → 0.21. Fuera de rango / inválido → 21%.
export function clampVatRate(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0.21; // sin valor → por defecto (0 explícito = exento)
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0.21;
  if (n > 1) return n / 100;
  return n;
}

export function normalizeLines(lines: InvoiceLine[] | undefined): InvoiceLine[] {
  return (lines || [])
    .map((l) => ({
      description: String(l.description || "").trim(),
      detail: l.detail ? String(l.detail).trim() : undefined,
      amountCents: Math.max(0, Math.round(Number(l.amountCents) || 0)),
    }))
    .filter((l) => l.description.length > 0 || l.amountCents > 0);
}

// Las líneas son BASE (sin IVA). total = base + base*iva.
export function computeLineTotals(lines: InvoiceLine[], vatRate: number) {
  const base = (lines || []).reduce((s, l) => s + Math.max(0, Math.round(Number(l.amountCents) || 0)), 0);
  const vat = Math.round(base * vatRate);
  return { baseCents: base, vatCents: vat, totalCents: base + vat };
}

// Desde un total CON IVA (camino del pedido pagado): base = total/(1+iva).
export function totalsFromGross(totalCents: number, vatRate: number) {
  const base = Math.round(totalCents / (1 + vatRate));
  return { baseCents: base, vatCents: totalCents - base, totalCents };
}
