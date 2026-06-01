// lib/reconcile-invoices.ts — Conciliación pedidos↔facturas.
// Cierra el hueco: los ingresos del libro salen de facturas EMITIDAS, pero muchos
// pedidos COBRADOS nunca emiten factura. Aquí se listan y se emiten en lote.

import { prisma } from "@/lib/prisma";
import { issueInvoice, issueOrUpdateInvoice, suggestNextInvoiceNumber } from "@/lib/client-invoice";

// Fin del último trimestre de IVA ya presentado: no se retro-fecha antes de aquí.
// T1 2026 presentado → primer día facturable = 1-abr-2026. Editable por env.
export const LAST_303_CLOSE = new Date(process.env.LAST_303_CLOSE || "2026-04-01T00:00:00.000Z");

export type PaidUnbilledOrder = {
  reference: string;
  clientName: string | null;
  clientEmail: string;
  title: string;
  amountCents: number; // total con IVA
  baseCents: number; // base sugerida (amount/1.21)
  paidAt: string | null; // ISO
  createdAt: string;
  hasBilling: boolean;
  hasNif: boolean;
  draftInvoiceId: string | null;
  sinFechaCobro: boolean;
};

export type BatchIssueResult = {
  reference: string;
  ok: boolean;
  number?: string;
  error?: string;
  dateAdjusted?: boolean; // se forzó a hoy (trimestre cerrado o sin fecha de cobro)
};

export async function listPaidUnbilledOrders(opts?: { base?: "paid" | "created" }): Promise<PaidUnbilledOrder[]> {
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
      clientInvoice: { select: { id: true, status: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 1000,
  });

  return orders.map((o) => ({
    reference: o.reference,
    clientName: o.clientName,
    clientEmail: o.clientEmail,
    title: o.title,
    amountCents: o.amountCents,
    baseCents: Math.round(o.amountCents / 1.21),
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    hasBilling: !!o.billing,
    hasNif: !!(o.billing?.nif && o.billing.nif.trim()),
    draftInvoiceId: o.clientInvoice?.status === "DRAFT" ? o.clientInvoice.id : null,
    sinFechaCobro: !o.paidAt,
  }));
}

type OrderForIssue = {
  id: string;
  amountCents: number;
  billing: { fiscalName: string; nif: string; address: string; city: string; postalCode: string; country: string; email: string };
  draftInvoiceId: string | null;
};

async function issueWithRetry(order: OrderForIssue, explicitNumber: string | undefined, issuedAt: Date): Promise<string | null> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = (explicitNumber || "").trim() || (await suggestNextInvoiceNumber());
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
      // Si el número es manual o el error no es de colisión, no reintentar.
      if (explicitNumber || !/ya está en uso/i.test(err?.message || "")) throw err;
    }
  }
  throw lastErr;
}

export async function issueInvoicesForOrders(input: {
  references: string[];
  dateMode: "paid" | "today";
  numbersByReference?: Record<string, string>;
}): Promise<{ issued: BatchIssueResult[]; failed: BatchIssueResult[] }> {
  const issued: BatchIssueResult[] = [];
  const failed: BatchIssueResult[] = [];

  // Secuencial a propósito: la numeración fiscal no admite carreras.
  for (const reference of input.references) {
    try {
      const order = await prisma.order.findUnique({
        where: { reference },
        select: {
          id: true,
          amountCents: true,
          paymentStatus: true,
          paidAt: true,
          billing: true,
          clientInvoice: { select: { id: true, status: true } },
        },
      });
      if (!order) throw new Error("Pedido no encontrado.");
      if (order.paymentStatus !== "PAID") throw new Error("El pedido no está cobrado.");
      if (order.clientInvoice?.status === "ISSUED") {
        issued.push({ reference, ok: true, number: undefined });
        continue;
      }
      const b = order.billing;
      if (!b || !b.nif?.trim() || !b.fiscalName?.trim()) {
        throw new Error("Faltan datos fiscales (NIF). Rellénalos en el pedido antes de facturar.");
      }

      // Fecha de emisión + salvaguarda de trimestre cerrado.
      let issuedAt: Date;
      let dateAdjusted = false;
      if (input.dateMode === "today" || !order.paidAt) {
        issuedAt = new Date();
        if (input.dateMode === "paid") dateAdjusted = true; // querían 'paid' pero no hay fecha
      } else if (order.paidAt < LAST_303_CLOSE) {
        issuedAt = new Date(); // trimestre ya presentado → factura del periodo actual
        dateAdjusted = true;
      } else {
        issuedAt = order.paidAt;
      }

      const number = await issueWithRetry(
        {
          id: order.id,
          amountCents: order.amountCents,
          billing: {
            fiscalName: b.fiscalName || "",
            nif: b.nif || "",
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
