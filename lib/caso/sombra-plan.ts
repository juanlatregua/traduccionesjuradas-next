// lib/caso/sombra-plan.ts — F2, lógica PURA del modo sombra: qué señal manda cada
// entrada al resolver, cuándo la guarda vieja y el resolver no coinciden
// (discrepancia) y qué estado le toca al caso. Nada de esto decide negocio: las
// guardas viejas siguen creando/bloqueando; esto solo asigna casoId y anota.

import { estadoDeCaso, quoteVivo, lprViva, puedeCaso, esCasoEstado, casoTerminal, type CasoEstado, type PedidoParaEstado } from "./estados.ts";
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
  liveCasoKey: string | null;
  supersededAt: Date | null;
  createdAt: Date;
};
export type LprDelCaso = { par: string; status: string; createdAt: Date };

export function vivoEnCaso(i: { casoId: string; par: string | null; quotes: QuoteDelCaso[]; lprs: LprDelCaso[]; ahora: Date }): VivoEnCaso {
  const par = i.par ? [i.par] : [];
  return {
    lprMismoPar: i.lprs.some((l) => lprViva(l, i.ahora) && paresCompatibles(par, [l.par])),
    vigente: i.quotes.some((q) => q.liveCasoKey === i.casoId && quoteVivo(q)),
  };
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
  objeto: "solicitud" | "presupuesto"
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
  return adjunta ? "bloquea_caso_sin_nada_vivo" : "bloquea_resolver_crearia_caso";
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
    vivos.find((q) => q.liveCasoKey === i.casoId) ||
    [...vivos].filter((q) => !q.supersededAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ||
    null;
  const vivo = vigente ? quoteVivo(vigente) : i.lprs.some((l) => lprViva(l, i.ahora));
  const propuesto = estadoDeCaso({ pedidos: i.pedidos, vivo });
  const estado = puedeCaso(actual, propuesto) ? propuesto : actual;
  const cerrado = casoTerminal(estado) || estado === "PERDIDO";
  const closedAt = cerrado ? (i.closedAt ? "dejar" : "poner") : i.closedAt ? "quitar" : "dejar";
  return { estado, cambia: estado !== actual, closedAt };
}
