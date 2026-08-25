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
  sendLavoriSolicitud,
  sendLavoriPrecioAceptado,
  type LavoriRoute,
} from "@/lib/lavori-bridge";
import { packDocsForSobre } from "@/lib/lavori-sobre";
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
// 21-ago-2026: en/pt/it tienen TODOS carril lavori (lavoriRouteFromPair corta
// antes), así que este set ya no alcanza ningún pedido; queda como red por si
// se vacía un carril.
const AUTO_ASSIGN_LANGUAGES = new Set(["en", "pt", "it"]);

function isAutoAssignPair(langPair?: string | null): boolean {
  const normalized = String(langPair || "").trim().toLowerCase();
  const [from, to] = normalized.split("-");
  return AUTO_ASSIGN_LANGUAGES.has(from) || AUTO_ASSIGN_LANGUAGES.has(to);
}

const STAFF_ALERT_EMAIL = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";

// Fase 2 del puente: emisor precio_aceptado (contrato research/
// contrato-fase2-eventos-2026-08-12.md del repo lavori). Un pedido pagado que
// proviene de una solicitud de precio ya PROPUESTA no abre encargo nuevo: se
// comunica la aceptación al encargo existente con la cifra del propio traductor.
// Localiza la solicitud por dos vías: pedido directo (OrderEvent
// lavori.precio_propuesto) o lead→presupuesto (LavoriPriceRequest vía quoteId,
// con fallback por el expedienteRef del presupuesto). handled=false → no aplica
// y sigue el carril Fase 1 (encargo nuevo con precio 75/25).
async function emitPrecioAceptadoIfApplicable(opts: {
  order: {
    id: string;
    quoteId: string | null;
    events: Array<{ type: string; payload: unknown }>;
  };
  reference: string;
}): Promise<{ handled: boolean; changed: boolean }> {
  const { order, reference } = opts;

  // Idempotencia local: comunicado (o conflicto ya avisado) → nada que repetir.
  // En lavori además: mismo ref + mismo precio → {repetido:true} sin re-aviso.
  if (
    order.events.some(
      (e) => e.type === "lavori.precio_aceptado_enviado" || e.type === "lavori.precio_aceptado_conflicto"
    )
  ) {
    return { handled: true, changed: false };
  }

  let ref: string | null = null;
  let precioCents: number | null = null;
  let lprId: string | null = null;

  // Caso pedido directo: el precio llegó como evento sobre ESTE pedido. Los
  // events vienen desc → find da la última propuesta (cubre la corrección 35→40).
  const propuesto = order.events.find((e) => e.type === "lavori.precio_propuesto");
  if (propuesto) {
    const payload = propuesto.payload as { precioCents?: unknown } | null;
    const cents = Math.round(Number(payload?.precioCents));
    if (Number.isFinite(cents) && cents > 0) {
      precioCents = cents;
      ref = `${reference}-precio`;
    }
  }

  // Caso lead→presupuesto→pedido: la solicitud vive en LavoriPriceRequest.
  if (!ref && order.quoteId) {
    const quote = await prisma.quote.findUnique({
      where: { id: order.quoteId },
      select: { expedienteRef: true },
    });
    const or: Array<{ quoteId: string } | { expedienteRef: string }> = [{ quoteId: order.quoteId }];
    if (quote?.expedienteRef) or.push({ expedienteRef: quote.expedienteRef });
    const lpr = await prisma.lavoriPriceRequest.findFirst({
      where: { status: "PRICED", OR: or },
      orderBy: { updatedAt: "desc" },
    });
    if (lpr?.priceCents && lpr.priceCents > 0) {
      // La motor_ref del encargo en lavori es la ref de la solicitud + "-precio"
      // (así la creó buildPriceRequestPayload).
      ref = `${lpr.ref}-precio`;
      precioCents = lpr.priceCents;
      lprId = lpr.id;
    }
  }

  if (!ref || !precioCents) {
    return { handled: false, changed: false };
  }

  const result = await deliverPrecioAceptado({
    orderId: order.id,
    reference,
    ref,
    precioCents,
    lprId,
    quoteId: opts.order.quoteId,
  });
  // handled=true aunque falle: con solicitud previa jamás se abre encargo nuevo.
  return { handled: true, changed: result.ok };
}

