import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";
import crypto from "node:crypto";

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
/*  Reference generator  (format: YY_XXXXXX)                           */
/* ------------------------------------------------------------------ */

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

async function generateOrderReference() {
  const now = new Date();
  const year = now.getFullYear() % 100;
  const prefix = `${twoDigits(year)}_`;
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${randomSuffix}`;
}

/* ------------------------------------------------------------------ */
/*  Create                                                             */
/* ------------------------------------------------------------------ */

export async function createOrder(input: CreateOrderInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = await generateOrderReference();
    try {
      return await prisma.order.create({
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
    } catch (err: any) {
      if (err?.code !== "P2002") {
        throw err;
      }
    }
  }
  throw new Error("No se pudo generar una referencia de pedido unica.");
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
      deliveryState: true,
    },
  });
}

export async function getOrderLookupByReferenceAndEmail(reference: string, email: string) {
  return prisma.order.findFirst({
    where: { reference, clientEmail: email.toLowerCase() },
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
      words: true,
      pagesLabel: true,
      deliveryState: true,
      events: { orderBy: { createdAt: "desc" }, take: 5 },
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
  const nextStatus = state === "TRADUCIDO" ? "DELIVERED" : state === "EN_PROCESO" ? "IN_PROGRESS" : undefined;
  return prisma.order.update({
    where: { reference },
    data: {
      deliveryState: state,
      ...(nextStatus ? { status: nextStatus } : {}),
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
/*  Assignment                                                         */
/* ------------------------------------------------------------------ */

export async function assignOrder(
  reference: string,
  assignedTo: string | null,
  dueDate: Date | null
) {
  return prisma.order.update({
    where: { reference },
    data: {
      assignedTo,
      dueDate,
      events: {
        create: {
          type: "order.assigned",
          message: assignedTo
            ? `Pedido asignado a ${assignedTo}${dueDate ? ` con fecha límite ${dueDate.toLocaleDateString("es-ES")}` : ""}.`
            : "Asignación de pedido eliminada.",
        },
      },
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
