// lib/recurring-invoice.ts — Plantillas de facturas recurrentes (p.ej. cuota
// mensual de Oracle). El cron genera un BORRADOR por mes; nunca emite.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createDraftInvoice, type InvoiceLine } from "@/lib/client-invoice";
import { clampVatRate, normalizeLines } from "@/lib/invoice-math";

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

function clampDay(n: number): number {
  const x = Math.round(Number(n) || 1);
  return Math.min(28, Math.max(1, x));
}

export type RecurringInput = {
  label: string;
  active?: boolean;
  brand?: string | null;
  clientName?: string | null;
  fiscalName: string;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  conceptTemplate?: string | null;
  poNumber?: string | null;
  langPair?: string | null;
  lines: InvoiceLine[];
  vatRate: number;
  dayOfMonth: number;
  notes?: string | null;
};

function buildData(input: RecurringInput) {
  const lines = normalizeLines(input.lines);
  return {
    label: String(input.label || "").trim(),
    active: input.active ?? true,
    brand: input.brand?.trim() || "traduccionesjuradas",
    clientName: input.clientName?.trim() || null,
    fiscalName: String(input.fiscalName || "").trim(),
    nif: input.nif?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    postalCode: input.postalCode?.trim() || null,
    country: input.country?.trim() || "España",
    email: input.email?.trim() || null,
    conceptTemplate: input.conceptTemplate?.trim() || null,
    poNumber: input.poNumber?.trim() || null,
    langPair: input.langPair?.trim() || null,
    lineItemsJson: lines as unknown as Prisma.InputJsonValue,
    vatRate: clampVatRate(input.vatRate),
    dayOfMonth: clampDay(input.dayOfMonth),
    notes: input.notes?.trim() || null,
  };
}

export async function listRecurring() {
  return prisma.recurringInvoice.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
}

export async function createRecurring(input: RecurringInput) {
  if (!String(input.label || "").trim()) throw new Error("Falta el nombre de la plantilla.");
  if (!String(input.fiscalName || "").trim()) throw new Error("Falta el nombre fiscal del cliente.");
  return prisma.recurringInvoice.create({ data: buildData(input) });
}

export async function updateRecurring(id: string, input: RecurringInput) {
  if (!String(input.fiscalName || "").trim()) throw new Error("Falta el nombre fiscal del cliente.");
  return prisma.recurringInvoice.update({ where: { id }, data: buildData(input) });
}

export async function deleteRecurring(id: string) {
  return prisma.recurringInvoice.delete({ where: { id } });
}

// Genera (o recupera) el BORRADOR del periodo para una plantilla. Idempotente.
export async function generateDraftForPeriod(templateId: string, opts?: { period?: string; force?: boolean }) {
  const tpl = await prisma.recurringInvoice.findUnique({ where: { id: templateId } });
  if (!tpl) throw new Error("Plantilla no encontrada.");
  const period = opts?.period || periodKey();

  // Idempotencia: si ya se generó este periodo y el borrador sigue vivo, no duplicar.
  if (tpl.lastGeneratedPeriod === period && tpl.lastGeneratedInvoiceId) {
    const existing = await prisma.clientInvoice.findUnique({
      where: { id: tpl.lastGeneratedInvoiceId },
      select: { id: true, status: true },
    });
    if (existing) {
      if (!opts?.force || existing.status === "DRAFT") {
        return { created: false, invoiceId: existing.id, reason: "Ya existe la factura de este periodo." };
      }
    }
  }

  const lines = Array.isArray(tpl.lineItemsJson) ? (tpl.lineItemsJson as unknown as InvoiceLine[]) : [];
  const draft = await createDraftInvoice({
    brand: tpl.brand,
    clientName: tpl.clientName,
    fiscalName: tpl.fiscalName,
    nif: tpl.nif,
    address: tpl.address,
    city: tpl.city,
    postalCode: tpl.postalCode,
    country: tpl.country,
    email: tpl.email,
    concept: resolveConcept(tpl.conceptTemplate || tpl.label, period),
    poNumber: tpl.poNumber,
    langPair: tpl.langPair,
    lines,
    vatRate: tpl.vatRate,
    orderId: null,
  });

  await prisma.recurringInvoice.update({
    where: { id: templateId },
    data: { lastGeneratedPeriod: period, lastGeneratedInvoiceId: draft.id },
  });
  return { created: true, invoiceId: draft.id, period };
}

// Cron mensual: genera borradores de las plantillas activas cuyo día ya llegó.
export async function runMonthlyRecurringDrafts(now: Date = new Date()) {
  const period = periodKey(now);
  const day = now.getUTCDate();
  const templates = await prisma.recurringInvoice.findMany({ where: { active: true } });
  const results: { id: string; created: boolean; invoiceId?: string; error?: string }[] = [];
  for (const tpl of templates) {
    if (day >= clampDay(tpl.dayOfMonth) && tpl.lastGeneratedPeriod !== period) {
      try {
        const r = await generateDraftForPeriod(tpl.id, { period });
        results.push({ id: tpl.id, created: r.created, invoiceId: r.invoiceId });
      } catch (e: any) {
        results.push({ id: tpl.id, created: false, error: e?.message || "error" });
      }
    }
  }
  return { period, generated: results.filter((r) => r.created).length, results };
}