// Envía precio_aceptado a lavori y persiste el desenlace (evento + email staff).
// Lo usan el emisor del pago (emitPrecioAceptadoIfApplicable) y el receptor de
// eventos cuando un precio_propuesto llega sobre un pedido YA pagado
// (auto-aceptación "dinero dentro", caso real 26_DFAA55 del 13-ago-2026).
export async function deliverPrecioAceptado(opts: {
  orderId: string;
  reference: string;
  ref: string; // motor_ref EXACTA del encargo en lavori
  precioCents: number;
  lprId?: string | null;
  quoteId?: string | null;
  auto?: boolean; // true si la aceptación es automática post-pago
}): Promise<{ ok: boolean; conflicto?: boolean }> {
  const { orderId, reference, ref, precioCents, lprId } = opts;
  const precio = (precioCents / 100).toFixed(2);
  const ficha = `https://www.traduccionesjuradas.net/zona-traductor/pedido/${reference}`;
  const auto = opts.auto === true;
  const staffMail = (subject: string, lines: string[]) =>
    sendMail({
      to: STAFF_ALERT_EMAIL,
      subject,
      text: lines.join("\n"),
      html: lines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[lavori-precio-aceptado] staff mail failed", err));

  const result = await sendLavoriPrecioAceptado({
    ref,
    precioParaTi: precio,
    nota: "El cliente ha aceptado y pagado. Adelante con el encargo.",
  });

  if (result.ok) {
    await prisma.orderEvent.create({
      data: {
        orderId,
        type: "lavori.precio_aceptado_enviado",
        message: `lavori: aceptación comunicada al encargo (${precio} € para el traductor${auto ? ", automática: pedido ya pagado" : ""}). Cuando acepte llegará encargo_aceptado y se asignará solo.`,
        payload: { ref, precioParaTi: precio, precioCents, repetido: result.repetido, lavoriPriceRequestId: lprId ?? null, auto },
      },
    });
    if (lprId) {
      await prisma.lavoriPriceRequest
        .update({ where: { id: lprId }, data: { status: "ACCEPTED", ...(opts.quoteId ? { quoteId: opts.quoteId } : {}) } })
        .catch((err) => console.error("[lavori-precio-aceptado] lpr update failed", err));
    }
    await staffMail(`✅ Precio aceptado comunicado a lavori (${reference})`, [
      auto
        ? `El pedido ${reference} ya estaba pagado, así que el precio propuesto por el traductor (${precio} €) se ha aceptado automáticamente hacia lavori.`
        : `El pago del pedido ${reference} ha comunicado a lavori la aceptación del precio del traductor (${precio} €).`,
      `El traductor recibirá el aviso de lavori; al aceptar el encargo, la asignación se hará sola (encargo_aceptado).`,
      `Ficha: ${ficha}`,
    ]);
    return { ok: true };
  }

  if ("conflicto" in result && result.conflicto) {
    await prisma.orderEvent.create({
      data: {
        orderId,
        type: "lavori.precio_aceptado_conflicto",
        message: `lavori: el encargo ya no está publicado (estado: ${result.estado}${result.aceptadoPor ? `, aceptado por ${result.aceptadoPor}` : ""}) — gestionar a mano.`,
        payload: { ref, precioParaTi: precio, estado: result.estado, aceptadoPor: result.aceptadoPor },
      },
    });
    await staffMail(`⚠ Conflicto al aceptar precio en lavori (${reference}) — gestionar a mano`, [
      `El pedido ${reference} está pagado, pero el encargo de lavori ya no está publicado (estado: ${result.estado}${result.aceptadoPor ? `, aceptado por ${result.aceptadoPor}` : ""}).`,
      `Lavori no ha tocado nada. Aclara el encargo con el traductor o asígnalo a mano.`,
      `Ficha: ${ficha}`,
    ]);
    return { ok: false, conflicto: true };
  }

  const error = "error" in result ? result.error : "error desconocido";
  console.error(`[lavori-precio-aceptado] fallo para ${reference}:`, error);
  await prisma.orderEvent.create({
    data: {
      orderId,
      type: "lavori.precio_aceptado_fallo",
      message: `No se pudo comunicar la aceptación del precio a lavori: ${error}. Avisar al traductor a mano.`,
      payload: { ref, precioParaTi: precio, error },
    },
  });
  await staffMail(`⚠ Pedido ${reference} pagado — lavori no recibió la aceptación del precio`, [
    `El pedido ${reference} está pagado y el aviso precio_aceptado a lavori falló: ${error}.`,
    `El traductor NO sabe que su precio fue aceptado. Avísale por lavori o gestiona a mano.`,
    `Ficha: ${ficha}`,
  ]);
  return { ok: false };
}

// Fase 1 del puente: pedido pagado → solicitud dirigida en lavori (contrato
// research/contrato-fase1-solicitudes-2026-08-10.md del repo lavori). El aviso al
// traductor lo emite lavori desde hola@lavori.es (regla: el motor nunca escribe a
// un miembro); a staff solo emails internos del motor.
async function routeOrderToLavori(opts: {
  order: {
    id: string;
    quoteId: string | null;
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

  // Fase 2 (contrato 12-ago): si este pedido nace de una SOLICITUD DE PRECIO ya
  // respondida por el traductor, pagar = aceptar su cifra → precio_aceptado al
  // encargo EXISTENTE. Jamás se abre un segundo encargo con precio recalculado.
  const aceptado = await emitPrecioAceptadoIfApplicable({ order, reference });
  if (aceptado.handled) {
    return { changed: aceptado.changed };
  }

  // Traductor EXTERNO ya fijado en el presupuesto (sello) sin solicitud lavori
  // de por medio (caso Liliana 15-ago): pagar NO abre encargo en el tablón —
  // la gestión va fuera del puente. Sin este guarda, el pago duplicaba el
  // encargo a los candidatos del carril con precio recalculado al 75%.
  if (order.quoteId) {
    const quote = await prisma.quote.findUnique({
      where: { id: order.quoteId },
      select: { translatorName: true },
    });
    if (quote?.translatorName) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "lavori.omitido_traductor_externo",
          message: `Puente lavori omitido: el presupuesto ya fija traductor (${quote.translatorName}) fuera del tablón — gestionar encargo y entrega directamente.`,
          payload: { translatorName: quote.translatorName, langPair: order.langPair },
        },
      });
      await sendMail({
        to: STAFF_ALERT_EMAIL,
        subject: `Pedido ${reference} pagado — traductor externo ${quote.translatorName}, SIN encargo lavori`,
        text: [
          `El pedido ${reference} está pagado y su presupuesto fija traductor externo: ${quote.translatorName}.`,
          `No se ha abierto encargo en lavori. Coordina el encargo y la entrega directamente.`,
          `Ficha: https://www.traduccionesjuradas.net/zona-traductor/pedido/${reference}`,
        ].join("\n"),
        html: `<p>El pedido ${reference} está pagado y su presupuesto fija traductor externo: <strong>${quote.translatorName}</strong>.</p><p>No se ha abierto encargo en lavori. Coordina el encargo y la entrega directamente.</p>`,
      }).catch((err) => console.error("[lavori-bridge] external translator mail failed", err));
      return { changed: false };
    }
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
    const sobre = await packDocsForSobre(docs);
    if (!sobre.ok) {
      return await fallbackToStaff(sobre.error);
    }
    const documentos = sobre.documentos;

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
        quoteId: true,
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
