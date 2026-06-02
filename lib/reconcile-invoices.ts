// lib/reconcile-invoices.ts — Conciliación pedidos↔facturas.
// Cierra el hueco: los ingresos del libro salen de facturas EMITIDAS, pero muchos
// pedidos COBRADOS nunca emiten factura. Aquí se listan y se emiten en lote.

import { prisma } from "@/lib/prisma";
import { issueInvoice, issueOrUpdateInvoice, suggestNextInvoiceNumber } from "@/lib/client-invoice";

// Primera fecha facturable = fin del último trimestre de IVA presentado + 1 día.
// T1 2026 presentado → 1-abr-2026. Si un cobro cae ANTES, no se retro-fecha (se
// factura con fecha de hoy para no tocar un periodo ya liquidado). Editable por env.
export const LAST_303_CLOSE = new Date(process.env.LAST_303_CLOSE || "2026-04-01T00:00:00.000Z");

export type PaidUnbilledOrder = {
  reference: string;
  clientName: string | null;
  clientEmail: string;
  title: string;
  orderAmountCents: number; // lo realmente cobrado (total con IVA)
  bookableAmountCents: number; // lo que se contabilizará (total del borrador si lo hay, si no el del pedido)
  bookableBaseCents: number;
  paidAt: string | null; // ISO
  createdAt: string;
  hasBilling: boolean;
  hasNif: boolean;
  hasFiscalName: boolean;
  draftInvoiceId: string | null;
  amountMismatch: boolean; // el borrador vinculado factura un importe distinto al cobrado
  sinFechaCobro: boolean;
};

export type BatchIssueResult = {
  reference: string;
  ok: boolean;
  number?: string;
  error?: string;
  dateAdjusted?: boolean; // se forzó a hoy (trimestre cerrado o sin fecha de cobro)
  skipped?: "already_issued";
};

export async function listPaidUnbilledOrders(): Promise<PaidUnbilledOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "PAID",
      amountCents: { gt: 0 },
      OR: [{ clientInvoice: { is: null } }, { clientInvoice: { is: { status: "DRAFT" } } }],
    },
    select: {
      reference: true,
      clientName: true,
      clientEmail: true,
      title: true,
      amountCents: true,
      paidAt: true,
      createdAt: true,
      billing: { select: { nif: true, fiscalName: true } },
      clientInvoice: { select: { id: true, status: true, totalCents: true, baseCents: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 1000,
  });

  return orders.map((o) => {
    const draft = o.clientInvoice?.status === "DRAFT" ? o.clientInvoice : null;
    const bookableAmountCents = draft ? draft.totalCents : o.amountCents;
    const bookableBaseCents = draft ? draft.baseCents : Math.round(o.amountCents / 1.21);
    return {
      reference: o.reference,
      clientName: o.clientName,
      clientEmail: o.clientEmail,
      title: o.title,
      orderAmountCents: o.amountCents,
      bookableAmountCents,
      bookableBaseCents,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      hasBilling: !!o.billing,
      hasNif: !!(o.billing?.nif && o.billing.nif.trim()),
      hasFiscalName: !!(o.billing?.fiscalName && o.billing.fiscalName.trim()),
      draftInvoiceId: draft ? o.clientInvoice!.id : null,
      amountMismatch: !!draft && draft.totalCents !== o.amountCents,
      sinFechaCobro: !o.paidAt,
    };
  });
}

type OrderForIssue = {
  id: string;
  amountCents: number;
  billing: { fiscalName: string; nif: string; address: string; city: string; postalCode: string; country: string; email: string };
  draftInvoiceId: string | null;
};

