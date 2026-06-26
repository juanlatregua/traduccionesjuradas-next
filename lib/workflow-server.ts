import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addBusinessDays, getHolidaySetFromEnv, getMadridBusinessBaseDate } from "@/lib/eta";
import {
  canTransitionWorkflow,
  getFlowProfile,
  getWorkflowState,
  isFrenchPair,
  milestoneSmsFor,
  type WorkflowState,
} from "@/lib/workflow";
import { getDocumentsFromOrder } from "@/lib/collaborators";
import { sendFriendlyQuoteRequest } from "@/lib/collaborator-emails";
import { assertWorkflowTransitionPreconditions } from "@/lib/workflow-guards";

type TransitionOptions = {
  reference: string;
  to: WorkflowState;
  actorEmail?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
};

type TransitionResult = {
  changed: boolean;
  from: WorkflowState;
  to: WorkflowState;
};

function toStatusUpdate(to: WorkflowState, currentPaymentStatus: string): Prisma.OrderUpdateInput {
  const data: Prisma.OrderUpdateInput = {};

  if (to === "PENDIENTE_PAGO" && currentPaymentStatus !== "PAID") {
    data.status = "PENDING_PAYMENT";
  } else if (to === "PAGO_VALIDADO") {
    data.status = "PAID";
  } else if (to === "EN_TRADUCCION") {
    data.status = "IN_PROGRESS";
    data.deliveryState = "EN_PROCESO";
  } else if (to === "TRADUCIDO_ENTREGADO") {
    data.status = "DELIVERED";
    data.deliveryState = "TRADUCIDO";
  } else if (to === "CERRADO") {
    data.status = "DELIVERED";
  }

  return data;
}

function messageForTransition(from: WorkflowState, to: WorkflowState, reason?: string | null) {
  const base = `Workflow actualizado: ${from} -> ${to}.`;
  if (!reason) return base;
  return `${base} Motivo: ${reason}.`;
}

/**
 * Avisa al cliente por SMS cuando el pedido cruza un hito visible (Fase 2).
 * Vive aqui, en la transicion central, para que TODO camino que mueva el
 * estado (Kanban /workflow, cockpit, /assign, /delivery, cascada de pago)
 * dispare el aviso — antes solo lo hacia /assign (hito en proceso) y /delivery
 * con un checkbox manual (hito lista), asi que mover la tarjeta en el Kanban
 * dejaba al cliente sin noticia.
 *
 * - EN_TRADUCCION  -> "tu traduccion ya esta en proceso"
 * - TRADUCIDO_ENTREGADO -> "esta lista, descargala" (solo si hay entregable:
 *   el caller /delivery pasa payload.delivered; el Kanban se valida por
 *   Order.translatedFileUrl, para no prometer descarga sin fichero).
 *
 * Fire-and-forget: corre fuera de la transaccion y nunca bloquea ni rompe el
 * cambio de estado. Solo se invoca cuando la transicion ocurre de verdad
 * (changed=true), asi que cada hito avisa una vez.
 */
