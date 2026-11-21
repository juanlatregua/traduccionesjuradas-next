// La puerta de la portada (lógica PURA): del estado del servidor y de lo que el cliente ya contestó sale la pantalla
// que toca. Cuatro etapas visibles: Documentos · Tu email · Revisión · Fecha y destino.
import type { ClientView } from "./view.ts";

export type Urgency = "ASAP" | "DATE" | "FLEXIBLE";

export type PortadaLocal = {
  /** «Sí, ya están todos»: se pide el email y, confirmado, empieza la lectura. */
  quiereLeer: boolean;
  /** Ya leídos, el cliente vuelve a «Tus documentos» desde «Cambiar». */
  verArchivos: boolean;
  /** Vuelve a escribir el email antes de confirmarlo. */
  cambiarEmail: boolean;
  /** «Está bien así, continuar» en la revisión. */
  revisado: boolean;
  urgency: Urgency | null;
  neededBy: string | null;
  pais: string | null;
  organismo: string | null;
  notas: string;
  respuestas: Record<number, string>;
  /** Dudas: las que se escriben antes de confirmar el email esperan (a = null, enviada = false) y salen solas al confirmarlo. */
  dudas: { q: string; a: string | null; enviada: boolean }[];
};

export const PORTADA_VACIA: PortadaLocal = {
  quiereLeer: false, verArchivos: false, cambiarEmail: false, revisado: false, urgency: null, neededBy: null, pais: null, organismo: null, notas: "", respuestas: {}, dudas: [],
};

export type Paso = "portada" | "archivos" | "email" | "codigo" | "lectura" | "documentos" | "fecha" | "enviado" | "sin_jurado";

/** 0 Documentos · 1 Tu email · 2 Revisión · 3 Fecha y destino (4 = todo hecho). */
export const ETAPA: Record<Paso, number> = { portada: 0, archivos: 0, email: 1, codigo: 1, lectura: 2, documentos: 2, fecha: 3, enviado: 4, sin_jurado: 4 };

export function pasoDe(view: ClientView | null, local: PortadaLocal): Paso {
  if (!view || view.archivos.length === 0) return "portada";
  if (view.estado === "sin_jurado") return "sin_jurado";
  if (view.estado === "confirmada") return "enviado";
  const lectura = view.lectura;
  const leida = view.estado === "leida" && Boolean(lectura) && lectura!.fase !== "leyendo";
  const enCurso = lectura?.fase === "leyendo" && view.estado === "abierta" && view.emailVerificado;
  if (leida && local.verArchivos) return "archivos";
  if (!leida && !enCurso && !local.quiereLeer) return "archivos";
  if (!view.email || (local.cambiarEmail && !view.emailVerificado)) return "email";
  if (!view.emailVerificado) return "codigo";
  if (!leida) return "lectura";
  if (!local.revisado) return "documentos";
  return "fecha";
}

/** Pages the client sent, counted when every file says how many it has. */
export function paginasDe(archivos: { pages: number | null }[]): number | null {
  return archivos.every((a) => a.pages !== null && a.pages > 0) ? archivos.reduce((n, a) => n + (a.pages ?? 0), 0) : null;
}

/** Each page of each file once, in upload order: what the client sees as thumbnails. Unknown counts show one page. */
export function hojasDe(archivos: { id: string; pages: number | null }[]): { archivoId: string; page: number }[] {
  return archivos.flatMap((a) => Array.from({ length: Math.max(1, a.pages ?? 1) }, (_, i) => ({ archivoId: a.id, page: i + 1 })));
}

/** A reading document with something to look at again: missing pages or hard to read. */
export const conAviso = (d: { incluido: boolean; faltan: number[]; ilegible: boolean }) => d.incluido && (d.faltan.length > 0 || d.ilegible);
