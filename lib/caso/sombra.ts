// lib/caso/sombra.ts — F2: el resolver en MODO SOMBRA desde cada entrada.
// Reglas: el resolver corre en SU transacción y ANTES de crear (nunca dentro de la
// del llamador); todo es FAIL-OPEN (un fallo = casoId null, console.error y rastro
// si se puede; el flujo sigue igual); la clave de vigente se toma DESPUÉS del
// commit del llamador; las guardas viejas deciden y aquí solo se MIDE: cada
// comparación guarda↔resolver deja un CasoEvento "comparacion" (acuerdo sí/no).

import { prisma } from "@/lib/prisma";
import { resolverCaso, type ResolverInput } from "@/lib/caso/resolver-db";
import type { Decision } from "@/lib/caso/resolver";
import { quoteVivo, casoAbierto } from "@/lib/caso/estados";
import {
  compararDecisiones,
  decidirBarrido,
  planRecalculo,
  soloEventosDesechables,
  vivoEnCaso,
  NADA_VIVO,
  BARRIDO_VACIO_DIAS,
  type Entrada,
  type Vieja,
  type VivoEnCaso,
} from "@/lib/caso/sombra-plan";

export type Sombra = {
  casoId: string | null;
  decision: Decision;
  decisionSinAncla?: Decision;
  vivo: VivoEnCaso;
  entrada: string;
  creado: boolean;
  simulado: boolean;
};

const QUOTE_SELECT = { id: true, status: true, deletedAt: true, lostReason: true, lostReasonNote: true, liveCasoKey: true, supersededAt: true, expiredAt: true, createdAt: true } as const;
const LPR_SELECT = { par: true, status: true, createdAt: true } as const;

async function cargarVivo(casoId: string, par: string | null): Promise<VivoEnCaso> {
  const [quotes, lprs] = await Promise.all([
    prisma.quote.findMany({ where: { casoId }, select: QUOTE_SELECT }),
    prisma.lavoriPriceRequest.findMany({ where: { casoId }, select: LPR_SELECT }),
  ]);
  return vivoEnCaso({ casoId, par, quotes, lprs, ahora: new Date() });
}

async function rastroFallo(entrada: string, err: unknown) {
  await prisma.casoEvento
    .create({ data: { tipo: "fallo_resolver", actor: `system:${entrada}`, payload: { entrada, error: String((err as any)?.message || err).slice(0, 500) } } })
    .catch(() => {});
}

/** Resuelve (crea/adjunta) el caso de lo que está a punto de crearse. null = falló: seguir sin caso. */
export async function casoEnSombra(input: ResolverInput, par: string | null = null): Promise<Sombra | null> {
  try {
    const r = await resolverCaso(input);
    const vivo = r.casoId ? await cargarVivo(r.casoId, par) : NADA_VIVO;
    return {
      casoId: r.casoId,
      decision: r.decision,
      decisionSinAncla: r.decisionSinAncla,
      vivo,
      entrada: input.entrada,
      creado: r.creado,
      simulado: Boolean(input.dryRun),
    };
  } catch (err) {
    console.error(`[caso] resolver falló (${input.entrada}); se sigue sin caso:`, err);
    await rastroFallo(input.entrada, err);
    return null;
  }
}

/** Solo el casoId (entradas sin guarda que comparar). */
export async function casoIdEnSombra(input: ResolverInput): Promise<string | null> {
  return (await casoEnSombra(input))?.casoId ?? null;
}

/** Ancla de presupuesto solo si sigue vivo y su caso no está cerrado (un email viejo no reabre nada). */
export async function quoteVivoComoAncla(quoteId: string | null | undefined): Promise<string | null> {
  if (!quoteId) return null;
  try {
    const q = await prisma.quote.findUnique({ where: { id: quoteId }, select: { ...QUOTE_SELECT, caso: { select: { estado: true } } } });
    if (!q || !quoteVivo(q)) return null;
    return !q.caso || casoAbierto(q.caso.estado) ? quoteId : null;
  } catch {
    return null;
  }
}

export type ObjetoGuarda = { lprId?: string | null; lprRef?: string | null; quoteId?: string | null };

