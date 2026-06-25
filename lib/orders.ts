import { prisma } from "@/lib/prisma";
import type { OrderDocument, OrderSession, PaymentMethod } from "@prisma/client";
import crypto from "node:crypto";
import {
  buildManualPaymentProviderEventId,
  registerOrderPaymentEvent,
} from "@/lib/order-payment-idempotency";
import { inferFlowProfile, getWorkflowState } from "@/lib/workflow";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { findTranslatorProfile } from "@/lib/translators";
import { sendTranslationStartedAssignedEmail } from "@/lib/email";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CreateOrderInput = {
  clientEmail: string;
  clientName?: string;
  source: "preset" | "file" | "estimador";
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
/*  Create from funnel session                                         */
/* ------------------------------------------------------------------ */

type CreateOrderFromSessionInput = {
  session: OrderSession;
  docs: OrderDocument[];
  clientEmail: string;
  clientName?: string | null;
  clientPhone?: string | null;
};

function buildFunnelOrderTitle(docs: OrderDocument[], purpose: string | null) {
  const count = docs.length;
  const docLabel = count === 1 ? "documento" : "documentos";
  const purposeLabel = purpose === "REGULARIZACION_2026" ? " (regularización 2026)" : "";
  return `Traducción jurada · ${count} ${docLabel}${purposeLabel}`;
}

function buildFunnelLangPair(docs: OrderDocument[]) {
  const first = docs.find((doc) => doc.sourceLang);
  if (!first?.sourceLang) return null;
  const target = first.targetLang || "es";
  return `${first.sourceLang}->${target}`;
}

export async function createOrderFromSession(input: CreateOrderFromSessionInput) {
  const { session, docs, clientEmail, clientName, clientPhone } = input;
  const reference = session.reference;
  const existing = await prisma.order.findUnique({ where: { reference } });
  if (existing) {
    await linkDocumentAnalysesToOrder(reference, existing.id);
    return existing;
  }
  try {
    const langPair = buildFunnelLangPair(docs);
    const flowProfile = inferFlowProfile({ langPair });
    // Entrega en papel: materializar la dirección capturada en la puerta como
    // ShippingData del pedido (la dirección viaja en session.shippingJson).
    const isPaper = (session as any).deliveryType === "paper";
    const ship = isPaper ? ((session as any).shippingJson as Record<string, unknown> | null) : null;
    const order = await prisma.order.create({
      data: {
        reference,
        clientEmail,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        clientLocale: session.clientLocale || "es",
        source: "funnel",
        title: buildFunnelOrderTitle(docs, session.purpose),
        langPair,
        amountCents: session.totalCents,
        currency: (session.currency || "eur").toLowerCase(),
        deliveryType: isPaper ? "paper" : "pdf",
        ...(ship
          ? {
              shipping: {
                create: {
                  name: String(ship.name || clientName || ""),
                  phone: String(ship.phone || clientPhone || ""),
                  address: String(ship.address || ""),
                  city: String(ship.city || ""),
                  province: String(ship.province || ""),
                  postalCode: String(ship.postalCode || ""),
                  country: String(ship.country || "España"),
                },
              },
            }
          : {}),
        events: {
          create: [
            {
              type: "order.created",
              message: "Pedido creado desde funnel.",
              payload: {
                sessionId: session.id,
                purpose: session.purpose,
                docCount: docs.length,
              },
            },
            {
              type: "order.flow_profile",
              message: `Perfil de flujo detectado: ${flowProfile}.`,
              payload: {
                profile: flowProfile,
                source: "funnel",
              },
            },
          ],
        },
      },
    });
    await linkDocumentAnalysesToOrder(reference, order.id);
    return order;
  } catch (err: any) {
    if (err?.code === "P2002") {
      const fallback = await prisma.order.findUnique({ where: { reference } });
      if (fallback) {
        await linkDocumentAnalysesToOrder(reference, fallback.id);
        return fallback;
      }
    }
    throw err;
  }
}

// Cierra el círculo del funnel de la puerta: los DocumentAnalysis estampados
// con esta referencia en /api/puerta/checkout pasan a apuntar al Order, de modo
// que /admin/funnel cuenta bien los stages pedido/pagado. Idempotente.
async function linkDocumentAnalysesToOrder(reference: string, orderId: string) {
  try {
    await prisma.documentAnalysis.updateMany({
      where: { orderReference: reference, orderId: null },
      data: { orderId },
    });
  } catch (err) {
    console.error("[createOrderFromSession] link DocumentAnalysis failed", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Create from paid Quote  (keystone: presupuesto → pedido)           */
/* ------------------------------------------------------------------ */

type CreateOrderFromQuoteInput = {
  quoteId: string;
  quoteNumber: string;
  clientEmail: string;
  clientName?: string | null;
  clientPhone?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  totalEur: number;
  currency?: string | null;
  documentCount: number;
  expedienteRef?: string | null;
  lines?: { description: string; unitPrice: number }[];
};

// Puebla OrderDocumentItem para que un pedido grande sea gestionable documento a
// documento. Si el presupuesto vino de un expediente del cliente, usa los
// DocumentAnalysis (ricos: tipo/idioma/palabras/archivo) y los enlaza al pedido;
// si no, cae a las líneas del presupuesto.
async function populateOrderItemsFromQuote(orderId: string, input: CreateOrderFromQuoteInput) {
  try {
    if (input.expedienteRef) {
      const docs = await prisma.documentAnalysis.findMany({
        where: { sessionToken: `exp:${input.expedienteRef}` },
        orderBy: { createdAt: "asc" },
      });
      if (docs.length > 0) {
        await prisma.orderDocumentItem.createMany({
          data: docs.map((d) => ({
            orderId,
            fileName: d.fileName,
            fileUrl: d.fileUrl,
            documentType: d.documentType,
            sourceLang: d.sourceLanguage,
            targetLang: d.targetLanguage,
            words: d.estimatedWords,
            quotedCents: d.quoteAmount != null ? Math.round(d.quoteAmount * 100) : null,
          })),
        });
        // Enlaza los DocumentAnalysis del expediente al pedido (workspace los ve).
        await prisma.documentAnalysis.updateMany({
          where: { sessionToken: `exp:${input.expedienteRef}`, orderId: null },
          data: { orderId },
        });
        return;
      }
    }
    if (input.lines && input.lines.length > 0) {
      await prisma.orderDocumentItem.createMany({
        data: input.lines.map((l) => ({
          orderId,
          fileName: l.description,
          quotedCents: Math.round((l.unitPrice || 0) * 100),
        })),
      });
    }
  } catch (err) {
    console.error("[populateOrderItemsFromQuote] failed", err);
  }
}

// Crea el Order de producción a partir de un presupuesto pagado. Idempotente
// por quoteId: si ya existe el Order de ese Quote, lo devuelve sin duplicar.
// NO marca el pago ni dispara la cascada (eso lo hace el webhook con
// updateOrderPayment + workflow), solo crea el "cascarón" del pedido.
export async function createOrderShellFromQuote(input: CreateOrderFromQuoteInput) {
  const existing = await prisma.order.findFirst({ where: { quoteId: input.quoteId } });
  if (existing) return existing;

  const langPair =
    input.sourceLang && input.targetLang ? `${input.sourceLang}->${input.targetLang}` : null;
  const flowProfile = inferFlowProfile({ langPair });
  const docLabel = input.documentCount === 1 ? "documento" : "documentos";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = await generateOrderReference();
    try {
      const order = await prisma.order.create({
        data: {
          reference,
          quoteId: input.quoteId,
          clientEmail: input.clientEmail,
          clientName: input.clientName || null,
          clientPhone: input.clientPhone || null,
          source: "quote",
          title: `Traducción jurada · ${input.documentCount} ${docLabel} (presupuesto ${input.quoteNumber})`,
          langPair,
          amountCents: Math.round((input.totalEur || 0) * 100),
          currency: (input.currency || "eur").toLowerCase(),
          events: {
            create: [
              {
                type: "order.created",
                message: "Pedido creado desde presupuesto pagado.",
                payload: { quoteId: input.quoteId, quoteNumber: input.quoteNumber, docCount: input.documentCount },
              },
              {
                type: "order.flow_profile",
                message: `Perfil de flujo detectado: ${flowProfile}.`,
                payload: { profile: flowProfile, source: "quote" },
              },
            ],
          },
        },
      });
      await populateOrderItemsFromQuote(order.id, input);
      return order;
    } catch (err: any) {
      if (err?.code === "P2002") {
        const fallback = await prisma.order.findFirst({ where: { quoteId: input.quoteId } });
        if (fallback) return fallback;
        continue; // colisión de reference → reintentar
      }
      throw err;
    }
  }
  throw new Error("No se pudo crear el pedido desde el presupuesto.");
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
      clientLocale: true,
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
  externalId: string,
  options?: {
    source?: string;
    payload?: Record<string, unknown>;
  }
) {
  const providerEventId = String(externalId || "").trim();
  if (!providerEventId) {
    throw new Error("Identificador externo de pago requerido.");
  }

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

    const paymentEvent = await registerOrderPaymentEvent({
      tx,
      orderId: order.id,
      reference,
      provider: method,
      providerEventId,
      source: options?.source || "unknown",
      payload: options?.payload,
    });
    if (paymentEvent.duplicate) {
      const latest = await tx.order.findUnique({
        where: { id: order.id },
        select: { paymentStatus: true },
      });
      return { changed: false as const, alreadyPaid: latest?.paymentStatus === "PAID", duplicate: true as const };
    }

    // Atomic update: only updates if paymentStatus is not yet PAID
    // Prevents race condition when two webhooks arrive simultaneously
    const atomicResult = await tx.order.updateMany({
      where: {
        reference,
        paymentStatus: { not: "PAID" },
      },
      data: {
        paymentMethod: method,
        externalPaymentId: providerEventId,
        paymentStatus: "PAID",
        status: "PAID",
        paidAt: new Date(),
      },
    });

    if (atomicResult.count === 0) {
      // Another webhook already confirmed payment — idempotent response
      console.log(`[updateOrderPayment] Order ${reference} already confirmed, skipping`);
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "payment.duplicate_ignored",
          message: "Intento de pago duplicado ignorado por verificación atómica.",
          payload: {
            method,
            providerEventId,
            existingMethod: order.paymentMethod,
            existingExternalPaymentId: order.externalPaymentId,
            source: options?.source || "unknown",
            idempotencyKey: paymentEvent.idempotencyKey,
          },
        },
      });

      return { changed: false as const, alreadyPaid: true as const, duplicate: false as const };
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment.completed",
        message: `Pago confirmado via ${method}.`,
        payload: {
          method,
          providerEventId,
          source: options?.source || "unknown",
          idempotencyKey: paymentEvent.idempotencyKey,
          ...(options?.payload || {}),
        },
      },
    });

    return { changed: true as const, alreadyPaid: false as const, duplicate: false as const };
  });
}

