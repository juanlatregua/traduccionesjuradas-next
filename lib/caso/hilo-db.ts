// lib/caso/hilo-db.ts — Lecturas del hilo único (F3b): a qué caso va una petición
// de precio y qué solicitud/presupuesto vivo tiene ya. Decisiones en lib/caso/hilo.ts.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverCaso, type Anclas, type ResolverInput } from "@/lib/caso/resolver-db";
import { LPR_VIVAS, LPR_VIVA_DIAS } from "@/lib/caso/estados";
import { presupuestoDelHilo, reservaViva, RESERVA_MIN } from "@/lib/caso/hilo";

export const LPR_HILO_SELECT = {
  id: true,
  ref: true,
  par: true,
  status: true,
  priceCents: true,
  plazoDias: true,
  miembroNombre: true,
  miembroId: true,
  docsCount: true,
  candidatos: true,
  encargoId: true,
  quoteId: true,
  casoId: true,
  expedienteRef: true,
  createdAt: true,
} as const;

const QUOTE_HILO_SELECT = {
  id: true,
  quoteNumber: true,
  status: true,
  deletedAt: true,
  lostReason: true,
  lostReasonNote: true,
  liveCasoKey: true,
  supersededAt: true,
  expiredAt: true,
  createdAt: true,
  customerEmail: true,
  sourceLang: true,
  targetLang: true,
  expedienteRef: true,
  _count: { select: { messageLogs: true, orders: true } },
} as const;

/** Solicitudes vivas (misma edad que lprViva) del caso y las ancladas a la misma gestión (ref, expediente, presupuesto), con el estado de su presupuesto. */
export async function solicitudesVivasDelHilo(casoId: string | null, anclas: Anclas = {}) {
  const or = [
    ...(casoId ? [{ casoId }] : []),
    ...(anclas.lprRef ? [{ ref: anclas.lprRef }] : []),
    ...(anclas.expedienteRef ? [{ expedienteRef: anclas.expedienteRef }] : []),
    ...(anclas.quoteId ? [{ quoteId: anclas.quoteId }] : []),
  ];
  if (or.length === 0) return [];
  const desde = new Date(Date.now() - LPR_VIVA_DIAS * 864e5);
  const lprs = await prisma.lavoriPriceRequest.findMany({
    where: { status: { in: [...LPR_VIVAS] }, createdAt: { gte: desde }, OR: or },
    select: LPR_HILO_SELECT,
    orderBy: { createdAt: "desc" },
  });
  const quoteIds = [...new Set(lprs.map((l) => l.quoteId).filter((x): x is string => Boolean(x)))];
  const quotes = quoteIds.length ? await prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, status: true, paidAt: true } }) : [];
  const estado = new Map(quotes.map((q) => [q.id, q.paidAt && q.status !== "DELIVERED" && q.status !== "IN_PROGRESS" ? "PAID" : q.status]));
  return lprs.map((l) => ({ ...l, quoteStatus: l.quoteId ? estado.get(l.quoteId) ?? null : null }));
}

/**
 * Caso al que iría esta petición, SIN escribir (dry-run del resolver). resuelto=false
 * si el resolver falló: quien llama no sabe de qué caso es y aplica la guarda vieja.
 */
export async function casoDeLaPeticion(
  input: Omit<ResolverInput, "dryRun">
): Promise<{ resuelto: boolean; casoId: string | null; accion: string | null; regla: string | null }> {
  try {
    const r = await resolverCaso({ ...input, dryRun: true });
    return { resuelto: true, casoId: r.decision.accion === "adjuntar" ? r.decision.casoId ?? null : null, accion: r.decision.accion, regla: r.decision.regla };
  } catch (err) {
    console.error("[caso] hilo: resolver (dry-run) falló:", err);
    return { resuelto: false, casoId: null, accion: null, regla: null };
  }
}

/**
 * Reserva corta del hilo caso+par (CasoEvento «reserva_solicitud», único por caso+tipo+clave):
 * bajo pg_advisory_xact_lock en una transacción breve se mira si hay una viva y, si no, se
 * crea con caducidad. El envío va FUERA de la transacción; al acabar se libera.
 */
export async function reservarHilo(
  casoId: string,
  par: string,
  actor: string
): Promise<{ ok: true; liberar: () => Promise<void> } | { ok: false; error: string }> {
  const dedupeKey = `reserva:${par.toUpperCase()}`;
  try {
    const id = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hilo'), hashtext(${`${casoId}|${par.toUpperCase()}`}))`;
        const prev = await tx.casoEvento.findFirst({ where: { casoId, tipo: "reserva_solicitud", dedupeKey }, select: { id: true, payload: true } });
        if (prev && reservaViva(prev.payload, new Date())) return null;
        if (prev) await tx.casoEvento.delete({ where: { id: prev.id } });
        const ev = await tx.casoEvento.create({
          data: { casoId, tipo: "reserva_solicitud", dedupeKey, actor, payload: { par, expiresAt: new Date(Date.now() + RESERVA_MIN * 60_000).toISOString() } },
          select: { id: true },
        });
        return ev.id;
      },
      { maxWait: 3_000, timeout: 5_000 }
    );
    if (!id) return { ok: false, error: "Envío en curso para este caso y par: espera unos segundos y vuelve a mirar." };
    return {
      ok: true,
      liberar: () =>
        prisma.casoEvento
          .deleteMany({ where: { id } })
          .then(() => undefined)
          .catch((err) => console.error("[caso] liberar reserva del hilo falló:", err)),
    };
  } catch (err) {
    console.error("[caso] reservar hilo falló:", err);
    return { ok: false, error: "No se pudo reservar el envío (base de datos ocupada): inténtalo de nuevo." };
  }
}

/** El presupuesto vivo o aún pagable del caso y par, con lo que hace falta para saber si es un borrador sustituible. */
export async function presupuestoVivoDelCaso(casoId: string | null | undefined, par: string | null | undefined, db: Prisma.TransactionClient = prisma) {
  if (!casoId || !par) return null;
  const quotes = await db.quote.findMany({ where: { casoId, deletedAt: null }, select: QUOTE_HILO_SELECT });
  return presupuestoDelHilo(quotes, casoId, par);
}

export async function rastroHilo(casoId: string | null, tipo: string, actor: string, dedupeKey: string, payload: Record<string, unknown>) {
  if (!casoId) return;
  await prisma.casoEvento
    .create({ data: { casoId, tipo, actor, dedupeKey: dedupeKey.slice(0, 190), payload: payload as any } })
    .catch((err) => console.error("[caso] rastro del hilo falló:", tipo, err));
}
