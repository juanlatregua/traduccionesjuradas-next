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
import { createDraftInvoice, issueInvoice, issueOrUpdateInvoice, updateDraftInvoice } from "@/lib/client-invoice";
import { saveBillingData } from "@/lib/orders";
import {
  customerCreditBlocker,
  defaultDueDate,
  isCreditAuthorized,
  isMonthlyBilling,
  isMonthlySecured,
  monthlyInvoiceLines,
  periodKeyOf,
  periodLabel,
} from "@/lib/credit-terms";

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
      title: true,
      langPair: true,
      clientInvoice: { select: { id: true, number: true, status: true, docKind: true, dueDate: true, paidAt: true } },
      monthlyInvoice: { select: { id: true, number: true, status: true, docKind: true, periodKey: true, dueDate: true, paidAt: true, annulledAt: true } },
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
    select: { id: true, name: true, email: true, fiscalName: true, nif: true, address: true, city: true, postalCode: true, country: true, creditEnabled: true, creditDays: true, billingCycle: true },
  });
  // Un solo sitio para los tres motivos de bloqueo (permiso, datos fiscales,
  // país): lib/credit-terms.customerCreditBlocker, probado sin base de datos.
  const blocker = customerCreditBlocker(customer ?? null);
  if (!customer) throw new CreditError(`No hay ficha de cliente para ${order.clientEmail}: créala antes de autorizar.`, 409);
  if (blocker) throw new CreditError(blocker, customer.creditEnabled ? 409 : 403);

  // Factura AGRUPADA del mes (4-sep-2026): el pedido cuelga del borrador mensual
  // del cliente y no tiene factura propia. Sin vencimiento hasta que se emita.
  if (isMonthlyBilling(customer)) {
    return authorizeMonthly({ order, customer, actorEmail: input.actorEmail, reason });
  }

  const now = new Date();
  const due = input.dueDate ? new Date(input.dueDate) : defaultDueDate(customer, now);
  if (Number.isNaN(due.getTime())) throw new CreditError("Fecha de vencimiento inválida.");
  if (due.getTime() <= now.getTime()) throw new CreditError("El vencimiento tiene que ser futuro.");
  const dias = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (dias > 90) throw new CreditError("Máximo 90 días de vencimiento.");

  // Deuda viva del cliente: informativa, NO bloquea (orden de Juan: sin tope).
  const exposure = await creditExposure(customer.email);

  if (isMonthlySecured(order.monthlyInvoice)) {
    throw new CreditError(
      `El pedido ya va en la factura agrupada de ${periodLabel(order.monthlyInvoice?.periodKey)}: no se emite además una factura propia.`,
      409
    );
  }

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

  // El grafo del workflow solo deja empezar a traducir desde PAGO_VALIDADO, y
  // ahí solo se llegaba con pago. "Asegurado" (factura emitida con vencimiento)
  // vale lo mismo para el trabajo: se cruza con el motivo escrito en el evento
  // para que en la ficha se lea que fue crédito, no un cobro. Order.status NO
  // pasa a PAID (toStatusUpdate lo respeta cuando paymentStatus no es PAID).
  try {
    const { transitionWorkflowState } = await import("@/lib/workflow-server");
    await transitionWorkflowState({
      reference: order.reference,
      to: "PAGO_VALIDADO",
      actorEmail: input.actorEmail,
      reason: `Autorizado a crédito: factura ${invoice?.number || "(sin nº)"} con vencimiento ${due.toISOString().slice(0, 10)}`,
      payload: { credit: true, invoiceNumber: invoice?.number ?? null, dueDate: due.toISOString() },
    });
  } catch (e) {
    // Ya estaba en PAGO_VALIDADO o más allá (from===to devuelve changed:false sin
    // lanzar; una arista no permitida sí lanza). No deshace la autorización.
    console.error("[credit] workflow transition", (e as Error)?.message || e);
  }

  return {
    reference: order.reference,
    invoiceNumber: invoice?.number ?? null,
    dueDate: due as Date | null,
    amountCents: order.amountCents,
    exposureBeforeCents: exposure.totalCents,
    monthly: null as null | { invoiceId: string; periodKey: string; periodLabel: string },
  };
}

type MonthlyOrder = {
  id: string;
  reference: string;
  clientEmail: string | null;
  amountCents: number;
  title?: string | null;
  langPair?: string | null;
  clientInvoice: { id: string; number: string | null; status: string; docKind: string } | null;
  monthlyInvoice: { id: string; number: string | null; status: string; docKind: string; periodKey: string | null; annulledAt: Date | null } | null;
};