async function casoDeObjeto(o: ObjetoGuarda | undefined): Promise<string | null> {
  if (!o) return null;
  try {
    if (o.lprId) return (await prisma.lavoriPriceRequest.findUnique({ where: { id: o.lprId }, select: { casoId: true } }))?.casoId ?? null;
    if (o.lprRef) return (await prisma.lavoriPriceRequest.findUnique({ where: { ref: o.lprRef }, select: { casoId: true } }))?.casoId ?? null;
    if (o.quoteId) return (await prisma.quote.findUnique({ where: { id: o.quoteId }, select: { casoId: true } }))?.casoId ?? null;
  } catch {
    /* sin caso del objeto: se mide igual */
  }
  return null;
}

async function registrarComparacion(d: { entrada: string; casoId: string | null; dedupeKey: string; payload: Record<string, unknown> }) {
  try {
    const dedupeKey = `${d.entrada}:${d.dedupeKey}`.slice(0, 190);
    const ya = await prisma.casoEvento.findFirst({ where: { tipo: "comparacion", casoId: d.casoId, dedupeKey }, select: { id: true } });
    if (ya) return;
    await prisma.casoEvento.create({ data: { casoId: d.casoId, tipo: "comparacion", dedupeKey, actor: `system:${d.entrada}`, payload: d.payload as any } });
  } catch (err: any) {
    if (err?.code !== "P2002") console.error("[caso] no se pudo registrar la comparación:", err);
  }
}

/** Compara la decisión de la guarda vieja con lo que ve el resolver y la anota SIEMPRE (acuerdo o no). */
export async function compararGuarda(o: {
  vieja: Vieja;
  guarda: string;
  objeto: "solicitud" | "presupuesto";
  sombra: Sombra | null;
  objetoGuarda?: ObjetoGuarda;
  refs?: Record<string, unknown>;
  dedupeKey: string;
}): Promise<void> {
  if (!o.sombra) return;
  try {
    const casoGuarda = await casoDeObjeto(o.objetoGuarda);
    const c = compararDecisiones({ vieja: o.vieja, objeto: o.objeto, sombra: o.sombra, casoGuarda, simulado: o.sombra.simulado });
    await registrarComparacion({
      entrada: o.sombra.entrada,
      casoId: c.casoResolver,
      dedupeKey: `${o.objeto}:${o.dedupeKey}`,
      payload: { entrada: o.sombra.entrada, guarda: o.guarda, objeto: o.objeto, decisionVieja: o.vieja, ...c, posibles: o.sombra.decision.posibles, vivo: o.sombra.vivo, refs: o.refs || {} },
    });
  } catch (err) {
    console.error("[caso] comparar guarda falló:", err);
  }
}

/** La guarda vieja bloqueó: el resolver opina sin escribir (dry-run) y se anota. */
export async function sombraBloqueo(
  input: Omit<ResolverInput, "dryRun">,
  par: string | null,
  o: { guarda: string; objeto?: "solicitud" | "presupuesto"; objetoGuarda?: ObjetoGuarda; refs?: Record<string, unknown>; dedupeKey: string }
): Promise<void> {
  const sombra = await casoEnSombra({ ...input, dryRun: true }, par);
  await compararGuarda({ vieja: "bloquea", guarda: o.guarda, objeto: o.objeto || "solicitud", sombra, objetoGuarda: o.objetoGuarda, refs: o.refs, dedupeKey: o.dedupeKey });
}

/**
 * Tras el commit del llamador: el presupuesto nuevo pasa a ser la vigente del caso.
 * Si la clave la tiene uno que ya no está vivo, se mueve (la vieja a null en la
 * misma transacción; ningún status cambia). Si la tiene uno vivo, no se toma y la
 * comparación queda en desacuerdo («segundo_presupuesto_vivo»).
 */
