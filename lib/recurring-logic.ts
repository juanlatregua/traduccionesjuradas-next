// lib/recurring-logic.ts — Lógica pura de plantillas recurrentes (sin BD, testeable).
// Compartida por facturas recurrentes (lib/recurring-invoice) y gastos recurrentes
// (lib/recurring-expense).

const MONTHS_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export function periodKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Resuelve {MES} {AÑO} {MES_AÑO} sin new Date(period) (que en TZ negativas cae al mes anterior).
export function resolveConcept(template: string, period: string): string {
  const y = period.slice(0, 4);
  const mes = MONTHS_ES[Number(period.slice(5, 7)) - 1] || "";
  return String(template || "")
    .replace(/\{MES_A(Ñ|N)O\}/gi, `${mes} ${y}`)
    .replace(/\{MES\}/gi, mes)
    .replace(/\{A(Ñ|N)O\}/gi, y);
}

export function clampDay(n: number): number {
  const x = Math.round(Number(n) || 1);
  return Math.min(28, Math.max(1, x));
}

// Último periodo cuyo día de generación ya pasó: el mes corriente si el día ya
// llegó, si no el mes anterior. Da una ventana de backfill de un mes: si el cron
// falla justo el día 28, el periodo perdido se genera cualquier día posterior.
export function mostRecentDuePeriod(now: Date, dayOfMonth: number): string {
  if (now.getUTCDate() >= clampDay(dayOfMonth)) return periodKey(now);
  return periodKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

// ¿Toca generar esta plantilla? Pendiente del último periodo vencido. Una plantilla
// NUEVA (sin lastGeneratedPeriod) no rellena meses pasados: esos ya se contabilizaron
// a mano; arranca en el mes corriente cuando llegue su día.
export function isTemplateDue(tpl: { dayOfMonth: number; lastGeneratedPeriod: string | null }, now: Date): boolean {
  const target = mostRecentDuePeriod(now, tpl.dayOfMonth);
  if (tpl.lastGeneratedPeriod == null) return target === periodKey(now);
  return tpl.lastGeneratedPeriod !== target;
}

export type RecurringExpenseLine = {
  concept: string;
  baseCents: number;
  vatRate: number;
  ivaDeducible?: boolean;
  taxTreatment?: string;
};

export type RecurringExpenseTemplateData = {
  label: string;
  brand: string;
  supplier: string | null;
  supplierNif: string | null;
  category: string | null;
  conceptTemplate: string;
  lineItemsJson?: unknown;
  vatRate: number;
  taxTreatment: string;
  irpfRetentionPct: number;
  amountCents: number | null;
  dayOfMonth: number;
};

export type GeneratedExpenseInput = {
  date: string;
  brand: string;
  supplier: string | null;
  supplierNif: string | null;
  concept: string;
  category: string | null;
  baseCents: number;
  vatRate: number;
  ivaDeducible: boolean;
  taxTreatment: string;
  irpfRetentionPct: number;
  needsReview: boolean;
  notes: string;
};

// Convierte una plantilla en los Expense del periodo (uno por línea, o uno solo).
// Variables (amountCents null) nacen needsReview=true: no cuentan en totales/303
// hasta confirmarlos con el importe real.
export function buildGeneratedExpenses(tpl: RecurringExpenseTemplateData, period: string): GeneratedExpenseInput[] {
  const date = `${period}-${String(clampDay(tpl.dayOfMonth)).padStart(2, "0")}`;
  const needsReview = tpl.amountCents == null;
  const common = {
    date,
    brand: tpl.brand,
    supplier: tpl.supplier,
    supplierNif: tpl.supplierNif,
    category: tpl.category,
    irpfRetentionPct: tpl.irpfRetentionPct,
    needsReview,
    notes: `[recurrente:${tpl.label} periodo ${period}]`,
  };
  const lines = Array.isArray(tpl.lineItemsJson)
    ? (tpl.lineItemsJson as RecurringExpenseLine[]).filter((l) => l && String(l.concept || "").trim())
    : [];
  if (lines.length) {
    return lines.map((l) => {
      const vr = Number(l.vatRate);
      return {
        ...common,
        concept: resolveConcept(l.concept, period),
        baseCents: Math.max(0, Math.round(Number(l.baseCents) || 0)),
        vatRate: Number.isFinite(vr) ? vr : tpl.vatRate,
        ivaDeducible: l.ivaDeducible ?? true,
        taxTreatment: l.taxTreatment || tpl.taxTreatment,
      };
    });
  }
  return [
    {
      ...common,
      concept: resolveConcept(tpl.conceptTemplate || tpl.label, period),
      baseCents: tpl.amountCents ?? 0,
      vatRate: tpl.vatRate,
      ivaDeducible: true,
      taxTreatment: tpl.taxTreatment,
    },
  ];
}
