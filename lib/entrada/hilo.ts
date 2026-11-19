// El hilo de la puerta (lógica PURA): del estado (servidor + respuestas del cliente) salen los mensajes y lo que se
// le pregunta ahora. Una sola página: cada respuesta queda en el hilo y se corrige tocándola.
import type { ClientView } from "./view.ts";

export type EditKey = "origen" | "destino" | "plazo" | "lugar" | `pregunta:${number}`;
export type Urgency = "ASAP" | "DATE" | "FLEXIBLE";

export type HiloLocal = {
  /** Answered in the thread before the targets exist (the server stores both together). */
  origenDado: boolean;
  origen: string | null;
  terminado: boolean;
  leyendo: boolean;
  urgency: Urgency | null;
  neededBy: string | null;
  lugarHecho: boolean;
  pais: string | null;
  organismo: string | null;
  respuestas: Record<number, string>;
};

export const LOCAL_VACIO: HiloLocal = { origenDado: false, origen: null, terminado: false, leyendo: false, urgency: null, neededBy: null, lugarHecho: false, pais: null, organismo: null, respuestas: {} };

export type HiloState = { email: string | null; view: ClientView | null; local: HiloLocal; editing: EditKey | null };

export type Msg =
  | { id: string; from: "casa"; kind: "hola" | "pide_codigo" | "codigo_ok" | "pide_origen" | "pide_destino" | "pide_archivos" | "pregunta_terminado" | "leyendo" | "resultado" | "solo_lectura" | "manual" | "pide_plazo" | "pide_lugar" | "resumen" | "enviado" | "sin_jurado"; text?: string }
  | { id: string; from: "casa"; kind: "pregunta"; index: number; text: string; idioma: boolean }
  | { id: string; from: "cliente"; kind: "email" | "origen" | "destino" | "archivos" | "terminado" | "respuesta" | "plazo" | "lugar"; editKey?: EditKey; index?: number };

export type Ask =
  | { kind: "contacto" }
  | { kind: "codigo" }
  | { kind: "origen" }
  | { kind: "destino" }
  | { kind: "archivos" }
  | { kind: "terminado" }
  | { kind: "leyendo" }
  | { kind: "pregunta"; index: number; idioma: boolean }
  | { kind: "plazo" }
  | { kind: "lugar" }
  | { kind: "enviar" };

const LANG_QUESTION = /idioma|lengua|language|langue|sprache|traduc/i;
/** A reading question about the target language is answered with the language picker, not free text. */
export const isLangQuestion = (text: string) => LANG_QUESTION.test(text) && /\?|¿/.test(text);

