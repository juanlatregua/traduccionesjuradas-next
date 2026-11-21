// lib/mesa/datos.ts — lectura de la mesa del gestor (R3). Solo lectura: Prisma directo,
// sin escribir nada. Los montones se deciden en lib/mesa/montones.ts.

import { prisma } from "@/lib/prisma";
import { loadLeadSla } from "@/lib/lead-sla";
import { getTranslatorDeliveredAt } from "@/lib/zona-traductor-data";
import { QUOTE_PASO_SELECT, LPR_PASO_SELECT, PEDIDO_PASO_SELECT, nombreMiembro, baseUrlStaff, casosVivosWhere } from "@/lib/caso/vista";
import { clasificarCaso, montarMesa, type CasoMesa, type Mesa, type PedidoMesa } from "@/lib/mesa/montones";
import type { SlaLead } from "@/lib/lead-sla-core";

const PEDIDO_MESA_SELECT = {
  ...PEDIDO_PASO_SELECT,
  langPair: true,
  dueDate: true,
  assignedTo: true,
  translatorDeliveredAt: true,
  events: { where: { type: "lavori.entrega_subida" }, select: { type: true, createdAt: true }, take: 1 },
  collaboratorAssignments: { select: { isWinning: true, status: true, deliveredAt: true, quotedDeadline: true, adminNotes: true, collaborator: { select: { fullName: true } } } },
} as const;

type PedidoRow = {
  reference: string;
  status: string;
  paymentStatus: string;
  deliveryState: string;
  langPair: string | null;
  dueDate: Date | null;
  assignedTo: string | null;
  translatorDeliveredAt: Date | null;
  events: { type: string; createdAt: Date }[];
  collaboratorAssignments: { isWinning: boolean; status: string; deliveredAt: Date | null; quotedDeadline: Date | null; collaborator: { fullName: string } }[];
};

export function ganadora<T extends { isWinning: boolean; status: string }>(asignaciones: T[]): T | undefined {
  return asignaciones.find((a) => a.isWinning || a.status === "ACCEPTED" || a.status === "DELIVERED");
}

export function pedidoMesa(o: PedidoRow): PedidoMesa {
  const g = ganadora(o.collaboratorAssignments);
  const entrega = getTranslatorDeliveredAt(o);
  return {
    reference: o.reference,
    status: o.status,
    paymentStatus: o.paymentStatus,
    deliveryState: o.deliveryState,
    langPair: o.langPair,
    dueDate: o.dueDate,
    traductor: g?.collaborator.fullName || o.assignedTo || null,
    plazoJurado: g?.quotedDeadline ?? null,
    entregaJuradoAt: entrega ? new Date(entrega) : null,
  };
}

const CASO_MESA_SELECT = {
  id: true,
  ref: true,
  estado: true,
  nombre: true,
  email: true,
  phone9: true,
  pares: true,
  origen: true,
  dudoso: true,
  urgency: true,
  neededBy: true,
  createdAt: true,
  lastActivityAt: true,
  quotes: { select: QUOTE_PASO_SELECT },
  priceRequests: { select: { ...LPR_PASO_SELECT, updatedAt: true } },
  orders: { select: PEDIDO_MESA_SELECT },
  analyses: { where: { sessionToken: { not: null }, NOT: { sessionToken: { startsWith: "exp:" } } }, orderBy: { createdAt: "desc" as const }, take: 1, select: { sessionToken: true } },
} as const;

type CasoRow = Omit<CasoMesa, "lprs" | "pedidos" | "sesion"> & {
  priceRequests: CasoMesa["lprs"];
  orders: PedidoRow[];
  analyses: { sessionToken: string | null }[];
};

const casoMesa = (c: CasoRow): CasoMesa => {
  const { priceRequests, orders, analyses, ...resto } = c;
  return { ...resto, lprs: priceRequests, pedidos: orders.map(pedidoMesa), sesion: analyses[0]?.sessionToken ?? null };
};

export async function cargarMesa(ahora = new Date()): Promise<Mesa & { avisos: string[] }> {
  const avisos: string[] = [];
  const [casos, leads] = await Promise.all([
    prisma.caso.findMany({ where: casosVivosWhere(ahora), orderBy: { lastActivityAt: "desc" }, take: 300, select: CASO_MESA_SELECT }),
    loadLeadSla(ahora).catch((e): SlaLead[] => {
      console.error("[mesa] leads sueltos", e);
      avisos.push("No se han podido leer los leads de las últimas 24 h que aún no tienen caso: mira la Bandeja.");
      return [];
    }),
  ]);
  return { ...montarMesa({ casos: casos.map(casoMesa), leads, ahora, baseUrl: baseUrlStaff(), nombreDe: nombreMiembro }), avisos };
}

/** Todo lo que la ficha del caso enseña, en una sola consulta. */
export async function cargarFicha(id: string) {
  const caso = await prisma.caso.findFirst({
    where: { OR: [{ id }, { ref: id.toUpperCase() }] },
    select: {
      ...CASO_MESA_SELECT,
      esAgencia: true,
      customer: { select: { name: true, notes: true, isBusiness: true, fiscalName: true, companyName: true } },
      quotes: {
        orderBy: { createdAt: "asc" },
        select: {
          ...QUOTE_PASO_SELECT,
          sourceLang: true,
          targetLang: true,
          subtotal: true,
          discountAmount: true,
          shippingAmount: true,
          vatAmount: true,
          total: true,
          deliveryType: true,
          deliveryTerm: true,
          autoPricedBy: true,
          translatorName: true,
          lavoriMiembroNombre: true,
          lines: { orderBy: { createdAt: "asc" }, select: { id: true, description: true, quantity: true, lineTotal: true, supplierUnitCost: true, pageStart: true, pageEnd: true } },
        },
      },
      priceRequests: { orderBy: { createdAt: "asc" }, select: { ...LPR_PASO_SELECT, id: true, updatedAt: true, plazoDias: true, docsCount: true, words: true, notas: true } },
      orders: {
        orderBy: { createdAt: "asc" },
        select: {
          ...PEDIDO_MESA_SELECT,
          id: true,
          title: true,
          createdAt: true,
          paidAt: true,
          amountCents: true,
          paymentMethod: true,
          paymentProofFileKey: true,
          deliveryType: true,
          trackingNumber: true,
          shippedAt: true,
          clientNotes: true,
          updatedAt: true,
        },
      },
      inbound: { orderBy: { receivedAt: "asc" }, take: 50, select: { id: true, channel: true, receivedAt: true, subject: true, fromEmail: true, bodyPreview: true } },
      analyses: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, sessionToken: true, source: true, fileName: true, pageCount: true, documentType: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, createdAt: true },
      },
      eventos: {
        where: { tipo: { notIn: ["comparacion", "veredicto", "reserva_solicitud"] } },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { tipo: true, actor: true, createdAt: true, payload: true },
      },
    },
  });
  if (!caso) return null;
  const entradas = await prisma.entrada.findMany({
    where: { casoId: caso.id, estado: { not: "prueba" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, canal: true, estado: true, organismo: true, pais: true, notas: true, lang: true, createdAt: true },
  });
  const { analyses, ...resto } = caso;
  const sesion = [...analyses].reverse().find((a) => a.sessionToken && !a.sessionToken.startsWith("exp:"))?.sessionToken ?? null;
  const mesa: CasoMesa = { ...resto, lprs: caso.priceRequests, pedidos: caso.orders.map(pedidoMesa), sesion };
  const ahora = new Date();
  return { caso, entradas, mesa, tarjeta: clasificarCaso(mesa, ahora, baseUrlStaff(), nombreMiembro), ahora };
}
