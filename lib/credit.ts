// lib/credit.ts — Autorizar un pedido a COBRO APLAZADO (acciones con Prisma).
// El predicado puro y las reglas viven en lib/credit-terms.ts; aquí solo el
// efecto. Ver allí el porqué del carril y las decisiones de Juan del 2-sep-2026.
//
// Lo que este módulo NO hace, y es deliberado:
//   · NO escribe Order.paidAt ni paymentStatus PAID.
//   · NO crea QuotePayment. Un cobro que no ha pasado no se inventa.
//   · NO llama a runQuoteToOrderBridge (ése llama a updateOrderPayment, que sella
//     paidAt sin condición: usarlo aquí fabricaría el cobro falso que evitamos).
//   · NO asigna colaborador ni abre encargo en lavori: el carril es para trabajos
//     propios de Juan, así que no hay coste externo que adelantar.

import { prisma } from "@/lib/prisma";
import { issueOrUpdateInvoice } from "@/lib/client-invoice";
import { saveBillingData } from "@/lib/orders";
import { customerCanUseCredit, defaultDueDate, isCreditAuthorized } from "@/lib/credit-terms";

export class CreditError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CreditError";
    this.status = status;
  }
}

export type AuthorizeCreditInput = {
  reference: string;
  actorEmail: string;
  reason: string;
  dueDate?: string | Date | null; // por defecto, los días pactados con el cliente
};

/**
 * Autoriza un pedido a crédito: emite su factura con vencimiento y deja rastro.
 * Idempotente: si el pedido ya tiene factura ISSUED con dueDate, no reemite nada
 * (reemitir reescribiría el número con max+1 y rompería la serie correlativa).
 */