async function notifyClientMilestone(
  reference: string,
  to: WorkflowState,
  payload?: Record<string, unknown>
) {
  if (to !== "EN_TRADUCCION" && to !== "TRADUCIDO_ENTREGADO") return;
  try {
    const order = await prisma.order.findUnique({
      where: { reference },
      select: { id: true, translatedFileUrl: true, clientLocale: true },
    });
    if (!order) return;

    // Idempotencia: si este hito ya se notifico por SMS a este pedido, no
    // reenviar. Cubre la ENTREGA REAL que llega despues de un movimiento de
    // tablero que ya dejo el workflow en el hito (ver transitionWorkflowState):
    // el aviso debe salir UNA vez, lo dispare la transicion o la entrega.
    const alreadyNotified = await prisma.orderEvent.findFirst({
      where: {
        orderId: order.id,
        type: "notification.milestone_sms.sent",
        payload: { path: ["milestone"], equals: to },
      },
      select: { id: true },
    });
    if (alreadyNotified) return;

    const milestone = milestoneSmsFor(to, {
      delivered: payload?.delivered === true,
      translatedFileUrl: order.translatedFileUrl,
    });
    if (!milestone) return; // marcado entregado sin fichero: no prometer descarga

    const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
    const phone = await getOrderPhone(order.id);
    if (!phone) {
      console.warn(
        `[workflow] hito ${to} en ${reference} sin telefono del cliente — no se envia SMS`
      );
      return;
    }

    const { smsEnProceso, smsTraduccionLista } = await import("@/lib/sms-templates");
    const { buildSignedOrderUrl } = await import("@/lib/order-token");
    const lang = order.clientLocale === "fr" ? "fr" : "es";
    const url = buildSignedOrderUrl(reference, "estado");
    const body =
      milestone === "en_proceso"
        ? smsEnProceso({ ref: reference, url, lang })
        : smsTraduccionLista({ ref: reference, url, lang });

    const result = await sendNotification({ to: formatPhoneSpain(phone), body });
    // Solo registramos el hito si el envío SALIÓ BIEN: si falla, no escribimos el
    // evento de idempotencia para no suprimir reintentos futuros (alreadyNotified).
    if (result.ok) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "notification.milestone_sms.sent",
          message: `Aviso de hito ${to} enviado por SMS al cliente.`,
          payload: { milestone: to, channel: "SMS", ok: true },
        },
      });
    }
  } catch (err) {
    console.error("[workflow] milestone SMS failed", err);
  }
}

export async function transitionWorkflowState(options: TransitionOptions): Promise<TransitionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { reference: options.reference },
      select: {
        id: true,
        paymentStatus: true,
        deliveryState: true,
        translatedFileUrl: true,
        events: { orderBy: { createdAt: "desc" }, take: 80 },
      },
    });

    if (!order) {
      throw new Error("Pedido no encontrado.");
    }

    const from = getWorkflowState(order);
    const to = options.to;

    if (from === to) {
      return { changed: false, from, to };
    }

    assertWorkflowTransitionPreconditions({
      to,
      paymentStatus: order.paymentStatus,
      translatedFileUrl: order.translatedFileUrl,
      delivered: options.payload?.delivered === true,
    });

    if (!canTransitionWorkflow(from, to)) {
      throw new Error(`Transicion no permitida: ${from} -> ${to}.`);
    }

    const updateData = toStatusUpdate(to, order.paymentStatus);
    if (Object.keys(updateData).length > 0) {
      await tx.order.update({
        where: { reference: options.reference },
        data: updateData,
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "workflow.state_changed",
        message: messageForTransition(from, to, options.reason),
        payload: {
          from,
          to,
          actorEmail: options.actorEmail || null,
          reason: options.reason || null,
          ...(options.payload || {}),
        },
      },
    });

    return { changed: true, from, to };
  });

  // Aviso de hito al cliente: fuera de la transaccion, fire-and-forget.
  // Tambien cuando la transicion fue NO-OP porque el workflow ya estaba en el
  // hito (p.ej. la tarjeta se movio en el tablero ANTES de subir el fichero):
  // la entrega real (payload.delivered) aun no habia disparado el aviso "lista".
  // notifyClientMilestone es idempotente, asi que nunca duplica.
  const redeliveredMilestone = !result.changed && options.payload?.delivered === true;
  if (result.changed || redeliveredMilestone) {
    void notifyClientMilestone(options.reference, result.to, options.payload);
  }

  return result;
}

