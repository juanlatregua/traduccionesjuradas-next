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
import {
  lavoriRouteFromPair,
  buildSolicitudPayload,
  fetchDocAsBase64,
  sendLavoriSolicitud,
  type LavoriRoute,
} from "@/lib/lavori-bridge";
import { sendMail } from "@/lib/azure-mail";
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

// "de" salió del set el 10-ago-2026: los pedidos alemanes pagados van al tablón
// lavori como solicitud dirigida (lib/lavori-bridge.ts), no a Juan Amor.
const AUTO_ASSIGN_LANGUAGES = new Set(["en", "pt", "it"]);

function isAutoAssignPair(langPair?: string | null): boolean {
  const normalized = String(langPair || "").trim().toLowerCase();
  const [from, to] = normalized.split("-");
  return AUTO_ASSIGN_LANGUAGES.has(from) || AUTO_ASSIGN_LANGUAGES.has(to);
}

const STAFF_ALERT_EMAIL = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";

// Fase 1 del puente: pedido pagado → solicitud dirigida en lavori (contrato
// research/contrato-fase1-solicitudes-2026-08-10.md del repo lavori). El aviso al
// traductor lo emite lavori desde hola@lavori.es (regla: el motor nunca escribe a
// un miembro); a staff solo emails internos del motor.
async function routeOrderToLavori(opts: {
  order: {
    id: string;
    langPair: string | null;
    words: number | null;
    amountCents: number;
    dueDate: Date | null;
    events: Array<{ type: string; payload: unknown }>;
  };
  route: LavoriRoute;
  reference: string;
  actorEmail: string | null;
}): Promise<{ changed: boolean }> {
  const { order, route, reference } = opts;

  // Idempotencia local: si ya se envió (o el aviso de fallo ya saltó), no repetir.
  // El ref del payload es además clave de idempotencia en lavori (repetir es seguro).
  if (order.events.some((e) => e.type === "lavori.solicitud_enviada")) {
    return { changed: false };
  }

  const fallbackToStaff = async (error: string) => {
    console.error(`[lavori-bridge] solicitud fallida para ${reference}:`, error);
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "lavori.solicitud_fallida",
        message: `No se pudo enviar la solicitud a lavori: ${error}. Solicitar a mano.`,
        payload: { error, langPair: order.langPair, candidatos: route.candidatos },
      },
    });
    const alertLines = [
      `El pedido ${reference} (${route.par}) está pagado y el puente a lavori falló: ${error}.`,
      `Nadie ha sido avisado. Solicítalo a mano en lavori o asigna un colaborador.`,
      `Ficha: https://www.traduccionesjuradas.net/zona-traductor/pedido/${reference}`,
    ];
    await sendMail({
      to: STAFF_ALERT_EMAIL,
      subject: `⚠ Pedido ${route.par} pagado SIN traductor — lavori no respondió (${reference})`,
      text: alertLines.join("\n"),
      html: alertLines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[lavori-bridge] staff alert failed", err));
    return { changed: false };
  };

  try {
    const docs = getDocumentsFromOrder(order);
    if (docs.length === 0) {
      return await fallbackToStaff("el pedido no tiene documentos enlazados");
    }
    const documentos = [];
    for (const doc of docs) {
      const empaquetado = await fetchDocAsBase64(doc);
      if (empaquetado) documentos.push(empaquetado);
    }
    if (documentos.length === 0) {
      return await fallbackToStaff("no se pudo descargar ningún documento del pedido");
    }

    const payload = buildSolicitudPayload({
      reference,
      route,
      amountCents: order.amountCents,
      words: order.words,
      dueDate: order.dueDate,
      documentos,
    });
    const result = await sendLavoriSolicitud(payload);
    if (!result.ok) {
      return await fallbackToStaff(result.error);
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "lavori.solicitud_enviada",
        message: `Solicitud ${route.par} enviada a lavori (encargo dirigido, ${payload.paraTi} € para el traductor).`,
        payload: {
          lavoriEncargoId: result.encargoId,
          repetido: result.repetido,
          par: route.par,
          paraTi: payload.paraTi,
          precioCliente: payload.precioCliente,
          candidatos: route.candidatos,
          documentos: documentos.length,
          actorEmail: opts.actorEmail,
        },
      },
    });
    const infoLines = [
      `El pedido ${reference} se ha solicitado en lavori como encargo dirigido (${payload.paraTi} € para el traductor).`,
      `Cuando el traductor acepte te llegará el aviso de lavori; entonces asígnalo en la ficha.`,
      `Si en 24 h nadie acepta, lavori te avisará para el plan B.`,
      `Ficha: https://www.traduccionesjuradas.net/zona-traductor/pedido/${reference}`,
    ];
    await sendMail({
      to: STAFF_ALERT_EMAIL,
      subject: `Pedido ${route.par} enviado a lavori (${reference})`,
      text: infoLines.join("\n"),
      html: infoLines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[lavori-bridge] staff info failed", err));

    // Sin transición de estado: nadie ha aceptado aún. El pedido sigue contando
    // como "pagado sin asignar" en la bandeja hasta que Juan asigne tras la
    // aceptación (vuelta manual v1) — así ningún filtro lo pierde de vista.
    return { changed: true };
  } catch (err: any) {
    return await fallbackToStaff(err?.message || "error inesperado en el puente");
  }
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
        words: true,
        amountCents: true,
        dueDate: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { type: true, payload: true, createdAt: true },
        },
      },
    });

    if (!order || isFrenchPair(order.langPair)) {
      return { changed: false };
    }

    // Carril lavori (Fase 1): la lengua tiene candidatos en el tablón → solicitud
    // dirigida en vez de auto-asignación. Un pedido pagado JAMÁS queda en silencio:
    // si el puente falla, salta el aviso de staff dentro de routeOrderToLavori.
    const lavoriRoute = lavoriRouteFromPair(order.langPair);
    if (lavoriRoute) {
      return await routeOrderToLavori({
        order,
        route: lavoriRoute,
        reference: options.reference,
        actorEmail: options.actorEmail || null,
      });
    }

    if (!isAutoAssignPair(order.langPair)) {
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

    // Regla de Juan (10-ago-2026): a Juan Amor NO se le envía nada automático
    // mientras no active su perfil de lavori — su canal es personal
    // (Juan le escribe desde juansilvamoreno@msn.com). La asignación se crea en
    // silencio y el aviso va a staff con el enlace del encargo para pegárselo.
    const encargoUrl = `https://www.traduccionesjuradas.net/encargo/${assignment.accessToken}`;
    const staffLines = [
      `El pedido ${options.reference} (${order.langPair}) está pagado y asignado internamente a ${collaborator.fullName}.`,
      `NO se le ha enviado nada automático (canal personal): escríbele tú y pásale su enlace del encargo:`,
      encargoUrl,
      `Ficha: https://www.traduccionesjuradas.net/zona-traductor/pedido/${options.reference}`,
    ];
    await sendMail({
      to: STAFF_ALERT_EMAIL,
      subject: `Pedido ${order.langPair} asignado a ${collaborator.fullName} — avísale tú (${options.reference})`,
      text: staffLines.join("\n"),
      html: staffLines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[auto-assign] staff notice failed", err));

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "collaborator.auto_assigned",
        message: `Colaborador ${collaborator.fullName} asignado automáticamente (${order.langPair}) — sin email al colaborador (canal personal); aviso a staff.`,
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