export function buildHilo(s: HiloState): { messages: Msg[]; ask: Ask | null } {
  const m: Msg[] = [{ id: "hola", from: "casa", kind: "hola" }];
  const done = (ask: Ask | null) => ({ messages: m, ask: s.editing ? askFor(s.editing, s) : ask });
  const v = s.view;
  if (!v) return { messages: m, ask: { kind: "contacto" } };

  m.push({ id: "email", from: "cliente", kind: "email" }, { id: "pide_codigo", from: "casa", kind: "pide_codigo" });
  if (!v.emailVerificado) return done({ kind: "codigo" });
  m.push({ id: "codigo_ok", from: "casa", kind: "codigo_ok" });

  if (v.estado === "sin_jurado") {
    m.push({ id: "sin_jurado", from: "casa", kind: "sin_jurado" });
    return { messages: m, ask: null };
  }

  m.push({ id: "pide_origen", from: "casa", kind: "pide_origen" });
  if (!v.idiomas.origen && !s.local.origenDado) return done({ kind: "origen" });
  m.push({ id: "origen", from: "cliente", kind: "origen", editKey: "origen" });

  m.push({ id: "pide_destino", from: "casa", kind: "pide_destino" });
  if (v.idiomas.destinos.length === 0) return done({ kind: "destino" });
  m.push({ id: "destino", from: "cliente", kind: "destino", editKey: "destino" });

  m.push({ id: "pide_archivos", from: "casa", kind: "pide_archivos" });
  if (v.archivos.length > 0) m.push({ id: "archivos", from: "cliente", kind: "archivos" });
  const lectura = v.lectura;
  const leida = v.estado !== "abierta" && lectura && lectura.fase !== "leyendo";
  if (!leida) {
    if (s.local.leyendo || lectura?.fase === "leyendo") {
      m.push({ id: "terminado", from: "cliente", kind: "terminado" }, { id: "leyendo", from: "casa", kind: "leyendo" });
      return done({ kind: "leyendo" });
    }
    if (!s.local.terminado || v.archivos.length === 0) return done({ kind: "archivos" });
    m.push({ id: "terminado", from: "cliente", kind: "terminado" }, { id: "pregunta_terminado", from: "casa", kind: "pregunta_terminado" });
    return done({ kind: "terminado" });
  }

  m.push({ id: "terminado", from: "cliente", kind: "terminado" });
  m.push({ id: "resultado", from: "casa", kind: lectura!.fase === "revision_manual" ? "manual" : "resultado" });
  if (v.soloLectura) m.push({ id: "solo_lectura", from: "casa", kind: "solo_lectura" });

  const confirmada = v.estado === "confirmada";
  const preguntas = lectura!.preguntas;
  for (let i = 0; i < preguntas.length; i++) {
    const idioma = isLangQuestion(preguntas[i]);
    m.push({ id: `pregunta:${i}`, from: "casa", kind: "pregunta", index: i, text: preguntas[i], idioma });
    if (s.local.respuestas[i] === undefined && !confirmada) return done({ kind: "pregunta", index: i, idioma });
    if (s.local.respuestas[i] !== undefined) m.push({ id: `respuesta:${i}`, from: "cliente", kind: "respuesta", index: i, editKey: `pregunta:${i}` });
  }

  m.push({ id: "pide_plazo", from: "casa", kind: "pide_plazo" });
  const urgency = s.local.urgency ?? (v.plazo.urgency as Urgency | null);
  if (!urgency || (urgency === "DATE" && !(s.local.neededBy ?? v.plazo.neededBy))) return done({ kind: "plazo" });
  m.push({ id: "plazo", from: "cliente", kind: "plazo", editKey: "plazo" });

  m.push({ id: "pide_lugar", from: "casa", kind: "pide_lugar" });
  if (!s.local.lugarHecho && !confirmada) return done({ kind: "lugar" });
  m.push({ id: "lugar", from: "cliente", kind: "lugar", editKey: "lugar" });

  m.push({ id: "resumen", from: "casa", kind: "resumen" });
  if (!confirmada) return done({ kind: "enviar" });
  m.push({ id: "enviado", from: "casa", kind: "enviado" });
  return { messages: m, ask: null };
}

function askFor(key: EditKey, s: HiloState): Ask {
  if (key.startsWith("pregunta:")) {
    const index = Number(key.slice(9));
    return { kind: "pregunta", index, idioma: isLangQuestion(s.view?.lectura?.preguntas[index] ?? "") };
  }
  return { kind: key as "origen" | "destino" | "plazo" | "lugar" };
}

/** Real progress while the reading runs: what is being read and in which order (never invented findings). */
export function progressSteps(archivos: { name: string; pages: number | null }[]): ({ kind: "inicio"; files: number; pages: number | null } | { kind: "archivo"; name: string; pages: number | null } | { kind: "agrupar" } | { kind: "comprobar" } | { kind: "casi" })[] {
  const counted = archivos.every((a) => a.pages !== null && a.pages > 0);
  const pages = counted ? archivos.reduce((n, a) => n + (a.pages ?? 0), 0) : null;
  return [
    { kind: "inicio", files: archivos.length, pages },
    ...archivos.slice(0, 8).map((a) => ({ kind: "archivo" as const, name: a.name, pages: a.pages })),
    { kind: "agrupar" },
    { kind: "comprobar" },
    { kind: "casi" },
  ];
}
