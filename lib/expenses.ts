// lib/expenses.ts — Gastos manuales del libro de contabilidad (IVA soportado + IRPF).
import { prisma } from "@/lib/prisma";
import { clampVatRate } from "@/lib/invoice-math";
import { clampIrpfPct, computeExpenseTotals } from "@/lib/expense-math";

export type ExpenseInput = {
  date: string; // ISO o yyyy-mm-dd
  brand?: string | null;
  supplier?: string | null;
  supplierNif?: string | null;
  supplierInvoiceNumber?: string | null;
  concept: string;
  category?: string | null;
  baseCents: number;
  vatRate: number;
  ivaDeducible?: boolean;
  irpfRetentionPct?: number;
  attachmentUrl?: string | null;
  attachmentKey?: string | null;
  attachmentName?: string | null;
  notes?: string | null;
};

function parseDate(s: string): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error("Fecha del gasto inválida.");
  return d;
}

function buildData(input: ExpenseInput) {
  if (!String(input.concept || "").trim()) throw new Error("Falta el concepto del gasto.");
  const vatRate = clampVatRate(input.vatRate);
  const irpfPct = clampIrpfPct(input.irpfRetentionPct);
  const supplierNif = input.supplierNif?.trim() || null;
  if (irpfPct > 0 && !supplierNif) {
    throw new Error("La retención de IRPF exige el NIF del proveedor (modelo 190).");
  }
  const { baseCents, vatCents, irpfCents, totalCents, payableCents } = computeExpenseTotals(input.baseCents, vatRate, irpfPct);
  return {
    date: parseDate(input.date),
    brand: input.brand?.trim() || "traduccionesjuradas",
    supplier: input.supplier?.trim() || null,
    supplierNif,
    supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null,
    concept: input.concept.trim(),
    category: input.category?.trim() || null,
    baseCents,
    vatRate,
    vatCents,
    ivaDeducible: input.ivaDeducible ?? true,
    irpfRetentionPct: irpfPct,
    irpfCents,
    totalCents,
    payableCents,
    attachmentUrl: input.attachmentUrl?.trim() || null,
    attachmentKey: input.attachmentKey?.trim() || null,
    attachmentName: input.attachmentName?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export async function createExpense(input: ExpenseInput) {
  return prisma.expense.create({ data: buildData(input) });
}

export async function updateExpense(id: string, input: ExpenseInput) {
  return prisma.expense.update({ where: { id }, data: buildData(input) });
}

export async function deleteExpense(id: string) {
  return prisma.expense.delete({ where: { id } });
}