export async function assignDefaultFrenchEtaIfNeeded(options: {
  reference: string;
  actorEmail?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { reference: options.reference },
      select: {
        id: true,
        langPair: true,
        dueDate: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            type: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order || order.dueDate) {
      return { changed: false as const, dueDate: order?.dueDate || null };
    }

    const flowProfile = getFlowProfile(order.events);
    if (flowProfile !== "FR_A" || !isFrenchPair(order.langPair)) {
      return { changed: false as const, dueDate: null };
    }

    const dueDate = addBusinessDays(getMadridBusinessBaseDate(), 1, getHolidaySetFromEnv());
    await tx.order.update({
      where: { reference: options.reference },
      data: { dueDate },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "delivery.eta_default_assigned",
        message: "ETA estandar FR_A asignada: 1 dia laborable (sin contar dia de pago).",
        payload: {
          dueDate: dueDate.toISOString(),
          timezone: "Europe/Madrid",
          actorEmail: options.actorEmail || null,
          businessDays: 1,
        },
      },
    });

    return { changed: true as const, dueDate };
  });
}

const AUTO_ASSIGN_LANGUAGES = new Set(["en", "de", "pt", "it"]);

function isAutoAssignPair(langPair?: string | null): boolean {
  const normalized = String(langPair || "").trim().toLowerCase();
  const [from, to] = normalized.split("-");
  return AUTO_ASSIGN_LANGUAGES.has(from) || AUTO_ASSIGN_LANGUAGES.has(to);
}

export async function autoAssignCollaboratorIfNeeded(options: {
  reference: string;
  actorEmail?: string | null;
}): Promise<{ changed: boolean }> {
  try {
    const order = await prisma.order.findUnique({
      where: { reference: options.reference },
      select: {
        id: true,
        langPair: true,
        title: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { type: true, payload: true, createdAt: true },
        },
      },
    });

    if (!order || isFrenchPair(order.langPair) || !isAutoAssignPair(order.langPair)) {
      return { changed: false };
    }

    const collaboratorEmail = process.env.DEFAULT_COLLABORATOR_EMAIL || "juan@gestremor.com";
    const collaborator = await prisma.collaborator.findUnique({
      where: { email: collaboratorEmail },
    });

    if (!collaborator || !collaborator.active) {
      console.warn(`[auto-assign] collaborator ${collaboratorEmail} not found or inactive`);
      return { changed: false };
    }

    const existing = await prisma.collaboratorAssignment.findUnique({
      where: { orderId_collaboratorId: { orderId: order.id, collaboratorId: collaborator.id } },
    });
    if (existing) {
      return { changed: false };
    }

    const assignment = await prisma.collaboratorAssignment.create({
      data: { orderId: order.id, collaboratorId: collaborator.id },
    });

    const documents = getDocumentsFromOrder(order);

    await sendFriendlyQuoteRequest({
      collaboratorName: collaborator.fullName,
      collaboratorEmail: collaborator.email,
      orderReference: options.reference,
      orderTitle: order.title,
      langPair: order.langPair,
      accessToken: assignment.accessToken,
      documents,
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "collaborator.auto_assigned",
        message: `Colaborador ${collaborator.fullName} asignado automáticamente (${order.langPair}).`,
        payload: {
          collaboratorId: collaborator.id,
          collaboratorEmail: collaborator.email,
          langPair: order.langPair,
          actorEmail: options.actorEmail || null,
        },
      },
    });

    // El pedido queda en manos del colaborador = en proceso. Cruzar a
    // EN_TRADUCCION dispara el hito "en proceso" por SMS (notifyClientMilestone)
    // para EN/DE/PT/IT, que antes no recibian aviso al auto-asignarse al pago.
    await transitionWorkflowState({
      reference: options.reference,
      to: "EN_TRADUCCION",
      actorEmail: options.actorEmail || null,
      reason: `Colaborador ${collaborator.fullName} auto-asignado: traduccion en proceso.`,
    }).catch((err) => {
      console.error("[auto-assign] transition to EN_TRADUCCION failed", err);
    });

    return { changed: true };
  } catch (err) {
    console.error("[auto-assign] failed", err);
    return { changed: false };
  }
}
