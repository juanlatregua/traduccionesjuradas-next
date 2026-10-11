// lib/caso/sombra.ts — F2: el resolver en MODO SOMBRA desde cada entrada.
// Reglas: el resolver corre en SU transacción y ANTES de crear (nunca dentro de la
// del llamador); todo es FAIL-OPEN (un fallo = casoId null, console.error y rastro
// si se puede; el flujo sigue igual); la clave de vigente se toma DESPUÉS del
// commit del llamador; las guardas viejas deciden y aquí solo se anota la
// discrepancia (CasoEvento "discrepancia").

import { prisma } from "@/lib/prisma";
import { resolverCaso, type ResolverInput } from "@/lib/caso/resolver-db";
import type { Decision } from "@/lib/caso/resolver";
import { quoteVivo } from "@/lib/caso/estados";
import { decidirDiscrepancia, planRecalculo, vivoEnCaso, NADA_VIVO, type Entrada, type Vieja, type VivoEnCaso } from "@/lib/caso/sombra-plan";

export type Sombra = { casoId: string | null; decision: Decision; vivo: VivoEnCaso; entrada: string };

const QUOTE_SELECT = { id: true, status: true, deletedAt: true, lostReason: true, liveCasoKey: true, supersededAt: true, createdAt: true } as const;

async function cargarVivo(casoId: string, par: string | null): Promise<VivoEnCaso> {
  const [quotes, lprs] = await Promise.all([
    prisma.quote.findMany({ where: { casoId }, select: QUOTE_SELECT }),
    prisma.lavoriPriceRequest.findMany({ where: { casoId }, select: { par: true, status: true, createdAt: true } }),
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
    return { casoId: r.casoId, decision: r.decision, vivo, entrada: input.entrada };
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

export async function registrarDiscrepancia(d: {
  entrada: string;
  casoId: string | null;
  guarda: string;
  motivo: string;
  decisionVieja: Vieja | string;
  decisionResolver?: Decision | null;
  refs?: Record<string, unknown>;
  dedupeKey?: string | null;
}): Promise<void> {
  try {
    const dedupeKey = d.dedupeKey ? `${d.motivo}:${d.dedupeKey}`.slice(0, 190) : null;
    if (dedupeKey) {
      const ya = await prisma.casoEvento.findFirst({ where: { tipo: "discrepancia", casoId: d.casoId, dedupeKey }, select: { id: true } });
      if (ya) return;
    }
    await prisma.casoEvento.create({
      data: {
        casoId: d.casoId,
        tipo: "discrepancia",
        dedupeKey,
        actor: `system:${d.entrada}`,
        payload: {
          entrada: d.entrada,
          guarda: d.guarda,
          motivo: d.motivo,
          decisionVieja: d.decisionVieja,
          decisionResolver: d.decisionResolver ? { accion: d.decisionResolver.accion, regla: d.decisionResolver.regla, casoId: d.decisionResolver.casoId ?? null, posibles: d.decisionResolver.posibles } : null,
          refs: (d.refs || {}) as any,
        },
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") return;
    console.error("[caso] no se pudo registrar la discrepancia:", err);
  }
}

/** Compara la decisión de la guarda vieja con lo que ve el resolver y anota si difieren. */
export async function compararGuarda(o: {
  vieja: Vieja;
  guarda: string;
  objeto: "solicitud" | "presupuesto";
  sombra: Sombra | null;
  refs?: Record<string, unknown>;
  dedupeKey?: string | null;
}): Promise<void> {
  if (!o.sombra) return;
  const motivo = decidirDiscrepancia(o.vieja, o.sombra, o.objeto);
  if (!motivo) return;
  await registrarDiscrepancia({
    entrada: o.sombra.entrada,
    casoId: o.sombra.decision.accion === "adjuntar" ? o.sombra.decision.casoId ?? null : o.sombra.casoId,
    guarda: o.guarda,
    motivo,
    decisionVieja: o.vieja,
    decisionResolver: o.sombra.decision,
    refs: { ...o.refs, vivo: o.sombra.vivo },
    dedupeKey: o.dedupeKey,
  });
}

/** La guarda vieja bloqueó: el resolver opina sin escribir (dry-run) y se anota si no ve lo mismo. */
export async function sombraBloqueo(
  input: Omit<ResolverInput, "dryRun">,
  par: string | null,
  o: { guarda: string; objeto?: "solicitud" | "presupuesto"; refs?: Record<string, unknown>; dedupeKey?: string | null }
): Promise<void> {
  const sombra = await casoEnSombra({ ...input, dryRun: true }, par);
  await compararGuarda({ vieja: "bloquea", guarda: o.guarda, objeto: o.objeto || "solicitud", sombra, refs: o.refs, dedupeKey: o.dedupeKey });
}

/**
 * Tras el commit del llamador: el presupuesto nuevo pasa a ser la versión vigente
 * del caso SOLO si la clave está libre. Ocupada = no la toma y se anota
 * «segundo presupuesto vivo» (F2 no sustituye nada).
 */
export async function tomarVigente(quoteId: string, casoId: string | null | undefined, entrada: Entrada | string): Promise<void> {
  if (!casoId) return;
  try {
    const ocupada = await prisma.quote.findUnique({ where: { liveCasoKey: casoId }, select: { ...QUOTE_SELECT, quoteNumber: true } });
    if (ocupada && ocupada.id !== quoteId) {
      const nueva = await prisma.quote.findUnique({ where: { id: quoteId }, select: { quoteNumber: true } });
      await registrarDiscrepancia({
        entrada,
        casoId,
        guarda: "liveCasoKey",
        motivo: "segundo_presupuesto_vivo",
        decisionVieja: "crea",
        refs: { nuevo: nueva?.quoteNumber ?? quoteId, vigente: ocupada.quoteNumber, vigenteViva: quoteVivo(ocupada), vigenteStatus: ocupada.status },
        dedupeKey: quoteId,
      });
      return;
    }
    await prisma.quote.updateMany({ where: { id: quoteId, casoId, deletedAt: null, liveCasoKey: null }, data: { liveCasoKey: casoId } });
  } catch (err: any) {
    if (err?.code === "P2002") {
      await registrarDiscrepancia({ entrada, casoId, guarda: "liveCasoKey", motivo: "segundo_presupuesto_vivo", decisionVieja: "crea", refs: { nuevo: quoteId, carrera: true }, dedupeKey: quoteId });
      return;
    }
    console.error("[caso] no se pudo fijar la vigente:", err);
  }
}

/** Estampa el caso en los documentos de una sesión que aún no lo tienen. */
export async function estamparSesion(sessionToken: string, casoId: string | null | undefined): Promise<void> {
  if (!casoId || !sessionToken) return;
  await prisma.documentAnalysis
    .updateMany({ where: { sessionToken, casoId: null }, data: { casoId } })
    .catch((err) => console.error("[caso] estampar sesión falló:", err));
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
        priceRequests: { select: { par: true, status: true, createdAt: true } },
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
      select: { casoId: true, reference: true, quote: { select: { casoId: true } } },
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
      if (!casoId) return;
      await prisma.order.updateMany({ where: { id: orderId, casoId: null }, data: { casoId } });
    }
    await recalcularCaso(casoId, actor, `pedido ${order.reference}`);
  } catch (err) {
    console.error("[caso] adjuntar pedido falló:", orderId, err);
  }
}
