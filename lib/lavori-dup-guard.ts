// lib/lavori-dup-guard.ts — Un cliente nunca tiene dos encargos vivos en lavori con
// los mismos documentos (Juan, 24-sep-2026: Gabriel 26_17203A lo tradujeron Cristina
// y Nielson; la reapertura automática abría otro encargo sin retirar el primero).
// Lo consultan los TRES caminos que mandan a lavori antes de enviar nada.

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

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

export type LiveLavoriDuplicate = {
  ref: string;
  status: string;
  encargoId: string | null;
  miembroNombre: string | null;
  createdAt: Date;
};

export async function findLiveLavoriDuplicate(opts: {
  par?: string | null;
  contentKey?: string | null;
  expedienteRef?: string | null;
  quoteId?: string | null;
  excludeRef?: string | null;
}): Promise<LiveLavoriDuplicate | null> {
  const or: any[] = [];
  const par = opts.par ? { par: opts.par } : {};
  // Mismos documentos (huella). La sesión solo cuenta en solicitudes antiguas sin
  // huella: documentos distintos del mismo expediente sí pueden pedirse aparte.
  if (opts.contentKey) or.push({ contentKey: opts.contentKey });
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
