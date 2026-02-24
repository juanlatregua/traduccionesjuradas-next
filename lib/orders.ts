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
  idempotencyKey?: string;
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
          idempotencyKey: input.idempotencyKey || null,
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
              message: "Pedido creado.",
            },
          },
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") {
        throw err;
      }

      const targets = Array.isArray(err?.meta?.target) ? err.meta.target.map(String) : [];
      const idempotencyConflict =
        Boolean(input.idempotencyKey) &&
        (targets.includes("idempotencyKey") || targets.includes("Order_idempotencyKey_key"));
      if (idempotencyConflict && input.idempotencyKey) {
        const existing = await prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return existing;
        }
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
      events: { orderBy: { createdAt: "desc" }, take: 30 },
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
      clientEmail: true,
      clientName: true,
      amountCents: true,
      currency: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
      paidAt: true,
      dueDate: true,
      title: true,
      langPair: true,
      deliveryState: true,
      quoteSnapshotJson: true,
      quotePreviewFileKey: true,
      quotePreviewFileUrl: true,
      paymentProofFileKey: true,
      finalDeliveryFileKey: true,
      finalDeliveryFileUrl: true,
      finalFilename: true,
      finalMimeType: true,
      translatedFileUrl: true,
      assignedTo: true,
      events: {
        where: {
          type: {
            in: ["workflow.state_changed", "order.source_document_uploaded"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          type: true,
          payload: true,
          createdAt: true,
        },
      },
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
      dueDate: true,
      deliveryState: true,
      events: { orderBy: { createdAt: "desc" }, take: 30 },
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
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { reference },
      select: {
        id: true,
        paymentStatus: true,
        paymentMethod: true,
        externalPaymentId: true,
      },
    });
    if (!order) {
      throw new Error("Pedido no encontrado.");
    }

    if (order.paymentStatus === "PAID") {
      const isSameProvider = order.paymentMethod === method;
      const isSameExternalId = order.externalPaymentId === externalId;
      if (!(isSameProvider && isSameExternalId)) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "payment.duplicate_ignored",
            message: "Intento de pago duplicado ignorado por idempotencia.",
            payload: {
              method,
              externalId,
              existingMethod: order.paymentMethod,
              existingExternalPaymentId: order.externalPaymentId,
            },
          },
        });
      }

      return { changed: false as const, alreadyPaid: true as const };
    }

    const updated = await tx.order.update({
      where: { reference },
      data: {
        paymentMethod: method,
        externalPaymentId: externalId,
        paymentStatus: "PAID",
        status: "PAID",
        paidAt: new Date(),
      },
      select: { id: true },
    });

    await tx.orderEvent.create({
      data: {
        orderId: updated.id,
        type: "payment.completed",
        message: `Pago confirmado via ${method}.`,
        payload: {
          method,
          externalId,
        },
      },
    });

    return { changed: true as const, alreadyPaid: false as const };
  });
}

export async function confirmManualPayment(reference: string, method: "BIZUM" | "TRANSFER") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { reference },
      select: {
        id: true,
        paymentStatus: true,
        paymentMethod: true,
      },
    });
    if (!order) {
      throw new Error("Pedido no encontrado.");
    }

    if (order.paymentStatus === "PAID") {
      if (order.paymentMethod !== method) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "payment.manual_duplicate_ignored",
            message: "Confirmacion manual ignorada: el pedido ya constaba como pagado.",
            payload: {
              requestedMethod: method,
              existingMethod: order.paymentMethod,
            },
          },
        });
      }
      return { changed: false as const, alreadyPaid: true as const };
    }

    await tx.order.update({
      where: { reference },
      data: {
        paymentMethod: method,
        paymentStatus: "PAID",
        status: "PAID",
        paidAt: new Date(),
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment.manual_confirmed",
        message: `Pago manual confirmado (${method === "BIZUM" ? "Bizum" : "Transferencia"}).`,
        payload: { method },
      },
    });

    return { changed: true as const, alreadyPaid: false as const };
  });
}

export async function markPaymentFailed(reference: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { reference },
      select: { id: true, paymentStatus: true },
    });
    if (!order) {
      throw new Error("Pedido no encontrado.");
    }
    if (order.paymentStatus === "PAID") {
      return { changed: false as const, ignored: true as const };
    }

    await tx.order.update({
      where: { reference },
      data: {
        paymentStatus: "FAILED",
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment.failed",
        message: "Pago fallido.",
      },
    });

    return { changed: true as const, ignored: false as const };
  });
}

/* ------------------------------------------------------------------ */
/*  Delivery                                                           */
/* ------------------------------------------------------------------ */

export async function updateDeliveryState(
  reference: string,
  state: "PRESUPUESTO" | "EN_PROCESO" | "TRADUCIDO",
  options?: {
    translatedFileUrl?: string;
    translatedFileKey?: string;
    translatedFilename?: string;
    translatedMimeType?: string;
    dueDate?: Date | null;
    eventMessage?: string;
  }
) {
  const nextStatus = state === "TRADUCIDO" ? "DELIVERED" : state === "EN_PROCESO" ? "IN_PROGRESS" : undefined;
  return prisma.order.update({
    where: { reference },
    data: {
      deliveryState: state,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(options?.translatedFileUrl ? { translatedFileUrl: options.translatedFileUrl } : {}),
      ...(options?.translatedFileUrl ? { finalDeliveryFileUrl: options.translatedFileUrl } : {}),
      ...(options?.translatedFileKey ? { finalDeliveryFileKey: options.translatedFileKey } : {}),
      ...(options?.translatedFilename ? { finalFilename: options.translatedFilename } : {}),
      ...(options?.translatedMimeType ? { finalMimeType: options.translatedMimeType } : {}),
      ...(options?.dueDate !== undefined ? { dueDate: options.dueDate } : {}),
      events: {
        create: {
          type: "delivery.updated",
          message: options?.eventMessage || `Estado de entrega actualizado a ${state}.`,
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
    requested?: boolean;
  }
) {
  return prisma.billingData.upsert({
    where: { orderId },
    create: {
      orderId,
      ...data,
      country: data.country || "España",
      requested: data.requested === true,
    },
    update: {
      ...data,
      country: data.country || "España",
      requested: data.requested === true,
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
      events: { orderBy: { createdAt: "desc" }, take: 150 },
    },
  });
}