export async function confirmManualPayment(
  reference: string,
  method: "BIZUM" | "TRANSFER",
  actorEmail?: string | null
) {
  return updateOrderPayment(
    reference,
    method,
    buildManualPaymentProviderEventId(reference, method),
    {
      source: "staff_manual_confirm",
      payload: {
        actorEmail: actorEmail || null,
      },
    }
  );
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
    // Entrega MULTI-archivo: lista completa. translatedFileUrl sigue siendo el
    // primero (compat con páginas/SMS/email que leen el campo único).
    deliveryFiles?: Array<{ url: string; fileKey?: string | null; filename?: string | null; mimeType?: string | null }>;
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
      ...(options?.deliveryFiles && options.deliveryFiles.length > 0 ? { deliveryFilesJson: options.deliveryFiles } : {}),
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

/**
 * Lógica cara-CLIENTE del arranque de traducción, extraída de
 * `/api/orders/[reference]/assign` para poder reutilizarla desde la adjudicación
 * (`select-bid`) y el FR-directo (`quote-request-batch`).
 *
 * Reproduce fielmente lo que hacía `/assign`:
 *  (a) resuelve el nº de jurado del traductor (param explícito desde el
 *      Collaborator ganador o, si no, fallback a `findTranslatorProfile`),
 *  (b) manda el correo "su traducción está en proceso" con nº jurado + ETA +
 *      idioma del cliente,
 *  (c) transiciona el workflow a EN_TRADUCCION SOLO si el pedido está PAID y
 *      sigue en PAGO_VALIDADO (eso dispara el SMS de hito al cliente),
 *  (d) crea el OrderEvent `client.translation_started_notified`.
 *
 * Fire-and-forget interno (los fallos de email/evento/SMS se logean y no
 * rompen el flujo), igual que en el endpoint original. Idempotente: no
 * re-notifica si el pedido ya estaba asignado al mismo traductor.
 */
export async function notifyClientTranslationStarted(params: {
  reference: string;
  translatorName: string;
  swornNumber?: string | null;
  dueDate?: Date | null;
  actorEmail?: string | null;
}) {
  const translatorName = params.translatorName?.trim();
  if (!translatorName) return;

  const orderBefore = await getOrderDetail(params.reference);
  if (!orderBefore) return;

  // Idempotencia basada en el OrderEvent, no en Order.assignedTo: los callers
  // (select-bid / quote-request-batch) escriben assignedTo ANTES de invocar esta
  // función (Kanban/Cockpit vivos, C2), así que comparar contra assignedTo daría
  // siempre falso. Nos apoyamos en si ya existe el evento de notificación.
  const alreadyNotified = orderBefore.events.some(
    (e) => e.type === "client.translation_started_notified"
  );
  const shouldNotifyClient =
    orderBefore.paymentStatus === "PAID" && !alreadyNotified;

  if (!shouldNotifyClient) return;

  const actorEmail = params.actorEmail || "system";
  const dueDate = params.dueDate || orderBefore.dueDate || null;

  // Resolver nº de jurado: preferimos el del Collaborator ganador; si no llega,
  // fallback al perfil estático (comportamiento del /assign original).
  const fallbackProfile = findTranslatorProfile(translatorName);
  const swornNumber = params.swornNumber || fallbackProfile?.swornNumber || null;

  const workflowBefore = getWorkflowState(orderBefore);
  if (workflowBefore === "PAGO_VALIDADO") {
    await transitionWorkflowState({
      reference: params.reference,
      to: "EN_TRADUCCION",
      actorEmail,
      reason: "Asignacion de traductor y arranque operativo.",
    }).catch((err) => {
      console.error("[notifyClientTranslationStarted] workflow transition failed", err);
    });
  }

  const assignLang = orderBefore.clientLocale === "fr" ? "fr" : "es";
  await sendTranslationStartedAssignedEmail({
    toEmail: orderBefore.clientEmail,
    reference: orderBefore.reference,
    translatorName,
    translatorSwornNumber: swornNumber,
    etaDateLabel: dueDate
      ? dueDate.toLocaleDateString(assignLang === "fr" ? "fr-FR" : "es-ES")
      : null,
    lang: assignLang,
  }).catch((err) => {
    console.error("[notifyClientTranslationStarted] client assign email failed", err);
  });

  await prisma.orderEvent
    .create({
      data: {
        orderId: orderBefore.id,
        type: "client.translation_started_notified",
        message: `Cliente notificado: traduccion en proceso asignada a ${translatorName}.`,
        payload: {
          actorEmail,
          assignedTo: translatorName,
          swornNumber,
          dueDate: dueDate ? dueDate.toISOString() : null,
        },
      },
    })
    .catch((err) => {
      console.error("[notifyClientTranslationStarted] notification event failed", err);
    });
  // El SMS "en proceso" lo dispara transitionWorkflowState al cruzar a
  // EN_TRADUCCION (ver arriba) — centralizado para cubrir tambien Kanban.
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
      documentAnalyses: {
        select: { fileName: true, fileUrl: true, mimeType: true, fileSize: true, createdAt: true },
      },
      collaboratorAssignments: {
        orderBy: { createdAt: "desc" },
        include: {
          collaborator: {
            select: { fullName: true, email: true },
          },
        },
      },
    },
  });
}