export async function tomarVigente(
  quoteId: string,
  casoId: string | null | undefined,
  entrada: Entrada | string,
  opts: { restaurado?: boolean } = {}
): Promise<void> {
  if (!casoId) return;
  const dedupeKey = `presupuesto:${quoteId}${opts.restaurado ? ":restore" : ""}`;
  try {
    const ocupada = await prisma.quote.findUnique({ where: { liveCasoKey: casoId }, select: { ...QUOTE_SELECT, quoteNumber: true } });
    const viva = !!ocupada && ocupada.id !== quoteId && quoteVivo(ocupada);
    if (!viva) {
      await prisma.$transaction([
        ...(ocupada && ocupada.id !== quoteId
          ? [prisma.quote.updateMany({ where: { id: ocupada.id, liveCasoKey: casoId }, data: { liveCasoKey: null } })]
          : []),
        prisma.quote.updateMany({ where: { id: quoteId, casoId, deletedAt: null, liveCasoKey: null }, data: { liveCasoKey: casoId } }),
      ]);
    }
    await registrarComparacion({
      entrada,
      casoId,
      dedupeKey,
      payload: {
        entrada,
        guarda: "liveCasoKey",
        objeto: "presupuesto",
        decisionVieja: "crea",
        acuerdo: !viva,
        motivo: viva ? "segundo_presupuesto_vivo" : null,
        casoResolver: casoId,
        refs: { nuevo: quoteId, ...(ocupada && ocupada.id !== quoteId ? { anterior: ocupada.quoteNumber, anteriorViva: viva, movida: !viva } : {}) },
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      await registrarComparacion({
        entrada,
        casoId,
        dedupeKey,
        payload: { entrada, guarda: "liveCasoKey", objeto: "presupuesto", decisionVieja: "crea", acuerdo: false, motivo: "segundo_presupuesto_vivo", casoResolver: casoId, refs: { nuevo: quoteId, carrera: true } },
      });
    } else {
      console.error("[caso] no se pudo fijar la vigente:", err);
    }
  }
  await recalcularCaso(casoId, `system:${entrada}`, "presupuesto");
}

/** Estampa el caso en los documentos de una sesión que aún no lo tienen. */
export async function estamparSesion(sessionToken: string, casoId: string | null | undefined): Promise<void> {
  if (!casoId || !sessionToken) return;
  await prisma.documentAnalysis
    .updateMany({ where: { sessionToken, casoId: null }, data: { casoId } })
    .catch((err) => console.error("[caso] estampar sesión falló:", err));
}

async function contarHijos(casoId: string): Promise<number> {
  const n = await Promise.all([
    prisma.quote.count({ where: { casoId } }),
    prisma.lavoriPriceRequest.count({ where: { casoId } }),
    prisma.order.count({ where: { casoId } }),
    prisma.inboundEmail.count({ where: { casoId } }),
    prisma.documentAnalysis.count({ where: { casoId } }),
  ]);
  return n.reduce((a, x) => a + x, 0);
}

/** El resolver acaba de crear el caso y lo que iba a colgar de él no llegó a crearse: fuera. */
export async function descartarCasoSiVacio(sombra: Sombra | null | undefined): Promise<void> {
  if (!sombra?.creado || !sombra.casoId) return;
  try {
    if ((await contarHijos(sombra.casoId)) > 0) return;
    const eventos = await prisma.casoEvento.findMany({ where: { casoId: sombra.casoId }, select: { tipo: true } });
    if (!soloEventosDesechables(eventos.map((e) => e.tipo))) return;
    await prisma.caso.deleteMany({ where: { id: sombra.casoId } });
  } catch (err) {
    console.error("[caso] descartar caso vacío falló:", sombra.casoId, err);
  }
}

/** Recalcula el estado del caso desde sus hijos (transiciones con puedeCaso). Fail-open. */
export async function recalcularCaso(casoId: string | null | undefined, actor: string, motivo?: string): Promise<void> {
  if (!casoId) return;
  try {
    const caso = await prisma.caso.findUnique({
      where: { id: casoId },
      select: {
        estado: true,
        closedAt: true,
        quotes: { select: QUOTE_SELECT },
        priceRequests: { select: LPR_SELECT },
        orders: { select: { status: true, paymentStatus: true, deliveryState: true } },
      },
    });
    if (!caso) return;
    const ahora = new Date();
    const plan = planRecalculo({ casoId, estado: caso.estado, closedAt: caso.closedAt, pedidos: caso.orders, quotes: caso.quotes, lprs: caso.priceRequests, ahora });
    if (!plan || (!plan.cambia && plan.closedAt === "dejar")) return;
    const hecho = await prisma.caso.updateMany({
      where: { id: casoId, estado: caso.estado },
      data: {
        estado: plan.estado,
        lastActivityAt: ahora,
        ...(plan.closedAt === "poner" ? { closedAt: ahora } : plan.closedAt === "quitar" ? { closedAt: null } : {}),
      },
    });
    if (hecho.count && plan.cambia) {
      await prisma.casoEvento.create({ data: { casoId, tipo: "transicion", actor, payload: { de: caso.estado, a: plan.estado, motivo: motivo || null } } });
    }
  } catch (err) {
    console.error("[caso] recalcular falló:", casoId, err);
  }
}

export async function recalcularCasoDePedido(reference: string, actor: string, motivo?: string): Promise<void> {
  try {
    const o = await prisma.order.findUnique({ where: { reference }, select: { casoId: true } });
    await recalcularCaso(o?.casoId, actor, motivo);
  } catch (err) {
    console.error("[caso] recalcular por pedido falló:", reference, err);
  }
}

/** Pedido recién creado: hereda el caso de su presupuesto o de los documentos de su sesión. */
export async function adjuntarPedidoACaso(orderId: string, actor: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { casoId: true, reference: true, clientEmail: true, clientPhone: true, quote: { select: { casoId: true } } },
    });
    if (!order) return;
    let casoId = order.casoId;
    if (!casoId) {
      casoId =
        order.quote?.casoId ||
        (
          await prisma.documentAnalysis.findFirst({
            where: { OR: [{ orderId }, { orderReference: order.reference }], casoId: { not: null } },
            select: { casoId: true },
          })
        )?.casoId ||
        null;
      // Autopago de la puerta sin caso (p. ej. el resolver falló al pedir presupuesto): se resuelve ahora.
      if (!casoId && !order.quote) {
        casoId = await casoIdEnSombra({
          entrada: "puerta_pago",
          contacto: { email: order.clientEmail, phone: order.clientPhone },
          anclas: { orderId },
          actor,
        });
      }
      if (!casoId) return;
      await prisma.order.updateMany({ where: { id: orderId, casoId: null }, data: { casoId } });
    }
    await recalcularCaso(casoId, actor, `pedido ${order.reference}`);
  } catch (err) {
    console.error("[caso] adjuntar pedido falló:", orderId, err);
  }
}

