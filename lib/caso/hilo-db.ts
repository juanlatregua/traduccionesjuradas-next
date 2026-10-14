// lib/caso/hilo-db.ts — Lecturas del hilo único (F3b): a qué caso va una petición
// de precio y qué solicitud/presupuesto vivo tiene ya. Decisiones en lib/caso/hilo.ts.

import { prisma } from "@/lib/prisma";
import { resolverCaso, type Anclas, type ResolverInput } from "@/lib/caso/resolver-db";
import { LPR_VIVAS } from "@/lib/caso/estados";
import { presupuestoDelHilo } from "@/lib/caso/hilo";

export const LPR_HILO_SELECT = {
  id: true,
  ref: true,
  par: true,
  status: true,
  priceCents: true,
  plazoDias: true,
  miembroNombre: true,
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

/** Solicitudes vivas del caso y las ancladas a la misma gestión (ref, expediente, presupuesto). */
export async function solicitudesVivasDelHilo(casoId: string | null, anclas: Anclas = {}) {
  const or = [
    ...(casoId ? [{ casoId }] : []),
    ...(anclas.lprRef ? [{ ref: anclas.lprRef }] : []),
    ...(anclas.expedienteRef ? [{ expedienteRef: anclas.expedienteRef }] : []),
    ...(anclas.quoteId ? [{ quoteId: anclas.quoteId }] : []),
  ];
  if (or.length === 0) return [];
  return prisma.lavoriPriceRequest.findMany({ where: { status: { in: [...LPR_VIVAS] }, OR: or }, select: LPR_HILO_SELECT, orderBy: { createdAt: "desc" } });
}

/**
 * Caso al que iría esta petición, SIN escribir (dry-run del resolver). resuelto=false
 * si el resolver falló: quien llama no sabe de qué caso es y aplica la guarda vieja.
 */
export async function casoDeLaPeticion(input: Omit<ResolverInput, "dryRun">): Promise<{ resuelto: boolean; casoId: string | null }> {
  try {
    const r = await resolverCaso({ ...input, dryRun: true });
    return { resuelto: true, casoId: r.decision.accion === "adjuntar" ? r.decision.casoId ?? null : null };
  } catch (err) {
    console.error("[caso] hilo: resolver (dry-run) falló:", err);
    return { resuelto: false, casoId: null };
  }
}

/** El presupuesto vivo o aún pagable del caso, con lo que hace falta para saber si es un borrador sustituible. */
export async function presupuestoVivoDelCaso(casoId: string | null | undefined) {
  if (!casoId) return null;
  const quotes = await prisma.quote.findMany({ where: { casoId, deletedAt: null }, select: QUOTE_HILO_SELECT });
  return presupuestoDelHilo(quotes, casoId);
}

export async function rastroHilo(casoId: string | null, tipo: string, actor: string, dedupeKey: string, payload: Record<string, unknown>) {
  if (!casoId) return;
  await prisma.casoEvento
    .create({ data: { casoId, tipo, actor, dedupeKey: dedupeKey.slice(0, 190), payload: payload as any } })
    .catch((err) => console.error("[caso] rastro del hilo falló:", tipo, err));
}
