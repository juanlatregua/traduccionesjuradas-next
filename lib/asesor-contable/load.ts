// lib/asesor-contable/load.ts — Carga de filas (solo lectura) y construcción del
// dossier de un periodo. Toda la lógica de cifras vive en dossier.ts (pura).

import { prisma } from "@/lib/prisma";
import { buildDossier, madridDay, periodFromTag, previousPeriodTag, type Dossier, type RawExpense, type RawInvoice, type RawOrder } from "./dossier";
import { madridStartOfMonthUtc } from "@/lib/period-grouping";

const WEEK_MS = 7 * 86_400_000;

export async function loadDossier(periodTag: string, now: Date = new Date()): Promise<Dossier | null> {
  const period = periodFromTag(periodTag);
  if (!period) return null;
  const prevTag = previousPeriodTag(periodTag);
  const previousPeriod = prevTag ? periodFromTag(prevTag) : null;
  const from = previousPeriod ? previousPeriod.gte : period.gte;
  const yearStart = madridStartOfMonthUtc(Number(period.tag.slice(0, 4)), 1);
  const invFrom = yearStart < from ? yearStart : from;

  const invSelect = {
    id: true, number: true, brand: true, issuedAt: true, createdAt: true, baseCents: true, vatCents: true, totalCents: true,
    paidAt: true, dueDate: true, annulledAt: true, rectifiesId: true, fiscalName: true,
    order: { select: { reference: true, paymentStatus: true } },
  } as const;

  const [invs, open, exps, ords] = await Promise.all([
    prisma.clientInvoice.findMany({
      where: { status: "ISSUED", docKind: "invoice", issuedAt: { gte: invFrom, lt: period.lt } },
      select: invSelect,
      orderBy: { issuedAt: "asc" },
      take: 5000,
    }),
    prisma.clientInvoice.findMany({
      where: { status: "ISSUED", docKind: "invoice", annulledAt: null, paidAt: null, issuedAt: { lt: period.lt } },
      select: invSelect,
      orderBy: { issuedAt: "asc" },
      take: 2000,
    }),
    prisma.expense.findMany({
      where: { date: { gte: new Date(from.getTime() - WEEK_MS), lt: new Date(period.lt.getTime() + WEEK_MS) } },
      orderBy: { date: "asc" },
      take: 5000,
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID", OR: [{ paidAt: { gte: from, lt: period.lt } }, { paidAt: null, createdAt: { gte: from, lt: period.lt } }] },
      select: {
        reference: true, paidAt: true, createdAt: true, amountCents: true, paymentMethod: true, billingExcluded: true,
        billingExcludedReason: true, supplierCostCents: true, assignedTo: true, langPair: true,
        clientInvoice: { select: { status: true, docKind: true, annulledAt: true } },
        monthlyInvoice: { select: { status: true, annulledAt: true } },
      },
      take: 5000,
    }),
  ]);

  const toInv = (i: (typeof invs)[number]): RawInvoice => ({
    id: i.id, number: i.number, brand: i.brand, issuedAt: i.issuedAt, createdAt: i.createdAt, baseCents: i.baseCents,
    vatCents: i.vatCents, totalCents: i.totalCents, paidAt: i.paidAt, orderPaid: i.order?.paymentStatus === "PAID",
    dueDate: i.dueDate, annulledAt: i.annulledAt, rectifiesId: i.rectifiesId, orderReference: i.order?.reference ?? null, fiscalName: i.fiscalName,
  });
  const toExp = (e: (typeof exps)[number]): RawExpense => ({
    id: e.id, date: e.date, brand: e.brand, supplier: e.supplier, supplierNif: e.supplierNif, supplierInvoiceNumber: e.supplierInvoiceNumber,
    concept: e.concept, category: e.category, baseCents: e.baseCents, vatCents: e.vatCents, totalCents: e.totalCents,
    ivaDeducible: e.ivaDeducible, taxTreatment: e.taxTreatment, irpfCents: e.irpfCents, isAccrual: e.isAccrual,
    settledById: e.settledById, needsReview: e.needsReview, attachmentUrl: e.attachmentUrl, orderReference: e.orderReference,
  });
  const toOrd = (o: (typeof ords)[number]): RawOrder => ({
    reference: o.reference, paidAt: o.paidAt, createdAt: o.createdAt, amountCents: o.amountCents,
    paymentMethod: o.paymentMethod ? String(o.paymentMethod) : null,
    billingExcluded: o.billingExcluded, billingExcludedReason: o.billingExcludedReason,
    invoiceIssued: !!o.clientInvoice && o.clientInvoice.status === "ISSUED" && o.clientInvoice.docKind === "invoice" && !o.clientInvoice.annulledAt,
    monthlyInvoiceIssued: !!o.monthlyInvoice && o.monthlyInvoice.status === "ISSUED" && !o.monthlyInvoice.annulledAt,
    supplierCostCents: o.supplierCostCents, assignedTo: o.assignedTo, langPair: o.langPair,
  });

  return buildDossier({
    period,
    previousPeriod,
    today: madridDay(now),
    invoices: invs.map(toInv),
    openInvoices: open.map(toInv),
    expenses: exps.map(toExp),
    orders: ords.map(toOrd),
  });
}