/** Barrido (cron, idempotente, fail-open): ABIERTO vacío → borrar; ABIERTO sin nada vivo → PERDIDO. */
export async function barrerCasosSinVida(ahora = new Date()): Promise<{ borrados: number; perdidos: number }> {
  const out = { borrados: 0, perdidos: 0 };
  try {
    const casos = await prisma.caso.findMany({
      where: { estado: "ABIERTO", lastActivityAt: { lt: new Date(ahora.getTime() - BARRIDO_VACIO_DIAS * 864e5) } },
      orderBy: { lastActivityAt: "asc" },
      take: 200,
      select: {
        id: true,
        estado: true,
        lastActivityAt: true,
        quotes: { select: QUOTE_SELECT },
        priceRequests: { select: LPR_SELECT },
        eventos: { select: { tipo: true } },
        _count: { select: { orders: true, inbound: true, analyses: true } },
      },
    });
    for (const c of casos) {
      const accion = decidirBarrido({
        estado: c.estado,
        lastActivityAt: c.lastActivityAt,
        ahora,
        hijos: c.quotes.length + c.priceRequests.length + c._count.orders + c._count.inbound + c._count.analyses,
        quotes: c.quotes,
        lprs: c.priceRequests,
        pedidos: c._count.orders,
        tiposEventos: c.eventos.map((e) => e.tipo),
      });
      if (accion === "borrar") {
        if ((await contarHijos(c.id)) > 0) continue;
        out.borrados += (await prisma.caso.deleteMany({ where: { id: c.id, estado: "ABIERTO" } })).count;
      } else if (accion === "perder") {
        const hecho = await prisma.caso.updateMany({ where: { id: c.id, estado: "ABIERTO", lastActivityAt: c.lastActivityAt }, data: { estado: "PERDIDO", closedAt: ahora } });
        if (hecho.count) {
          out.perdidos += 1;
          await prisma.casoEvento.create({ data: { casoId: c.id, tipo: "transicion", actor: "system:barrido", payload: { de: "ABIERTO", a: "PERDIDO", motivo: "sin nada vivo" } } });
        }
      }
    }
  } catch (err) {
    console.error("[caso] barrido falló:", err);
  }
  return out;
}