async function issueWithRetry(order: OrderForIssue, explicitNumber: string | undefined, issuedAt: Date): Promise<string | null> {
  const forYear = issuedAt.getFullYear();
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = (explicitNumber || "").trim() || (await suggestNextInvoiceNumber(forYear));
    try {
      const inv = order.draftInvoiceId
        ? await issueInvoice(order.draftInvoiceId, { number, issuedAt, origin: "reconcile_batch" })
        : await issueOrUpdateInvoice({
            orderId: order.id,
            amountCents: order.amountCents,
            billing: order.billing,
            number,
            issuedAt,
            origin: "reconcile_batch",
          });
      return inv.number ?? null;
    } catch (err: any) {
      lastErr = err;
      // Solo reintentar si fue colisión de número AUTO (no manual).
      if (explicitNumber || err?.code !== "INVOICE_NUMBER_TAKEN") throw err;
    }
  }
  throw lastErr;
}

// Resuelve la fecha de emisión efectiva de una referencia (y si se ajustó a hoy).
function effectiveIssuedAt(paidAt: Date | null, dateMode: "paid" | "today"): { date: Date; adjusted: boolean } {
  if (dateMode === "today" || !paidAt) return { date: new Date(), adjusted: dateMode === "paid" };
  if (paidAt < LAST_303_CLOSE) return { date: new Date(), adjusted: true }; // trimestre ya presentado
  return { date: paidAt, adjusted: false };
}

export async function issueInvoicesForOrders(input: {
  references: string[];
  dateMode: "paid" | "today";
  numbersByReference?: Record<string, string>;
}): Promise<{ issued: BatchIssueResult[]; failed: BatchIssueResult[] }> {
  const issued: BatchIssueResult[] = [];
  const failed: BatchIssueResult[] = [];

  // Pre-pase: fecha efectiva por referencia para ordenar el lote por fecha y que
  // los números crecientes correspondan a fechas crecientes (Art. 6 RD 1619/2012).
  const dates = await prisma.order.findMany({
    where: { reference: { in: input.references } },
    select: { reference: true, paidAt: true },
  });
  const eff = new Map<string, { date: Date; adjusted: boolean }>();
  for (const d of dates) eff.set(d.reference, effectiveIssuedAt(d.paidAt, input.dateMode));
  const sortedRefs = [...input.references].sort(
    (a, b) => (eff.get(a)?.date.getTime() ?? 0) - (eff.get(b)?.date.getTime() ?? 0)
  );

  // Secuencial a propósito: la numeración fiscal no admite carreras.
  for (const reference of sortedRefs) {
    try {
      const order = await prisma.order.findUnique({
        where: { reference },
        select: {
          id: true,
          amountCents: true,
          paymentStatus: true,
          billing: true,
          clientInvoice: { select: { id: true, status: true } },
        },
      });
      if (!order) throw new Error("Pedido no encontrado.");
      if (order.paymentStatus !== "PAID") throw new Error("El pedido no está cobrado.");
      if (order.clientInvoice?.status === "ISSUED") {
        issued.push({ reference, ok: true, skipped: "already_issued" });
        continue;
      }
      const b = order.billing;
      if (!b || !b.nif?.trim() || !b.fiscalName?.trim()) {
        throw new Error("Faltan datos fiscales (NIF y nombre). Rellénalos en el pedido antes de facturar.");
      }

      const { date: issuedAt, adjusted: dateAdjusted } = eff.get(reference) ?? effectiveIssuedAt(null, input.dateMode);

      const number = await issueWithRetry(
        {
          id: order.id,
          amountCents: order.amountCents,
          billing: {
            fiscalName: b.fiscalName,
            nif: b.nif,
            address: b.address || "",
            city: b.city || "",
            postalCode: b.postalCode || "",
            country: b.country || "España",
            email: b.email || "",
          },
          draftInvoiceId: order.clientInvoice?.status === "DRAFT" ? order.clientInvoice.id : null,
        },
        input.numbersByReference?.[reference],
        issuedAt
      );
      issued.push({ reference, ok: true, number: number ?? undefined, dateAdjusted });
    } catch (err: any) {
      failed.push({ reference, ok: false, error: err?.message || "error" });
    }
  }

  return { issued, failed };
}
