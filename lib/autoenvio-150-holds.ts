// Retenciones que AUTOENVIO_150 respeta siempre (FunnelEvent, sessionId «autoenvio-150:{quoteId}»):
//  · «autoenvio_150_carril»: el carril que creó el borrador no lo dejó salir (avisos del cierre,
//    freno del tarifario, del encargo cerrado o del agente de bandeja). Se escribe al crear.
//  · «autoenvio_150_retenido»: Juan pulsó «Retener» (enlace firmado de un toque).
// Nunca lanza: sin rastro, el autoenvío no se entera, pero el envío del carril sigue igual.
import { prisma } from "@/lib/prisma";
import { generateCierreToken } from "@/lib/cierre-token";

export const CARRIL_STEP = "autoenvio_150_carril";
export const RETENIDO_STEP = "autoenvio_150_retenido";
export const HOLD_STEP = "autoenvio_150_hold";
export const RETENER_PURPOSE = "autoenvio-retener";
const SITE = "https://www.traduccionesjuradas.net";

const sid = (quoteId: string) => `autoenvio-150:${quoteId}`;

async function put(step: string, quoteId: string, metadata: Record<string, unknown>) {
  await prisma.funnelEvent
    .upsert({ where: { sessionId_step: { sessionId: sid(quoteId), step } }, create: { sessionId: sid(quoteId), reference: "autoenvio-150", step, metadata: metadata as any }, update: { metadata: metadata as any } })
    .catch((e) => console.error("[autoenvio-150] retención no guardada", step, quoteId, e));
}

export async function recordCarrilHold(quoteId: string, quoteNumber: string, reasons: string[], carril: string): Promise<void> {
  if (!reasons.length) return;
  await put(CARRIL_STEP, quoteId, { quoteId, quoteNumber, reasons: reasons.map((r) => `${carril}: ${r}`).slice(0, 10) });
}

export async function recordRetenido(quoteId: string, quoteNumber: string): Promise<void> {
  await put(RETENIDO_STEP, quoteId, { quoteId, quoteNumber, reasons: ["retenido por Juan («Retener»)"] });
}

/** Enlace de un toque «Retener» (GET confirma, POST escribe); null sin secreto. Dominio fijo: nunca localhost. */
export function retenerUrl(quoteId: string): string | null {
  try {
    return `${SITE}/api/autoenvio-150/retener?q=${encodeURIComponent(quoteId)}&t=${generateCierreToken(quoteId, 2 * 24 * 3600, RETENER_PURPOSE)}`;
  } catch {
    return null;
  }
}

export type QuoteHolds = { carril: string[]; retenido: boolean; hold: string[] };

export async function loadHolds(quoteIds: string[]): Promise<Map<string, QuoteHolds>> {
  const out = new Map<string, QuoteHolds>();
  if (!quoteIds.length) return out;
  const rows = await prisma.funnelEvent.findMany({ where: { sessionId: { in: quoteIds.map(sid) }, step: { in: [CARRIL_STEP, RETENIDO_STEP, HOLD_STEP] } }, select: { sessionId: true, step: true, metadata: true } });
  for (const r of rows) {
    const id = r.sessionId.slice("autoenvio-150:".length);
    const h = out.get(id) ?? { carril: [], retenido: false, hold: [] };
    const reasons = (((r.metadata as any)?.reasons as string[]) || []).filter((x) => typeof x === "string");
    if (r.step === CARRIL_STEP) h.carril.push(...reasons);
    else if (r.step === RETENIDO_STEP) h.retenido = true;
    else h.hold.push(...reasons);
    out.set(id, h);
  }
  return out;
}

// «Esperando al jurado» (FunnelEvent «espera_jurado», mismo sessionId): el precio está pedido a un
// jurado (también fuera del puente, desde lavori). Calla el aviso de lead sin presupuesto y saca el
// borrador de «sin presupuesto» del informe; se ve aparte, sin urgencia. Se pone con un toque.
export const ESPERA_STEP = "espera_jurado";
export const ESPERA_PURPOSE = "espera-jurado";

export async function recordEsperaJurado(quoteId: string, quoteNumber: string): Promise<void> {
  await put(ESPERA_STEP, quoteId, { quoteId, quoteNumber, since: new Date().toISOString() });
}

export function esperaUrl(quoteId: string): string | null {
  try {
    return `${SITE}/api/espera-jurado?q=${encodeURIComponent(quoteId)}&t=${generateCierreToken(quoteId, 3 * 24 * 3600, ESPERA_PURPOSE)}`;
  } catch {
    return null;
  }
}

/** Borradores marcados «esperando al jurado» → desde cuándo. */
export async function loadEsperas(quoteIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (!quoteIds.length) return out;
  const rows = await prisma.funnelEvent
    .findMany({ where: { sessionId: { in: quoteIds.map(sid) }, step: ESPERA_STEP }, select: { sessionId: true, createdAt: true } })
    .catch(() => []);
  for (const r of rows) out.set(r.sessionId.slice("autoenvio-150:".length), r.createdAt);
  return out;
}