type MonthlyCustomer = {
  email: string;
  fiscalName: string | null;
  nif: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  creditDays: number;
};

// Cuelga el pedido del borrador de factura del mes de ese cliente (lo crea si
// es el primero del mes) y reconstruye las líneas. Idempotente: si ya cuelga
// de una factura del mes viva, no toca nada.
async function authorizeMonthly(args: { order: MonthlyOrder; customer: MonthlyCustomer; actorEmail: string; reason: string }) {
  const { order, customer } = args;
  if (order.clientInvoice && order.clientInvoice.status === "ISSUED" && order.clientInvoice.docKind === "invoice") {
    throw new CreditError(
      `El pedido ya tiene factura propia (${order.clientInvoice.number}): no puede ir además en la factura del mes.`,
      409
    );
  }

  let invoice = order.monthlyInvoice && isMonthlySecured(order.monthlyInvoice) ? order.monthlyInvoice : null;
  let created = false;
  if (!invoice) {
    const periodKey = periodKeyOf(new Date());
    const existing = await prisma.clientInvoice.findFirst({
      where: { email: { equals: customer.email, mode: "insensitive" }, periodKey, status: "DRAFT", docKind: "invoice", annulledAt: null },
      select: { id: true, number: true, status: true, docKind: true, periodKey: true, annulledAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      invoice = existing;
    } else {
      const draft = await createDraftInvoice({
        fiscalName: customer.fiscalName!,
        nif: customer.nif,
        address: customer.address,
        city: customer.city,
        postalCode: customer.postalCode,
        country: customer.country || "España",
        email: customer.email,
        concept: `Traducciones juradas — ${periodLabel(periodKey)}`,
        lines: monthlyInvoiceLines([order]),
        vatRate: 0.21,
        orderId: null,
      });
      await prisma.clientInvoice.update({ where: { id: draft.id }, data: { periodKey, origin: "monthly_credit" } });
      invoice = { id: draft.id, number: null, status: "DRAFT", docKind: "invoice", periodKey, annulledAt: null };
      created = true;
    }
    // Datos fiscales en el pedido: los gates de entrega piden billing.requested.
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
    await prisma.order.update({ where: { id: order.id }, data: { monthlyInvoiceId: invoice.id } });
    await rebuildMonthlyDraft(invoice.id);
  }

  const label = periodLabel(invoice.periodKey);
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "order.credit_authorized",
      message: `Autorizado a crédito por ${args.actorEmail}: irá en la factura agrupada de ${label}${created ? " (borrador creado)" : ""}.`,
      payload: {
        actorEmail: args.actorEmail,
        reason: args.reason,
        monthly: true,
        periodKey: invoice.periodKey,
        invoiceId: invoice.id,
        amountCents: order.amountCents,
        customerEmail: customer.email,
      },
    },
  });

  try {
    const { transitionWorkflowState } = await import("@/lib/workflow-server");
    await transitionWorkflowState({
      reference: order.reference,
      to: "PAGO_VALIDADO",
      actorEmail: args.actorEmail,
      reason: `Autorizado a crédito: factura agrupada de ${label}`,
      payload: { credit: true, monthly: true, periodKey: invoice.periodKey },
    });
  } catch (e) {
    console.error("[credit] workflow transition (monthly)", (e as Error)?.message || e);
  }

  return {
    reference: order.reference,
    invoiceNumber: invoice.number ?? null,
    dueDate: null as Date | null,
    amountCents: order.amountCents,
    exposureBeforeCents: 0,
    monthly: { invoiceId: invoice.id, periodKey: String(invoice.periodKey), periodLabel: label },
  };
}

/**
 * Reconstruye las líneas del borrador mensual a partir de los pedidos que
 * cuelgan de él (una por pedido, en base). Solo sobre BORRADORES: una emitida
 * no se toca. Si se queda sin pedidos, el borrador se borra.
 */
export async function rebuildMonthlyDraft(invoiceId: string) {
  const inv = await prisma.clientInvoice.findUnique({
    where: { id: invoiceId },
    include: { monthlyOrders: { select: { reference: true, title: true, langPair: true, amountCents: true } } },
  });
  if (!inv || inv.status !== "DRAFT") return inv;
  if (inv.monthlyOrders.length === 0) {
    await prisma.clientInvoice.delete({ where: { id: invoiceId } });
    return null;
  }
  return updateDraftInvoice(invoiceId, {
    fiscalName: inv.fiscalName,
    nif: inv.nif,
    address: inv.address,
    city: inv.city,
    postalCode: inv.postalCode,
    country: inv.country,
    email: inv.email,
    concept: inv.concept,
    poNumber: inv.poNumber,
    lines: monthlyInvoiceLines(inv.monthlyOrders, inv.vatRate),
    vatRate: inv.vatRate,
    brand: inv.brand,
    clientName: inv.clientName,
    holderNames: inv.holderNames,
  });
}

