import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addBusinessDays, getHolidaySetFromEnv, getMadridBusinessBaseDate } from "@/lib/eta";
import {
  canTransitionWorkflow,
  getFlowProfile,
  getWorkflowState,
  isFrenchPair,
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

export async function transitionWorkflowState(options: TransitionOptions): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { reference: options.reference },
      select: {
        id: true,
        paymentStatus: true,
        deliveryState: true,
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

    return { changed: true };
  } catch (err) {
    console.error("[auto-assign] failed", err);
    return { changed: false };
  }
}