export async function authorizeCredit(input: AuthorizeCreditInput) {
  const reason = String(input.reason || "").trim();
  if (reason.length < 10) {
    throw new CreditError("Escribe un motivo de al menos 10 caracteres: queda en el registro del pedido.");
  }

  const order = await prisma.order.findUnique({
    where: { reference: input.reference },
    select: {
      id: true,
      reference: true,
      clientEmail: true,
      clientName: true,
      amountCents: true,
      paymentStatus: true,
      billingExcluded: true,
      clientInvoice: { select: { id: true, number: true, status: true, docKind: true, dueDate: true, paidAt: true } },
    },
  });
  if (!order) throw new CreditError("Pedido no encontrado.", 404);
  if (order.paymentStatus === "PAID") throw new CreditError("Este pedido ya está cobrado.", 409);
  if (order.billingExcluded) {
    throw new CreditError("Este pedido está excluido de facturación (Bizum): no puede ir a crédito.", 409);
  }
  if (!order.amountCents || order.amountCents <= 0) {
    throw new CreditError("El pedido no tiene importe: ponlo antes de autorizar.", 409);
  }

  // El permiso es del CLIENTE, no del pedido (orden de Juan).
  const customer = await prisma.customer.findUnique({
    where: { email: String(order.clientEmail || "").toLowerCase() },
    select: { id: true, name: true, email: true, fiscalName: true, nif: true, address: true, city: true, postalCode: true, country: true, creditEnabled: true, creditDays: true },
  });
  if (!customer) {
    throw new CreditError(`No hay ficha de cliente para ${order.clientEmail}: créala antes de autorizar.`, 409);
  }
  if (!customerCanUseCredit(customer)) {
    throw new CreditError(
      `${customer.name || customer.email} no está marcado como cliente de crédito. Actívalo en su ficha si quieres trabajar y entregar antes de cobrar.`,
      403
    );
  }

  // Sin NIF la factura saldría SIMPLIFICADA (≤400 €) y a una empresa no le sirve
  // para deducirse el IVA, que es justo para lo que la pide.
  if (!String(customer.fiscalName || "").trim() || !String(customer.nif || "").trim()) {
    throw new CreditError(
      `La ficha de ${customer.name || customer.email} no tiene razón social o NIF. Rellénalos antes de autorizar: sin NIF la factura sale simplificada y no le sirve.`,
      409
    );
  }
  // issueOrUpdateInvoice fija el 21 % a fuego. Fuera de España el tipo puede ser
  // otro (intracomunitario al 0 %), así que ese caso se emite a mano.
  const pais = String(customer.country || "España").trim().toLowerCase();
  if (pais && !["españa", "espana", "spain", "es"].includes(pais)) {
    throw new CreditError(
      `El cliente es de ${customer.country}: esta factura puede no ser al 21 %. Emítela a mano en /zona-traductor/facturas con el tipo correcto y vuelve a autorizar.`,
      409
    );
  }

  const now = new Date();
  const due = input.dueDate ? new Date(input.dueDate) : defaultDueDate(customer, now);
  if (Number.isNaN(due.getTime())) throw new CreditError("Fecha de vencimiento inválida.");
  if (due.getTime() <= now.getTime()) throw new CreditError("El vencimiento tiene que ser futuro.");
  const dias = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (dias > 90) throw new CreditError("Máximo 90 días de vencimiento.");

  // Deuda viva del cliente: informativa, NO bloquea (orden de Juan: sin tope).
  const exposure = await creditExposure(customer.email);

  let invoice = order.clientInvoice;
  if (isCreditAuthorized(invoice)) {
    // Ya autorizado: solo se refresca el vencimiento si viene uno explícito.
    if (input.dueDate) {
      await prisma.clientInvoice.update({ where: { id: invoice!.id }, data: { dueDate: due } });
    }
  } else {
    if (invoice?.docKind === "quote") {
      throw new CreditError(
        `El pedido tiene un presupuesto vinculado (${invoice.number || "borrador"}): emite la factura a mano con el IVA que corresponda.`,
        409
      );
    }
    if (invoice?.status !== "ISSUED") {
      await saveBillingData(order.id, {
        fiscalName: customer.fiscalName!,
        nif: customer.nif!,
        address: customer.address || null,
        city: customer.city || null,
        postalCode: customer.postalCode || null,
        country: customer.country || "España",
        email: customer.email,
        requested: true,
      } as any);
      await issueOrUpdateInvoice({
        orderId: order.id,
        amountCents: order.amountCents,
        billing: {
          fiscalName: customer.fiscalName!,
          nif: customer.nif!,
          address: customer.address || null,
          city: customer.city || null,
          postalCode: customer.postalCode || null,
          country: customer.country || "España",
          email: customer.email,
        } as any,
        origin: "credit_authorized",
      });
    }
    const fresh = await prisma.clientInvoice.findUnique({
      where: { orderId: order.id },
      select: { id: true, number: true, status: true, docKind: true, dueDate: true, paidAt: true },
    });
    if (!fresh) throw new CreditError("No se pudo emitir la factura del pedido.", 500);
    await prisma.clientInvoice.update({ where: { id: fresh.id }, data: { dueDate: due } });
    invoice = { ...fresh, dueDate: due };
  }

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "order.credit_authorized",
      message: `Autorizado a crédito por ${input.actorEmail}: factura ${invoice?.number || "(sin nº)"} con vencimiento ${due.toISOString().slice(0, 10)}.`,
      payload: {
        actorEmail: input.actorEmail,
        reason,
        dueDate: due.toISOString(),
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.number ?? null,
        amountCents: order.amountCents,
        customerEmail: customer.email,
        exposureBeforeCents: exposure.totalCents,
      },
    },
  });

  return {
    reference: order.reference,
    invoiceNumber: invoice?.number ?? null,
    dueDate: due,
    amountCents: order.amountCents,
    exposureBeforeCents: exposure.totalCents,
  };
}

/** Retira la autorización. La factura NO se borra: es un documento fiscal. */
export async function revokeCredit(input: { reference: string; actorEmail: string; reason: string }) {
  const order = await prisma.order.findUnique({
    where: { reference: input.reference },
    select: { id: true, clientInvoice: { select: { id: true, number: true, paidAt: true } } },
  });
  if (!order?.clientInvoice) throw new CreditError("El pedido no tiene factura.", 404);
  if (order.clientInvoice.paidAt) throw new CreditError("La factura ya está cobrada: no hay nada que retirar.", 409);
  await prisma.clientInvoice.update({ where: { id: order.clientInvoice.id }, data: { dueDate: null } });
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "order.credit_revoked",
      message: `Autorización de crédito retirada por ${input.actorEmail}.`,
      payload: { actorEmail: input.actorEmail, reason: input.reason, invoiceNumber: order.clientInvoice.number },
    },
  });
  return { reference: input.reference, invoiceNumber: order.clientInvoice.number };
}

/** Deuda viva de un cliente: facturas autorizadas y sin cobrar. Informativa. */
export async function creditExposure(email: string) {
  const rows = await prisma.clientInvoice.findMany({
    where: {
      status: "ISSUED",
      docKind: "invoice",
      dueDate: { not: null },
      paidAt: null,
      email: { equals: email, mode: "insensitive" },
    },
    select: { number: true, totalCents: true, dueDate: true },
  });
  return {
    count: rows.length,
    totalCents: rows.reduce((s, r) => s + r.totalCents, 0),
    invoices: rows,
  };
}
