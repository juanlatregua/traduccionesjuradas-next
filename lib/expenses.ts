// lib/expenses.ts — Gastos manuales del libro de contabilidad (IVA soportado + IRPF).
import { prisma } from "@/lib/prisma";
import { clampVatRate } from "@/lib/invoice-math";
import { clampIrpfPct, clampTaxTreatment, computeExpenseTotals, isWithinDuplicateWindow, DUPLICATE_WINDOW_DAYS } from "@/lib/expense-math";

export type ExpenseDuplicate = {
  id: string;
  date: Date;
  totalCents: number;
  supplier: string | null;
  concept: string;
};

export class DuplicateExpenseError extends Error {
  existing: ExpenseDuplicate;
  constructor(existing: ExpenseDuplicate) {
    super("Ya existe un gasto que parece el mismo (posible duplicado).");
    this.name = "DuplicateExpenseError";
    this.existing = existing;
  }
}

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
  taxTreatment?: string | null;
  needsReview?: boolean;
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

export function buildExpenseData(input: ExpenseInput) {
  return buildData(input);
}

function buildData(input: ExpenseInput) {
  if (!String(input.concept || "").trim()) throw new Error("Falta el concepto del gasto.");
  // undefined = no tocar (create usa el default de Prisma; update no lo pisa)
  const taxTreatment = input.taxTreatment != null ? clampTaxTreatment(input.taxTreatment) : undefined;
  // ISP/exento: la factura recibida llega sin IVA. Forzar vatRate 0 evita el doble
  // cómputo en el 303 (cuota clásica por vatCents + cuota ISP autorrepercutida).
  const vatRate = taxTreatment && taxTreatment !== "general" ? 0 : clampVatRate(input.vatRate);
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
    taxTreatment,
    needsReview: typeof input.needsReview === "boolean" ? input.needsReview : undefined,
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

const DUP_SELECT = { id: true, date: true, totalCents: true, supplier: true, concept: true } as const;

export async function findExpenseByInvoiceNumber(supplierNif: string | null, supplierInvoiceNumber: string, excludeId?: string): Promise<ExpenseDuplicate | null> {
  return prisma.expense.findFirst({
    where: {
      supplierInvoiceNumber,
      supplierNif,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: DUP_SELECT,
  });
}

export async function findDuplicateExpense(data: ReturnType<typeof buildData>, excludeId?: string): Promise<ExpenseDuplicate | null> {
  if (data.supplierInvoiceNumber) {
    return findExpenseByInvoiceNumber(data.supplierNif, data.supplierInvoiceNumber, excludeId);
  }
  if (!data.supplier) return null;
  // Sin nº de factura → chequeo blando: mismo proveedor + mismo importe ±3 días.
  const windowMs = DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const candidates = await prisma.expense.findMany({
    where: {
      supplier: { equals: data.supplier, mode: "insensitive" },
      totalCents: data.totalCents,
      date: { gte: new Date(data.date.getTime() - windowMs), lte: new Date(data.date.getTime() + windowMs) },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: DUP_SELECT,
  });
  return candidates.find((c) => isWithinDuplicateWindow(c.date, data.date)) ?? null;
}

async function assertNotDuplicate(data: ReturnType<typeof buildData>, excludeId?: string) {
  const existing = await findDuplicateExpense(data, excludeId);
  if (existing) throw new DuplicateExpenseError(existing);
}

export async function createExpense(input: ExpenseInput, opts?: { force?: boolean }) {
  const data = buildData(input);
  if (!opts?.force) await assertNotDuplicate(data);
  return prisma.expense.create({ data });
}

export async function updateExpense(id: string, input: ExpenseInput, opts?: { force?: boolean }) {
  const data = buildData(input);
  if (!opts?.force) await assertNotDuplicate(data, id);
  return prisma.expense.update({ where: { id }, data });
}

export async function deleteExpense(id: string) {
  return prisma.expense.delete({ where: { id } });
}
