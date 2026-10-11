// lib/caso/vista.ts — selects compartidos de la bandeja y la ficha del caso (solo servidor).

import { LAVORI_DIRECT } from "@/lib/lavori-directo";
import type { QuotePaso, LprPaso } from "@/lib/caso/siguiente-paso";

export const QUOTE_PASO_SELECT = {
  id: true,
  quoteNumber: true,
  status: true,
  deletedAt: true,
  lostReason: true,
  lostReasonNote: true,
  liveCasoKey: true,
  supersededAt: true,
  expiredAt: true,
  paymentFrozenAt: true,
  paidAt: true,
  sentAt: true,
  openedAt: true,
  publicToken: true,
  createdAt: true,
} as const;

export const LPR_PASO_SELECT = {
  ref: true,
  par: true,
  status: true,
  priceCents: true,
  miembroNombre: true,
  candidatos: true,
  quoteId: true,
  expedienteRef: true,
  createdAt: true,
} as const;

export const PEDIDO_PASO_SELECT = { reference: true, status: true, paymentStatus: true, deliveryState: true } as const;

const NOMBRES = new Map(Object.values(LAVORI_DIRECT).flatMap((l) => l.miembros.map((m) => [m.miembroId, m.nombre] as const)));
/** Nombre de un candidato de lavori sin llamar a lavori (solo los directos se conocen aquí). */
export const nombreMiembro = (id: string) => NOMBRES.get(id) ?? null;

export const baseUrlStaff = () => (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");

export const ESTADO_PILL: Record<string, string> = {
  ABIERTO: "bg-cyan-500/15 text-cyan-300",
  EN_CURSO: "bg-violet-500/15 text-violet-300",
  ENTREGADO: "bg-teal-500/15 text-teal-300",
  PERDIDO: "bg-slate-600/30 text-slate-400",
  CANCELADO: "bg-rose-500/15 text-rose-300",
};
export const ESTADO_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_CURSO: "En curso",
  ENTREGADO: "Entregado",
  PERDIDO: "Perdido",
  CANCELADO: "Cancelado",
};

export type { QuotePaso, LprPaso };
