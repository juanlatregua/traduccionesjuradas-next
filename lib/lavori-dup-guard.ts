// lib/lavori-dup-guard.ts — Un cliente nunca tiene dos encargos vivos en lavori con
// los mismos documentos (Juan, 24-sep-2026: Gabriel 26_17203A lo tradujeron Cristina
// y Nielson; la reapertura automática abría otro encargo sin retirar el primero).
// Lo consultan los TRES caminos que mandan a lavori antes de enviar nada.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { orderRefFromMotorRef } from "@/lib/lavori-bridge";
import { leadDocKeyVariants } from "@/lib/lavori-doc-keys";

// ESCALATED cuenta como viva: su encargo nunca se retiró en lavori. DISCARDED y
// RETIRED no: pasan por /api/motor/retirada antes de cerrarse (lib/lavori-retire.ts).
const LIVE = ["SENT", "PRICED", "ACCEPTED", "ESCALATED", "RETIRING"];
// Ventana: un encargo de hace más de 60 días ya no está «abierto a la vez»; la
// lista de «Encargos vivos» de Presupuestos usa la misma, así todo lo que frena se ve.
export const LIVE_WINDOW_DAYS = 60;
export const LIVE_STATUSES = LIVE;

export function lavoriContentKey(docKeys: string, par: string): string {
  return createHash("sha256").update(`${docKeys}|${par}`).digest("hex").slice(0, 24);
}

type ContentKeys = string | string[] | null | undefined;
const asList = (k: ContentKeys): string[] => (Array.isArray(k) ? k : k ? [k] : []);

/** Huella canónica primero, después las antiguas del documento entero (transición 9-oct-2026). */
export function lavoriContentKeys(docs: Parameters<typeof leadDocKeyVariants>[0], par: string): string[] {
  return leadDocKeyVariants(docs).map((k) => lavoriContentKey(k, par));
}

/** "it->es" | "it>es" → "IT>ES" (formato de LavoriPriceRequest.par). */
export function parFromLangs(sourceLang: string | null | undefined, targetLang: string | null | undefined): string | null {
  const s = String(sourceLang || "").trim().toUpperCase();
  const t = String(targetLang || "").trim().toUpperCase();
  return s && t ? `${s}>${t}` : null;
}

export function parFromLangPair(langPair: string | null | undefined): string | null {
  const [s, t] = String(langPair || "").split(/->|>/);
  return parFromLangs(s, t);
}

/** Huella de los documentos de un presupuesto con el mismo cálculo que la solicitud
 * (lib/lavori-lead.ts): permite reconocer la solicitud que Juan pidió desde el
 * constructor aunque no quedara atada (26_C3617B, 2-oct-2026). */
export async function contentKeyForQuote(quoteId: string, par: string): Promise<string[] | null> {
  const lines = await prisma.quoteLine.findMany({
    where: { quoteId, sourceFileUrl: { not: null } },
    select: { sourceFileUrl: true, pageStart: true, pageEnd: true },
  });
  if (lines.length === 0) return null;
  const urls = Array.from(new Set(lines.map((l) => l.sourceFileUrl!)));
  const filas = await prisma.documentAnalysis
    .findMany({ where: { fileUrl: { in: urls } }, select: { fileUrl: true, fileHash: true, pageCount: true } })
    .catch(() => []);
  const porUrl = new Map(filas.filter((r) => r.fileHash).map((r) => [r.fileUrl, r.fileHash]));
  const paginas = new Map(filas.filter((r) => r.pageCount).map((r) => [r.fileUrl, r.pageCount]));
  const docs = lines.map((l) => ({
    url: l.sourceFileUrl!,
    pageStart: l.pageStart ?? undefined,
    pageEnd: l.pageEnd ?? undefined,
    hash: porUrl.get(l.sourceFileUrl!) ?? null,
    pageCount: paginas.get(l.sourceFileUrl!) ?? null,
  }));
  return lavoriContentKeys(docs, par);
}

/** Solicitudes candidatas por huella: misma huella, sin atar, recientes (14 días) y
 * NO consumidas por otro pedido — el mismo cliente puede volver a pedir el mismo
 * certificado y la cifra vieja no puede reciclarse (marca de consumo = el evento
 * del otro pedido que la nombra, como en el emparejamiento por cliente). */
