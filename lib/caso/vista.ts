// lib/caso/vista.ts — selects compartidos de la bandeja y la ficha del caso (solo servidor).

import type { Prisma } from "@prisma/client";
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
  SIN_JURADO: "bg-amber-500/15 text-amber-300",
  CANCELADO: "bg-rose-500/15 text-rose-300",
};
export const ESTADO_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_CURSO: "En curso",
  ENTREGADO: "Entregado",
  PERDIDO: "Perdido",
  SIN_JURADO: "Sin jurado",
  CANCELADO: "Cancelado",
};

const PAGABLE_DIAS = 14;

/** Casos vivos de la bandeja de Casos y de la mesa «Hoy»: abiertos, en curso o perdidos con un presupuesto aún pagable. */
export const casosVivosWhere = (ahora: Date): Prisma.CasoWhereInput => ({
  OR: [
    { estado: { in: ["ABIERTO", "EN_CURSO"] } },
    // Perdido por silencio pero con presupuesto aún pagable: se espera al cliente.
    {
      estado: "PERDIDO",
      quotes: { some: { deletedAt: null, supersededAt: null, expiredAt: null, status: { in: ["DRAFT", "SENT", "OPENED", "ACCEPTED"] }, sentAt: { gte: new Date(ahora.getTime() - PAGABLE_DIAS * 864e5) } } },
    },
  ],
});

export type { QuotePaso, LprPaso };
