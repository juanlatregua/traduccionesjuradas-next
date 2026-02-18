import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CreateOrderInput = {
  clientEmail: string;
  clientName?: string;
  source: "preset" | "file";
  title: string;
  langPair?: string;
  words?: number;
  pagesLabel?: string;
  amountCents: number;
  currency?: string;
};

/* ------------------------------------------------------------------ */
/*  Reference generator  (format: YY_NNN)                              */
/* ------------------------------------------------------------------ */

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

async function generateOrderReference() {
  const now = new Date();
  const year = now.getFullYear() % 100;
  const prefix = `${twoDigits(year)}_`;
  const count = await prisma.order.count({
    where: { reference: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

/* ------------------------------------------------------------------ */
/*  Create                                                             */
/* ------------------------------------------------------------------ */

export async function createOrder(input: CreateOrderInput) {
  const reference = await generateOrderReference();
  return prisma.order.create({
    data: {
      reference,
      clientEmail: input.clientEmail,
      clientName: input.clientName,
      source: input.source,
      title: input.title,
      langPair: input.langPair,
      words: input.words,
      pagesLabel: input.pagesLabel,
      amountCents: input.amountCents,
      currency: input.currency || "eur",
      events: {
        create: {
          type: "order.created",
          message: "Pedido creado y pendiente de pago.",
        },
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

export async function getOrdersByClientEmail(email: string) {
  return prisma.order.findMany({
    where: { clientEmail: email },
    orderBy: { createdAt: "desc" },
    include: {
      billing: true,
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function getOrderDetail(reference: string, clientEmail?: string) {
  return prisma.order.findFirst({
    where: {
      reference,
      ...(clientEmail ? { clientEmail } : {}),
    },
    include: {
      billing: true,
      shipping: true,
      events: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getOrderPublic(reference: string) {
  return prisma.order.findUnique({
    where: { reference },
    select: {
      reference: true,
      amountCents: true,
      currency: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      paidAt: true,
      title: true,
      langPair: true,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Payment                                                            */
/* ------------------------------------------------------------------ */

export async function updateOrderPayment(
  reference: string,
  method: PaymentMethod,
  externalId: string
) {
  return prisma.order.update({
    where: { reference },
    data: {
      paymentMethod: method,
      externalPaymentId: externalId,
      paymentStatus: "PAID",
      status: "PAID",
      paidAt: new Date(),
      events: {
        create: {
          type: "payment.completed",
          message: `Pago confirmado via ${method}.`,
        },
      },
    },
  });
}

export async function confirmManualPayment(reference: string, method: "BIZUM" | "TRANSFER") {
  return prisma.order.update({
    where: { reference },
    data: {
      paymentMethod: method,
      paymentStatus: "PAID",
      status: "PAID",
      paidAt: new Date(),
      events: {
        create: {
          type: "payment.manual_confirmed",
          message: `Pago manual confirmado (${method === "BIZUM" ? "Bizum" : "Transferencia"}).`,
        },
      },
    },
  });
}

export async function markPaymentFailed(reference: string) {
  return prisma.order.update({
    where: { reference },
    data: {
      paymentStatus: "FAILED",
      events: {
        create: {
          type: "payment.failed",
          message: "Pago fallido.",
        },
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Delivery                                                           */
/* ------------------------------------------------------------------ */

export async function updateDeliveryState(
  reference: string,
  state: "PRESUPUESTO" | "EN_PROCESO" | "TRADUCIDO",
  translatedFileUrl?: string
) {
  return prisma.order.update({
    where: { reference },
    data: {
      deliveryState: state,
      ...(translatedFileUrl ? { translatedFileUrl } : {}),
      events: {
        create: {
          type: "delivery.updated",
          message: `Estado de entrega actualizado a ${state}.`,
        },
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Billing                                                            */
/* ------------------------------------------------------------------ */

export async function saveBillingData(
  orderId: string,
  data: {
    fiscalName: string;
    nif: string;
    address: string;
    city: string;
    postalCode: string;
    country?: string;
    email: string;
  }
) {
  return prisma.billingData.upsert({
    where: { orderId },
    create: {
      orderId,
      ...data,
      country: data.country || "España",
      requested: true,
    },
    update: {
      ...data,
      country: data.country || "España",
      requested: true,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Shipping                                                           */
/* ------------------------------------------------------------------ */

export async function saveShippingData(
  orderId: string,
  data: {
    name: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country?: string;
  }
) {
  return prisma.shippingData.upsert({
    where: { orderId },
    create: {
      orderId,
      ...data,
      country: data.country || "España",
    },
    update: {
      ...data,
      country: data.country || "España",
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Staff / Translator helpers                                         */
/* ------------------------------------------------------------------ */

export async function getAllOrdersForStaff() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      billing: true,
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}