/**
 * Emite la factura AGRUPADA del mes: número de serie, vencimiento según los
 * días pactados con el cliente, registro Verifactu (lo hace issueInvoice) y
 * rastro en cada pedido. A partir de aquí es una factura de crédito normal:
 * el vigía la persigue por vencimiento y al cobrarla se cobran sus pedidos.
 */
export async function issueMonthlyInvoice(input: { invoiceId: string; actorEmail: string; dueDate?: string | Date | null; issuedAt?: Date | null }) {
  const inv = await prisma.clientInvoice.findUnique({
    where: { id: input.invoiceId },
    include: { monthlyOrders: { select: { id: true, reference: true } } },
  });
  if (!inv) throw new CreditError("Factura no encontrada.", 404);
  if (!inv.periodKey) throw new CreditError("Esta factura no es una factura del mes.", 400);
  if (inv.status === "ISSUED") {
    return { invoiceId: inv.id, number: inv.number, dueDate: inv.dueDate, orders: inv.monthlyOrders.map((o) => o.reference), already: true };
  }
  if (inv.monthlyOrders.length === 0) throw new CreditError("La factura del mes no tiene pedidos.", 409);

  await rebuildMonthlyDraft(inv.id);

  const customer = await prisma.customer.findFirst({
    where: { email: { equals: String(inv.email || ""), mode: "insensitive" } },
    select: { creditDays: true },
  });
  const issuedAt = input.issuedAt ?? new Date();
  const due = input.dueDate ? new Date(input.dueDate) : defaultDueDate(customer, issuedAt);
  if (Number.isNaN(due.getTime())) throw new CreditError("Fecha de vencimiento inválida.");
  if (due.getTime() <= issuedAt.getTime()) throw new CreditError("El vencimiento tiene que ser posterior a la emisión.");

  const issued = await issueInvoice(inv.id, { issuedAt: input.issuedAt ?? null, origin: "monthly_credit", actor: input.actorEmail });
  await prisma.clientInvoice.update({ where: { id: inv.id }, data: { dueDate: due } });

  const label = periodLabel(inv.periodKey);
  for (const o of inv.monthlyOrders) {
    await prisma.orderEvent.create({
      data: {
        orderId: o.id,
        type: "order.credit_invoiced",
        message: `Factura agrupada de ${label} emitida: ${issued.number}, vence ${due.toISOString().slice(0, 10)}.`,
        payload: { actorEmail: input.actorEmail, invoiceId: inv.id, invoiceNumber: issued.number, periodKey: inv.periodKey, dueDate: due.toISOString() },
      },
    });
  }
  return { invoiceId: inv.id, number: issued.number, dueDate: due, orders: inv.monthlyOrders.map((o) => o.reference), already: false };
}

/** Retira la autorización. La factura NO se borra: es un documento fiscal. */
export async function revokeCredit(input: { reference: string; actorEmail: string; reason: string }) {
  const order = await prisma.order.findUnique({
    where: { reference: input.reference },
    select: {
      id: true,
      clientInvoice: { select: { id: true, number: true, paidAt: true } },
      monthlyInvoice: { select: { id: true, number: true, status: true, periodKey: true } },
    },
  });
  // Factura del mes: mientras es borrador, descolgar el pedido (y reconstruir
  // el borrador). Emitida, ya no: es un documento fiscal con el pedido dentro.
  if (order?.monthlyInvoice) {
    const m = order.monthlyInvoice;
    if (m.status === "ISSUED") {
      throw new CreditError(`El pedido ya va en la factura ${m.number} emitida: no se puede descolgar. Rectifica la factura si hace falta.`, 409);
    }
    await prisma.order.update({ where: { id: order.id }, data: { monthlyInvoiceId: null } });
    await rebuildMonthlyDraft(m.id);
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.credit_revoked",
        message: `Descolgado de la factura agrupada de ${periodLabel(m.periodKey)} por ${input.actorEmail}.`,
        payload: { actorEmail: input.actorEmail, reason: input.reason, monthly: true, periodKey: m.periodKey },
      },
    });
    return { reference: input.reference, invoiceNumber: null as string | null };
  }
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
