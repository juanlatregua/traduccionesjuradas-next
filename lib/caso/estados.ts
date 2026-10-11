// lib/caso/estados.ts — Estados del caso y transiciones permitidas (lógica PURA).
// El estado sale de que EXISTA pedido y de su flujo, no del cobro: un cliente de
// crédito tiene pedido sin pagar (lib/quote-credit.ts) y su caso ya está EN_CURSO.

export const CASO_ESTADOS = ["ABIERTO", "EN_CURSO", "ENTREGADO", "PERDIDO", "CANCELADO"] as const;
export type CasoEstado = (typeof CASO_ESTADOS)[number];

export const CASO_EVENTOS = ["creado", "adjuntado", "posible", "transicion", "discrepancia", "fallo_resolver", "backfill"] as const;
export type CasoEventoTipo = (typeof CASO_EVENTOS)[number];

// = LIVE de lib/lavori-dup-guard.ts
export const LPR_VIVAS = ["SENT", "PRICED", "ACCEPTED", "ESCALATED", "RETIRING"] as const;
export const QUOTE_VIVOS = ["DRAFT", "SENT", "OPENED", "ACCEPTED"] as const;
export const QUOTE_FORMALIZADOS = ["PAID", "IN_PROGRESS", "DELIVERED"] as const;
/** Una solicitud viva más antigua que esto ya no mantiene abierto el caso. */
export const LPR_VIVA_DIAS = 30;

const TRANSICIONES: Record<CasoEstado, CasoEstado[]> = {
  ABIERTO: ["EN_CURSO", "ENTREGADO", "CANCELADO", "PERDIDO"],
  // Llega el pedido de un caso dado por perdido: el pedido manda.
  PERDIDO: ["ABIERTO", "EN_CURSO", "ENTREGADO", "CANCELADO"],
  EN_CURSO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

export function esCasoEstado(x: unknown): x is CasoEstado {
  return typeof x === "string" && (CASO_ESTADOS as readonly string[]).includes(x);
}

export function puedeCaso(from: CasoEstado, to: CasoEstado): boolean {
  return from === to || TRANSICIONES[from].includes(to);
}

export function casoTerminal(e: CasoEstado): boolean {
  return TRANSICIONES[e].length === 0;
}

/** Solo un caso ABIERTO admite que se le una algo por identidad. */
export function casoAbierto(e: string): boolean {
  return e === "ABIERTO";
}

export type PedidoParaEstado = {
  status: string;
  paymentStatus?: string | null;
  deliveryState?: string | null;
  workflowState?: string | null; // lib/workflow getWorkflowState
};

function pedidoCancelado(p: PedidoParaEstado) {
  return p.status === "CANCELLED" || p.paymentStatus === "REFUNDED";
}
function pedidoEntregado(p: PedidoParaEstado) {
  return (
    p.status === "DELIVERED" ||
    p.deliveryState === "TRADUCIDO" ||
    p.workflowState === "TRADUCIDO_ENTREGADO" ||
    p.workflowState === "CERRADO"
  );
}

/** null = el caso no tiene pedido. */
export function estadoPorPedidos(pedidos: PedidoParaEstado[]): CasoEstado | null {
  if (pedidos.length === 0) return null;
  const activos = pedidos.filter((p) => !pedidoCancelado(p));
  if (activos.length === 0) return "CANCELADO";
  return activos.every(pedidoEntregado) ? "ENTREGADO" : "EN_CURSO";
}

/** vivo = presupuesto vigente sin formalizar o solicitud de precio viva reciente. */
export function estadoDeCaso(i: { pedidos: PedidoParaEstado[]; vivo: boolean }): CasoEstado {
  return estadoPorPedidos(i.pedidos) ?? (i.vivo ? "ABIERTO" : "PERDIDO");
}

/** Con motivo de pérdida (cierre suave, «No aceptado») ya no está vivo aunque siga SENT. */
export function quoteVivo(q: { status: string; deletedAt?: Date | null; lostReason?: string | null }): boolean {
  return !q.deletedAt && !q.lostReason && (QUOTE_VIVOS as readonly string[]).includes(q.status);
}

export function lprViva(l: { status: string; createdAt: Date }, ahora: Date, dias = LPR_VIVA_DIAS): boolean {
  return (LPR_VIVAS as readonly string[]).includes(l.status) && ahora.getTime() - l.createdAt.getTime() <= dias * 864e5;
}

/**
 * Presupuesto cuyo status nadie toca al sustituirlo (solo se le quita la clave):
 * formalizado, cobrado o con segundo plazo pendiente.
 */
export function quoteIntocable(q: {
  status: string;
  paidAt?: Date | null;
  balanceAmount?: unknown;
  balancePaidAt?: Date | null;
}): boolean {
  if ((QUOTE_FORMALIZADOS as readonly string[]).includes(q.status) || q.paidAt) return true;
  const saldo = q.balanceAmount == null ? 0 : Number(q.balanceAmount);
  return saldo > 0 && !q.balancePaidAt;
}
