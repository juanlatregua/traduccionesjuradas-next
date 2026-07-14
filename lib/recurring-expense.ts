// lib/recurring-expense.ts — Plantillas de gastos recurrentes (nómina, TGSS, SaaS…).
// El cron genera los Expense del mes; los variables nacen needsReview=true y no
// cuentan en totales/303 hasta confirmarlos. paymentStatus PENDING: los sella la
// conciliación bancaria.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildExpenseData, findDuplicateExpense } from "@/lib/expenses";
import { clampVatRate } from "@/lib/invoice-math";
import { clampIrpfPct, clampTaxTreatment } from "@/lib/expense-math";
import { periodKey, clampDay, isTemplateDue, mostRecentDuePeriod, buildGeneratedExpenses, type RecurringExpenseLine } from "@/lib/recurring-logic";

export type RecurringExpenseInput = {
  label: string;
  active?: boolean;
  brand?: string | null;
  supplier?: string | null;
  supplierNif?: string | null;
  category?: string | null;
  conceptTemplate?: string | null;
  lines?: RecurringExpenseLine[] | null;
  vatRate: number;
  taxTreatment?: string | null;
  irpfRetentionPct?: number;
  amountCents?: number | null;
  dayOfMonth: number;
};

function normalizeExpenseLines(lines: RecurringExpenseLine[] | null | undefined): RecurringExpenseLine[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((l) => ({
      concept: String(l?.concept || "").trim(),
      baseCents: Math.max(0, Math.round(Number(l?.baseCents) || 0)),
      vatRate: clampVatRate(l?.vatRate),
      ivaDeducible: l?.ivaDeducible ?? true,
      ...(l?.taxTreatment ? { taxTreatment: clampTaxTreatment(l.taxTreatment) } : {}),
    }))
    .filter((l) => l.concept.length > 0);
}

function buildData(input: RecurringExpenseInput) {
  const lines = normalizeExpenseLines(input.lines);
  return {
    label: String(input.label || "").trim(),
    active: input.active ?? true,
    brand: input.brand?.trim() || "traduccionesjuradas",
    supplier: input.supplier?.trim() || null,
    supplierNif: input.supplierNif?.trim() || null,
    category: input.category?.trim() || null,
    conceptTemplate: String(input.conceptTemplate || "").trim() || String(input.label || "").trim(),
    lineItemsJson: lines.length ? (lines as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    vatRate: clampVatRate(input.vatRate),
    taxTreatment: clampTaxTreatment(input.taxTreatment),
    irpfRetentionPct: clampIrpfPct(input.irpfRetentionPct),
    amountCents: input.amountCents == null ? null : Math.max(0, Math.round(Number(input.amountCents) || 0)),
    dayOfMonth: clampDay(input.dayOfMonth),
  };
}

export async function listRecurringExpenses() {
  return prisma.recurringExpense.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
}

export async function createRecurringExpense(input: RecurringExpenseInput) {
  if (!String(input.label || "").trim()) throw new Error("Falta el nombre de la plantilla.");
  return prisma.recurringExpense.create({ data: buildData(input) });
}

export async function updateRecurringExpense(id: string, input: RecurringExpenseInput) {
  if (!String(input.label || "").trim()) throw new Error("Falta el nombre de la plantilla.");
  return prisma.recurringExpense.update({ where: { id }, data: buildData(input) });
}

export async function deleteRecurringExpense(id: string) {
  return prisma.recurringExpense.delete({ where: { id } });
}

// Genera los Expense del periodo para una plantilla. Idempotente y ATÓMICO: el
// claim de lastGeneratedPeriod y las creaciones van en una transacción — un fallo
// a mitad lo revierte todo y el periodo se reintenta entero al día siguiente; dos
// ejecuciones solapadas no doblan (solo una gana el claim).
export async function generateExpensesForPeriod(templateId: string, opts?: { period?: string; force?: boolean }) {
  const tpl = await prisma.recurringExpense.findUnique({ where: { id: templateId } });
  if (!tpl) throw new Error("Plantilla no encontrada.");
  const period = opts?.period || periodKey();

  if (tpl.lastGeneratedPeriod === period && !opts?.force) {
    return { created: 0, skipped: 0, period, reason: "Ya se generó este periodo." };
  }

  // Cribado de duplicados (lectura, fuera de la transacción): un gasto ya metido a
  // mano —o un placeholder que sobrevivió a un force anterior— no se duplica.
  const inputs = buildGeneratedExpenses(tpl, period);
  const rows: ReturnType<typeof buildExpenseData>[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const data = buildExpenseData(input);
    if (await findDuplicateExpense(data)) {
      skipped++;
      continue;
    }
    rows.push(data);
  }

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.recurringExpense.updateMany({
      where: { id: templateId, ...(opts?.force ? {} : { NOT: { lastGeneratedPeriod: period } }) },
      data: { lastGeneratedPeriod: period },
    });
    if (claim.count === 0) return { created: 0, claimed: false };
    let created = 0;
    for (const data of rows) {
      await tx.expense.create({ data });
      created++;
    }
    return { created, claimed: true };
  });

  if (!result.claimed) return { created: 0, skipped, period, reason: "Ya se generó este periodo." };
  return { created: result.created, skipped, period };
}

// Cron diario: genera los gastos de las plantillas activas cuyo periodo vencido
// esté pendiente (ventana de backfill de un mes vía mostRecentDuePeriod).
export async function generateRecurringExpensesDue(now: Date = new Date()) {
  const templates = await prisma.recurringExpense.findMany({ where: { active: true } });
  const results: { id: string; label: string; period: string; created: number; error?: string }[] = [];
  for (const tpl of templates) {
    if (!isTemplateDue(tpl, now)) continue;
    const period = mostRecentDuePeriod(now, tpl.dayOfMonth);
    try {
      const r = await generateExpensesForPeriod(tpl.id, { period });
      results.push({ id: tpl.id, label: tpl.label, period, created: r.created });
    } catch (e: any) {
      results.push({ id: tpl.id, label: tpl.label, period, created: 0, error: e?.message || "error" });
    }
  }
  return { period: periodKey(now), generated: results.reduce((a, r) => a + r.created, 0), results };
}
