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
      isAccrual: false, // los devengos de colaborador no son facturas recibidas
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
      isAccrual: false, // un devengo del mismo colaborador no es un duplicado de su factura
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

// Un devengo liquidado es parte del cuadre de una factura registrada: editarlo o
// borrarlo suelto rompería la liquidación. Se libera borrando la factura que lo
// absorbe (settledById vuelve a null por onDelete: SetNull).
async function assertNotSettledAccrual(id: string) {
  const e = await prisma.expense.findUnique({ where: { id }, select: { isAccrual: true, settledById: true } });
  if (e?.isAccrual && e.settledById) {
    throw new Error("Devengo ya liquidado en una factura: para tocarlo, borra antes la factura que lo absorbe.");
  }
}

export async function updateExpense(id: string, input: ExpenseInput, opts?: { force?: boolean }) {
  await assertNotSettledAccrual(id);
  const data = buildData(input);
  if (!opts?.force) await assertNotDuplicate(data, id);
  return prisma.expense.update({ where: { id }, data });
}

export async function deleteExpense(id: string) {
  await assertNotSettledAccrual(id);
  // Si el gasto es una factura de colaborador que absorbía devengos, estos se
  // liberan (onDelete: SetNull) y el ciclo del pedido vuelve a pendiente: sin
  // esto quedaría BOOKED huérfano apuntando a una factura que ya no existe.
  const settles = await prisma.expense.findMany({
    where: { settledById: id },
    select: { orderReference: true },
  });
  const refs = [...new Set(settles.map((s) => s.orderReference).filter(Boolean))] as string[];
  if (refs.length === 0) return prisma.expense.delete({ where: { id } });

  const orders = await prisma.order.findMany({ where: { reference: { in: refs } }, select: { id: true } });
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.expense.delete({ where: { id } });
    for (const o of orders) {
      await tx.orderEvent.create({
        data: {
          orderId: o.id,
          type: "finance.supplier_invoice.updated",
          message: "Factura del colaborador borrada: el encargo vuelve a pendiente de factura (devengo liberado).",
          payload: { status: "PENDING_REQUEST", deletedExpenseId: id },
        },
      });
    }
    return deleted;
  });
}

// ——— Cuenta corriente por colaborador ———
// Registra la factura real del colaborador (mensual o puntual) y liquida los
// devengos elegidos: crea UN gasto factura recibida (entra en libro/303/111),
// sella settledById en los devengos y actualiza el ciclo de factura de proveedor
// de cada pedido (OrderEvent finance.supplier_invoice.updated → BOOKED).

export class AccrualMismatchError extends Error {
  expectedCents: number;
  gotCents: number;
  constructor(expectedCents: number, gotCents: number) {
    super("La base de la factura no cuadra con la suma de los devengos.");
    this.name = "AccrualMismatchError";
    this.expectedCents = expectedCents;
    this.gotCents = gotCents;
  }
}

export type CollaboratorInvoiceInput = {
  collaboratorId: string;
  accrualIds: string[];
  number: string; // nº de factura del colaborador
  date: string;
  baseCents?: number; // por defecto, la suma de los devengos
  vatRate: number;
  irpfRetentionPct?: number;
  supplierNif?: string | null;
  notes?: string | null;
  acceptMismatch?: boolean;
  force?: boolean; // saltar el chequeo de duplicados
};