export async function freshLeadsByContentKey(contentKey: string | string[], statuses: string[], exceptOrderId?: string | null) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const candidatas = await prisma.lavoriPriceRequest.findMany({
    where: { contentKey: { in: asList(contentKey) }, quoteId: null, status: { in: statuses }, createdAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  const libres = [];
  for (const c of candidatas) {
    const consumida = await prisma.orderEvent.findFirst({
      where: { ...(exceptOrderId ? { orderId: { not: exceptOrderId } } : {}), payload: { path: ["lavoriPriceRequestId"], equals: c.id } },
      select: { id: true },
    });
    if (!consumida) libres.push(c);
  }
  return libres;
}

/** Pedido de una solicitud: por su presupuesto o, si se emparejó sin presupuesto
 * (funnel por cliente), por el evento del pedido que la nombra. */
export async function orderIdForLead(lead: { id: string; quoteId: string | null }): Promise<string | null> {
  if (lead.quoteId) {
    const o = await prisma.order.findFirst({ where: { quoteId: lead.quoteId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (o) return o.id;
  }
  const ev = await prisma.orderEvent.findFirst({
    where: { payload: { path: ["lavoriPriceRequestId"], equals: lead.id } },
    orderBy: { createdAt: "desc" },
    select: { orderId: true },
  });
  return ev?.orderId ?? null;
}

/** «Lo llevo yo» (contrato 3-oct): marca en la solicitud o, para un encargo abierto
 * desde el pedido (sin solicitud), el último evento lavori.lo_llevo_yo del pedido. */
export async function isHeldByJuan(motorRef: string, orderId?: string | null): Promise<boolean> {
  const ref = orderRefFromMotorRef(motorRef);
  const lead = await prisma.lavoriPriceRequest.findUnique({ where: { ref }, select: { heldByJuanAt: true } });
  if (lead) return Boolean(lead.heldByJuanAt);
  if (!orderId) return false;
  const ev = await prisma.orderEvent.findFirst({
    where: { orderId, type: "lavori.lo_llevo_yo" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  return (ev?.payload as { reservado?: unknown } | null)?.reservado === true;
}

export type LiveLavoriDuplicate = {
  ref: string;
  status: string;
  encargoId: string | null;
  miembroNombre: string | null;
  createdAt: Date;
};

export async function findLiveLavoriDuplicate(opts: {
  par?: string | null;
  contentKey?: ContentKeys;
  expedienteRef?: string | null;
  quoteId?: string | null;
  excludeRef?: string | null;
}): Promise<LiveLavoriDuplicate | null> {
  const or: any[] = [];
  const par = opts.par ? { par: opts.par } : {};
  // Mismos documentos (huella). La sesión solo cuenta en solicitudes antiguas sin
  // huella: documentos distintos del mismo expediente sí pueden pedirse aparte.
  if (asList(opts.contentKey).length) or.push({ contentKey: { in: asList(opts.contentKey) } });
  if (opts.expedienteRef) or.push({ expedienteRef: opts.expedienteRef, contentKey: null, ...par });
  if (opts.quoteId) or.push({ quoteId: opts.quoteId, ...par });
  if (or.length === 0) return null;
  return prisma.lavoriPriceRequest.findFirst({
    where: {
      OR: or,
      status: { in: LIVE },
      encargoId: { not: null },
      createdAt: { gte: new Date(Date.now() - LIVE_WINDOW_DAYS * 24 * 3_600_000) },
      ...(opts.excludeRef ? { ref: { not: opts.excludeRef } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { ref: true, status: true, encargoId: true, miembroNombre: true, createdAt: true },
  });
}

const ESTADO: Record<string, string> = {
  SENT: "pendiente de precio",
  PRICED: "con precio",
  ACCEPTED: "aceptada",
  ESCALATED: "reabierta y sin retirar",
  RETIRING: "retirándose ahora mismo",
};

export function liveDuplicateMessage(d: LiveLavoriDuplicate): string {
  return `Ya hay un encargo vivo en lavori para estos documentos: ${d.ref} (${ESTADO[d.status] || d.status}${
    d.miembroNombre ? `, ${d.miembroNombre}` : ""
  }). No se ha mandado otro. Si quieres pedírselo a otro jurado, retírala antes: Presupuestos → «Retirar en lavori».`;
}
