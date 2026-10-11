// lib/caso/sombra-plan.ts — F2, lógica PURA del modo sombra: qué señal manda cada
// entrada al resolver, cuándo la guarda vieja y el resolver no coinciden
// (discrepancia) y qué estado le toca al caso. Nada de esto decide negocio: las
// guardas viejas siguen creando/bloqueando; esto solo asigna casoId y anota.

import { estadoDeCaso, quoteVivo, quotePagable, quoteIntocable, lprViva, puedeCaso, esCasoEstado, casoTerminal, type CasoEstado, type PedidoParaEstado } from "./estados.ts";
import { normPar, paresCompatibles, type Decision } from "./resolver.ts";

export type Entrada =
  | "puerta"
  | "puerta_pago"
  | "one_tap"
  | "email"
  | "whatsapp"
  | "expediente"
  | "constructor"
  | "price_request"
  | "directo"
  | "escalado"
  | "tarifario";

/** LeadRequestInput.createdBy → entrada (el chokepoint de lavori-lead no sabe quién llama). */
export function entradaDeCreador(createdBy: string | null | undefined): Entrada {
  const c = String(createdBy || "").trim();
  if (c.startsWith("puerta-directo")) return "directo";
  if (c === "puerta-auto") return "puerta";
  if (c === "one-tap") return "one_tap";
  if (c === "directo-escalado") return "escalado";
  return "price_request";
}

/** expedienteRef de una solicitud/presupuesto → anclas del resolver (puerta:<token> y EXP-XXXXXX = sesión). */
export function anclasDeExpediente(expedienteRef: string | null | undefined): { expedienteRef?: string; sessionToken?: string } {
  const ref = String(expedienteRef || "").trim();
  if (!ref) return {};
  if (ref.startsWith("puerta:")) return { expedienteRef: ref, sessionToken: ref.slice("puerta:".length) || undefined };
  if (/^EXP-[A-Z0-9]{6}$/.test(ref)) return { expedienteRef: ref, sessionToken: `exp:${ref}` };
  return { expedienteRef: ref };
}

/** "es"+"de" | "es->de" → ["ES>DE"]; desconocido → []. */
export function paresDe(source: string | null | undefined, target?: string | null): string[] {
  const p = target === undefined ? normPar(source) : normPar(`${source || ""}>${target || ""}`);
  return p ? [p] : [];
}

export type VivoEnCaso = { lprMismoPar: boolean; vigente: boolean };
export const NADA_VIVO: VivoEnCaso = { lprMismoPar: false, vigente: false };

export type QuoteDelCaso = {
  id: string;
  status: string;
  deletedAt: Date | null;
  lostReason: string | null;
  lostReasonNote?: string | null;
  liveCasoKey: string | null;
  supersededAt: Date | null;
  expiredAt?: Date | null;
  createdAt: Date;
};
export type LprDelCaso = { par: string; status: string; createdAt: Date };

export function vivoEnCaso(i: { casoId: string; par: string | null; quotes: QuoteDelCaso[]; lprs: LprDelCaso[]; ahora: Date }): VivoEnCaso {
  const par = i.par ? [i.par] : [];
  return {
    lprMismoPar: i.lprs.some((l) => lprViva(l, i.ahora) && paresCompatibles(par, [l.par])),
    vigente: i.quotes.some((q) => quoteVivo(q)),
  };
}

/** A efectos de estado, un presupuesto formalizado (PAID/IN_PROGRESS/DELIVERED) o aún pagable (cierre suave, pago iniciado) también sostiene el caso. */
export function quoteCuentaViva(q: Parameters<typeof quotePagable>[0] & { deletedAt: Date | null; lostReason: string | null }): boolean {
  return quoteVivo(q) || quotePagable(q) || (!q.deletedAt && quoteIntocable({ status: q.status }));
}

export type Vieja = "crea" | "bloquea";

/**
 * Discrepancia = la guarda vieja y el resolver no ven lo mismo:
 * - vieja CREA una solicitud/presupuesto y el resolver adjunta a un caso que ya
 *   tiene una solicitud viva del par (o un presupuesto vigente vivo);
 * - vieja BLOQUEA y el resolver no ve nada vivo en el caso al que iría (o crearía uno).
 * null = coinciden, o no hay opinión del resolver (falló).
 */
export function decidirDiscrepancia(
  vieja: Vieja,
  sombra: { decision: Decision; vivo: VivoEnCaso } | null,
  objeto: "solicitud" | "presupuesto",
  simulado = false
): string | null {
  if (!sombra) return null;
  const adjunta = sombra.decision.accion === "adjuntar";
  if (vieja === "crea") {
    if (!adjunta) return null;
    if (objeto === "solicitud" && sombra.vivo.lprMismoPar) return "crea_solicitud_con_viva_en_caso";
    if (objeto === "presupuesto" && sombra.vivo.vigente) return "crea_presupuesto_con_vigente_en_caso";
    return null;
  }
  if (adjunta && (sombra.vivo.lprMismoPar || sombra.vivo.vigente)) return null;
  if (adjunta) return "bloquea_caso_sin_nada_vivo";
  // Simulado = dry-run (no se escribió nada); si no, el resolver SÍ creó el caso (la puerta resuelve de verdad).
  return simulado ? "bloquea_resolver_crearia_caso" : "bloquea_resolver_creo_caso";
}