export async function registerCollaboratorInvoice(input: CollaboratorInvoiceInput) {
  const collaborator = await prisma.collaborator.findUnique({
    where: { id: input.collaboratorId },
    select: { id: true, fullName: true, companyName: true, supplierType: true, nif: true },
  });
  if (!collaborator) throw new Error("Colaborador no encontrado.");

  const ids = [...new Set(input.accrualIds)].filter(Boolean);
  if (ids.length === 0) throw new Error("No hay devengos seleccionados.");
  if (!String(input.number || "").trim()) throw new Error("Falta el nº de factura del colaborador.");

  const accruals = await prisma.expense.findMany({
    where: { id: { in: ids }, isAccrual: true, settledById: null, collaboratorId: collaborator.id },
    select: { id: true, baseCents: true, orderReference: true, concept: true },
  });
  if (accruals.length !== ids.length) {
    throw new Error("Algún devengo ya está liquidado o no pertenece a este colaborador. Recarga la página.");
  }

  const sumCents = accruals.reduce((a, e) => a + e.baseCents, 0);
  // baseCents explícita: entero positivo o nada. Sin esto, un NaN/negativo se
  // coaccionaría a 0 aguas abajo y sellaría devengos reales contra una factura
  // de 0 € (hallazgo de la revisión de seguridad).
  if (input.baseCents != null && (!Number.isInteger(input.baseCents) || input.baseCents <= 0)) {
    throw new Error("Base de la factura inválida: debe ser un importe positivo en céntimos.");
  }
  const baseCents = input.baseCents ?? sumCents;
  if (baseCents !== sumCents && !input.acceptMismatch) {
    throw new AccrualMismatchError(sumCents, baseCents);
  }

  const supplierName = collaborator.companyName || collaborator.fullName;
  const supplierNif = input.supplierNif?.trim() || collaborator.nif || null;
  const refs = accruals.map((e) => e.orderReference).filter(Boolean) as string[];
  const data = buildData({
    date: input.date,
    supplier: supplierName,
    supplierNif,
    supplierInvoiceNumber: input.number,
    concept: `Factura ${supplierName} · ${accruals.length} encargo(s)${refs.length ? `: ${refs.join(", ")}` : ""}`,
    category: "colaborador",
    baseCents,
    vatRate: input.vatRate,
    irpfRetentionPct: input.irpfRetentionPct,
    notes: input.notes,
  });
  if (!input.force) await assertNotDuplicate(data);

  const orders = refs.length
    ? await prisma.order.findMany({ where: { reference: { in: refs } }, select: { id: true, reference: true } })
    : [];
  const orderIdByRef = new Map(orders.map((o) => [o.reference, o.id]));

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({ data: { ...data, collaboratorId: collaborator.id } });
    const sealed = await tx.expense.updateMany({
      where: { id: { in: ids }, isAccrual: true, settledById: null, collaboratorId: collaborator.id },
      data: { settledById: created.id },
    });
    if (sealed.count !== ids.length) {
      throw new Error("Conflicto al liquidar (otro proceso tocó los devengos). No se ha registrado nada.");
    }
    // Coser con el ciclo de factura de proveedor del pedido: la ficha deja de
    // decir "pendiente de factura" (misma semántica que el panel de finanzas).
    for (const acc of accruals) {
      const orderId = acc.orderReference ? orderIdByRef.get(acc.orderReference) : null;
      if (!orderId) continue;
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "finance.supplier_invoice.updated",
          message: `Factura proveedor registrada: ${supplierName} ${data.supplierInvoiceNumber} (liquidación de ${accruals.length} encargo(s)).`,
          payload: {
            status: "BOOKED",
            billingMode: accruals.length > 1 ? "MONTHLY_BATCH" : "PER_ORDER",
            supplierType: collaborator.supplierType,
            supplierName,
            supplierNif,
            invoiceNumber: data.supplierInvoiceNumber,
            baseCents: acc.baseCents,
            irpfRetentionPct: data.irpfRetentionPct,
            settledExpenseId: created.id,
          },
        },
      });
    }
    // Guardar el NIF en la ficha del colaborador si aún no lo tenía.
    if (!collaborator.nif && supplierNif) {
      await tx.collaborator.update({ where: { id: collaborator.id }, data: { nif: supplierNif } });
    }
    return created;
  });

  return { invoice, settledCount: ids.length, mismatch: baseCents !== sumCents ? { expectedCents: sumCents, gotCents: baseCents } : null };
}
