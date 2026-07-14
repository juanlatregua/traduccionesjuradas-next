// lib/fiscal-aggregation.ts — Agregación fiscal del periodo (fuente única,
// pura y testeable): devengado por tipo (snapVat), bases ISP con split
// deducible, base deducible clásica y datos del 111. REGLA: los gastos
// needsReview (recurrentes pendientes de confirmar) se excluyen AQUÍ.

import { build303, build111, type Draft303, type Draft111 } from "./tax-drafts.ts";

const ALLOWED_VAT = [0, 0.04, 0.1, 0.21];
export function snapVat(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.21;
  const f = n > 1 ? n / 100 : n;
  return ALLOWED_VAT.reduce((best, a) => (Math.abs(a - f) < Math.abs(best - f) ? a : best), 0.21);
}

export type FiscalInvoice = { baseCents: number; vatCents: number };
export type FiscalExpense = {
  baseCents: number;
  vatCents: number;
  ivaDeducible: boolean;
  taxTreatment: string;
  needsReview: boolean;
  irpfCents: number;
};

export function aggregateFiscal(
  invoices: FiscalInvoice[],
  expenses: FiscalExpense[]
): { d303: Draft303; d111: Draft111 } {
  const rows = expenses.filter((e) => !e.needsReview);

  const byRate = new Map<number, { baseCents: number; cuotaCents: number }>();
  for (const i of invoices) {
    const rate = i.baseCents > 0 ? snapVat(i.vatCents / i.baseCents) : 0;
    const cur = byRate.get(rate) || { baseCents: 0, cuotaCents: 0 };
    cur.baseCents += i.baseCents;
    cur.cuotaCents += i.vatCents;
    byRate.set(rate, cur);
  }
  const devengado = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, v]) => ({ ratePct: Math.round(rate * 100), baseCents: v.baseCents, cuotaCents: v.cuotaCents }));

  // ISP (art. 84 LIVA): la cuota se autorrepercute (devengado) y se deduce a la vez.
  // Los gastos ISP llevan vatCents 0 → el soportado "clásico" (vatCents) no los duplica.
  const ispBase = (kind: string, onlyDeducible: boolean) =>
    rows
      .filter((e) => e.taxTreatment === kind && (!onlyDeducible || e.ivaDeducible))
      .reduce((a, e) => a + e.baseCents, 0);
  const baseDeducible = rows.filter((e) => e.ivaDeducible && !e.taxTreatment.startsWith("isp_")).reduce((a, e) => a + e.baseCents, 0);
  const deducibleVat = rows.reduce((a, e) => a + (e.ivaDeducible ? e.vatCents : 0), 0);

  const exp111 = rows.filter((e) => e.irpfCents > 0);
  const d303 = build303(devengado, baseDeducible, deducibleVat, {
    intracomBaseCents: ispBase("isp_intracom", false),
    intracomDeducibleBaseCents: ispBase("isp_intracom", true),
    importBaseCents: ispBase("isp_import", false),
    importDeducibleBaseCents: ispBase("isp_import", true),
  });
  const d111 = build111(
    exp111.reduce((a, e) => a + e.baseCents, 0),
    rows.reduce((a, e) => a + e.irpfCents, 0),
    exp111.length
  );
  return { d303, d111 };
}
