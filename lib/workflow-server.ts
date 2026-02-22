import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addBusinessDays, getHolidaySetFromEnv } from "@/lib/eta";
import {
  canTransitionWorkflow,
  getFlowProfile,
  getWorkflowState,
  isFrenchPair,
  type WorkflowState,
} from "@/lib/workflow";

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

function getMadridBusinessBaseDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value || "01");
  const day = Number(parts.find((part) => part.type === "day")?.value || "01");
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
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

    const dueDate = addBusinessDays(getMadridBusinessBaseDate(), 2, getHolidaySetFromEnv());
    await tx.order.update({
      where: { reference: options.reference },
      data: { dueDate },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "delivery.eta_default_assigned",
        message: "ETA estandar FR_A asignada: 2 dias laborables (sin contar dia de pago).",
        payload: {
          dueDate: dueDate.toISOString(),
          timezone: "Europe/Madrid",
          actorEmail: options.actorEmail || null,
          businessDays: 2,
        },
      },
    });

    return { changed: true as const, dueDate };
  });
}
