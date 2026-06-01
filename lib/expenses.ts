// lib/expenses.ts — Gastos manuales del libro de contabilidad (IVA soportado).
import { prisma } from "@/lib/prisma";
import { clampVatRate } from "@/lib/invoice-math";

export type ExpenseInput = {
  date: string; // ISO o yyyy-mm-dd
  brand?: string | null;
  supplier?: string | null;
  supplierNif?: string | null;
  concept: string;
  category?: string | null;
  baseCents: number;
  vatRate: number;
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
  const base = Math.max(0, Math.round(Number(input.baseCents) || 0));
  const vat = Math.round(base * vatRate);
  return {
    date: parseDate(input.date),
    brand: input.brand?.trim() || "traduccionesjuradas",
    supplier: input.supplier?.trim() || null,
    supplierNif: input.supplierNif?.trim() || null,
    concept: input.concept.trim(),
    category: input.category?.trim() || null,
    baseCents: base,
    vatRate,
    vatCents: vat,
    totalCents: base + vat,
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