export type Comparacion = {
  acuerdo: boolean;
  motivo: string | null;
  reglaOriginal: string; // la del resolver sin anclas heredadas
  accionResolver: string;
  casoResolver: string | null;
  casoGuarda: string | null; // caso del objeto que cita la guarda (viva/hermana/duplicado)
  mismoCaso: boolean | null; // null = la guarda no cita objeto o este no tiene caso
  simulacion: boolean;
};

/** Toda comparación guarda↔resolver (acuerde o no), para medir la tasa de acuerdo. */
export function compararDecisiones(i: {
  vieja: Vieja;
  objeto: "solicitud" | "presupuesto";
  sombra: { casoId: string | null; decision: Decision; decisionSinAncla?: Decision; vivo: VivoEnCaso };
  casoGuarda: string | null;
  simulado: boolean;
}): Comparacion {
  const motivo = decidirDiscrepancia(i.vieja, i.sombra, i.objeto, i.simulado);
  const casoResolver = i.sombra.decision.accion === "adjuntar" ? i.sombra.decision.casoId ?? null : i.sombra.casoId;
  return {
    acuerdo: motivo === null,
    motivo,
    reglaOriginal: (i.sombra.decisionSinAncla || i.sombra.decision).regla,
    accionResolver: i.sombra.decision.accion,
    casoResolver,
    casoGuarda: i.casoGuarda,
    mismoCaso: i.casoGuarda && casoResolver ? i.casoGuarda === casoResolver : null,
    simulacion: i.simulado,
  };
}

export const BARRIDO_SIN_VIDA_DIAS = 7;
export const BARRIDO_VACIO_DIAS = 1;
const EVENTOS_DESECHABLES = new Set(["creado", "adjuntado", "posible", "transicion"]);
/** Sin rastro útil (comparaciones, veredictos…): se puede borrar sin perder medición. */
export function soloEventosDesechables(tipos: string[]): boolean {
  return tipos.every((t) => EVENTOS_DESECHABLES.has(t));
}

/**
 * Caso ABIERTO que ya no lleva a nada: sin hijos y sin rastro útil → borrar (>1 d);
 * sin presupuesto vivo, solicitud viva ni pedido → PERDIDO (>7 d). null = se queda.
 */
export function decidirBarrido(i: {
  estado: string;
  lastActivityAt: Date;
  ahora: Date;
  hijos: number; // quotes + lprs + orders + inbound + analyses
  quotes: QuoteDelCaso[];
  lprs: LprDelCaso[];
  pedidos: number;
  tiposEventos: string[];
}): "borrar" | "perder" | null {
  if (i.estado !== "ABIERTO") return null;
  const dias = (i.ahora.getTime() - i.lastActivityAt.getTime()) / 864e5;
  if (i.hijos === 0 && dias > BARRIDO_VACIO_DIAS) return soloEventosDesechables(i.tiposEventos) ? "borrar" : "perder";
  if (dias <= BARRIDO_SIN_VIDA_DIAS) return null;
  const vivo = i.pedidos > 0 || i.quotes.some(quoteCuentaViva) || i.lprs.some((l) => lprViva(l, i.ahora));
  return vivo ? null : "perder";
}

/** Sin pedido, un presupuesto formalizado hace sus veces: PAID/IN_PROGRESS → EN_CURSO, DELIVERED → ENTREGADO. */
export function pedidosDeFormalizados(quotes: { status: string; deletedAt: Date | null }[]): PedidoParaEstado[] {
  return quotes
    .filter((q) => !q.deletedAt && (q.status === "PAID" || q.status === "IN_PROGRESS" || q.status === "DELIVERED"))
    .map((q) => (q.status === "DELIVERED" ? { status: "DELIVERED" } : { status: "PAID", paymentStatus: "PAID" }));
}

export type PlanRecalculo = { estado: CasoEstado; cambia: boolean; closedAt: "poner" | "quitar" | "dejar" };

/**
 * Estado del caso desde sus hijos, igual que el backfill: pedido manda; sin
 * pedido, con presupuesto manda la vigente (o la última viva si nadie tiene la
 * clave); sin presupuesto, la solicitud viva. Un caso sin hijos no se toca.
 */
export function planRecalculo(i: {
  casoId: string;
  estado: string;
  closedAt: Date | null;
  pedidos: PedidoParaEstado[];
  quotes: QuoteDelCaso[];
  lprs: LprDelCaso[];
  ahora: Date;
}): PlanRecalculo | null {
  if (!esCasoEstado(i.estado)) return null;
  const actual = i.estado;
  const vivos = i.quotes.filter((q) => !q.deletedAt);
  if (i.pedidos.length === 0 && vivos.length === 0 && i.lprs.length === 0) return { estado: actual, cambia: false, closedAt: "dejar" };
  const vigente =
    vivos.find(quoteCuentaViva) ||
    vivos.find((q) => q.liveCasoKey === i.casoId) ||
    [...vivos].filter((q) => !q.supersededAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ||
    null;
  const vivo = vigente ? quoteCuentaViva(vigente) : i.lprs.some((l) => lprViva(l, i.ahora));
  const pedidos = i.pedidos.length ? i.pedidos : pedidosDeFormalizados(vivos);
  const propuesto = estadoDeCaso({ pedidos, vivo });
  const estado = puedeCaso(actual, propuesto) ? propuesto : actual;
  const cerrado = casoTerminal(estado) || estado === "PERDIDO";
  const closedAt = cerrado ? (i.closedAt ? "dejar" : "poner") : i.closedAt ? "quitar" : "dejar";
  return { estado, cambia: estado !== actual, closedAt };
}
