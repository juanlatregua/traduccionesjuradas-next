// lib/reconcile-invoices.ts — Conciliación pedidos↔facturas.
// Cierra el hueco: los ingresos del libro salen de facturas EMITIDAS, pero muchos
// pedidos COBRADOS nunca emiten factura. Aquí se listan y se emiten en lote.

import { prisma } from "@/lib/prisma";
import { issueInvoice, issueOrUpdateInvoice, suggestNextInvoiceNumber } from "@/lib/client-invoice";
import { getLast303Close } from "@/lib/tax-close-store";

// Primera fecha facturable = fin del último trimestre de IVA presentado
// (TaxPeriodClose, ver lib/tax-close-store). Si un cobro cae ANTES, no se
// retro-fecha: se factura con fecha de hoy para no tocar un periodo liquidado.
export { getLast303Close };

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
      billingExcluded: false,
      // Los pedidos de la factura AGRUPADA del mes se facturan en ella, no sueltos.
      monthlyInvoiceId: null,
      OR: [
        { clientInvoice: { is: null } },
        { clientInvoice: { is: { status: "DRAFT" } } },
        // Un presupuesto emitido sobre el pedido NO es factura: sigue sin facturar.
        { clientInvoice: { is: { docKind: "quote" } } },
      ],
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
      clientInvoice: { select: { id: true, status: true, totalCents: true, baseCents: true, docKind: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 1000,
  });

  return orders.map((o) => {
    // Un presupuesto (docKind quote) NO es un borrador de factura: al emitir se
    // facturará el importe del pedido por el camino issueOrUpdateInvoice.
    const draft = o.clientInvoice?.status === "DRAFT" && o.clientInvoice.docKind !== "quote" ? o.clientInvoice : null;
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

export type ExcludedOrder = {
  reference: string;
  clientName: string | null;
  clientEmail: string;
  amountCents: number;
  paidAt: string | null;
  reason: string | null;
};

// Pedidos apartados del libro oficial (con motivo). Para el apartado reversible.
export async function listExcludedFromBilling(): Promise<ExcludedOrder[]> {
  const orders = await prisma.order.findMany({
    where: { billingExcluded: true },
    select: {
      reference: true,
      clientName: true,
      clientEmail: true,
      amountCents: true,
      paidAt: true,
      billingExcludedReason: true,
    },
    orderBy: { paidAt: "desc" },
    take: 500,
  });
  return orders.map((o) => ({
    reference: o.reference,
    clientName: o.clientName,
    clientEmail: o.clientEmail,
    amountCents: o.amountCents,
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    reason: o.billingExcludedReason,
  }));
}

type OrderForIssue = {
  id: string;
  amountCents: number;
  billing: { fiscalName: string; nif: string; address: string; city: string; postalCode: string; country: string; email: string };
  draftInvoiceId: string | null;
};

async function issueWithRetry(order: OrderForIssue, explicitNumber: string | undefined, issuedAt: Date, simplified: boolean): Promise<string | null> {
  const forYear = issuedAt.getFullYear();
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = (explicitNumber || "").trim() || (await suggestNextInvoiceNumber("invoice", forYear));
    try {
      const inv = order.draftInvoiceId
        ? await issueInvoice(order.draftInvoiceId, { number, issuedAt, origin: "reconcile_batch", simplified })
        : await issueOrUpdateInvoice({
            orderId: order.id,
            amountCents: order.amountCents,
            billing: order.billing,
            number,
            issuedAt,
            origin: "reconcile_batch",
            simplified,
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
function effectiveIssuedAt(paidAt: Date | null, dateMode: "paid" | "today", last303Close: Date): { date: Date; adjusted: boolean } {
  if (dateMode === "today" || !paidAt) return { date: new Date(), adjusted: dateMode === "paid" };
  if (paidAt < last303Close) return { date: new Date(), adjusted: true }; // trimestre ya presentado
  return { date: paidAt, adjusted: false };
}

// Importe máximo de una factura simplificada (IVA incluido): 400€ (RD 1619/2012).
const SIMPLIFIED_MAX_CENTS = 40000;

export async function issueInvoicesForOrders(input: {
  references: string[];
  dateMode: "paid" | "today";
  numbersByReference?: Record<string, string>;
  simplified?: boolean; // factura simplificada: ≤400€, sin exigir NIF (consumidor final)
}): Promise<{ issued: BatchIssueResult[]; failed: BatchIssueResult[] }> {
  const issued: BatchIssueResult[] = [];
  const failed: BatchIssueResult[] = [];

  // Pre-pase: fecha efectiva por referencia para ordenar el lote por fecha y que
  // los números crecientes correspondan a fechas crecientes (Art. 6 RD 1619/2012).
  const dates = await prisma.order.findMany({
    where: { reference: { in: input.references } },
    select: { reference: true, paidAt: true },
  });
  const last303Close = await getLast303Close();
  const eff = new Map<string, { date: Date; adjusted: boolean }>();
  for (const d of dates) eff.set(d.reference, effectiveIssuedAt(d.paidAt, input.dateMode, last303Close));
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
          clientName: true,
          paymentStatus: true,
          billing: true,
          monthlyInvoiceId: true,
          clientInvoice: { select: { id: true, status: true, totalCents: true, docKind: true } },
        },
      });
      if (!order) throw new Error("Pedido no encontrado.");
      if (order.paymentStatus !== "PAID") throw new Error("El pedido no está cobrado.");
      if (order.monthlyInvoiceId) throw new Error("Este pedido va en la factura agrupada del mes: no se factura suelto.");
      // Un presupuesto EMITIDO no es factura: el pedido sigue sin facturar.
      if (order.clientInvoice?.status === "ISSUED" && order.clientInvoice.docKind !== "quote") {
        issued.push({ reference, ok: true, skipped: "already_issued" });
        continue;
      }
      const b = order.billing;
      const draft = order.clientInvoice?.status === "DRAFT" && order.clientInvoice.docKind !== "quote" ? order.clientInvoice : null;
      const bookableCents = draft ? draft.totalCents : order.amountCents;

      let billing: { fiscalName: string; nif: string; address: string; city: string; postalCode: string; country: string; email: string };
      if (input.simplified) {
        // Factura simplificada: ≤400€, sin exigir NIF/nombre (consumidor final, RD 1619/2012).
        if (bookableCents > SIMPLIFIED_MAX_CENTS) {
          throw new Error("Importe >400€: requiere factura completa con NIF, no simplificada.");
        }
        billing = {
          fiscalName: b?.fiscalName?.trim() || order.clientName?.trim() || "Cliente",
          nif: b?.nif?.trim() || "",
          address: b?.address || "",
          city: b?.city || "",
          postalCode: b?.postalCode || "",
          country: b?.country || "España",
          email: b?.email || "",
        };
      } else {
        if (!b || !b.nif?.trim() || !b.fiscalName?.trim()) {
          throw new Error("Faltan datos fiscales (NIF y nombre). Rellénalos, o emite como factura simplificada si es ≤400€.");
        }
        billing = {
          fiscalName: b.fiscalName,
          nif: b.nif,
          address: b.address || "",
          city: b.city || "",
          postalCode: b.postalCode || "",
          country: b.country || "España",
          email: b.email || "",
        };
      }

      const { date: issuedAt, adjusted: dateAdjusted } = eff.get(reference) ?? effectiveIssuedAt(null, input.dateMode, last303Close);

      const number = await issueWithRetry(
        {
          id: order.id,
          amountCents: order.amountCents,
          billing,
          draftInvoiceId: draft ? order.clientInvoice!.id : null,
        },
        input.numbersByReference?.[reference],
        issuedAt,
        !!input.simplified
      );
      issued.push({ reference, ok: true, number: number ?? undefined, dateAdjusted });
    } catch (err: any) {
      failed.push({ reference, ok: false, error: err?.message || "error" });
    }
  }

  return { issued, failed };
}
