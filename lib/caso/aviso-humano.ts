// lib/caso/aviso-humano.ts — F3a, lógica PURA: ¿el aviso «Lead pide presupuesto
// humano» sale entero, corto o no sale? Idempotente por caso: el mismo cliente que
// repite con los mismos documentos no genera otro aviso completo.
//   completo = primera vez en el caso, hay documentos nuevos, o esta vez SÍ salió
//              una solicitud nueva a lavori (es noticia).
//   corto    = repite sin nada nuevo y hace ≥ 12 h del último aviso del caso:
//              «ha vuelto a pedir» (señal de interés), solo email, sin SMS.
//   nada     = repite dentro de las 12 h (doble clic, reintento): ni aviso ni
//              acuse al cliente, que ya lo recibió.

export const AVISO_REPETIDO_HORAS = 12;

export type AvisoPrevio = { tipo: "aviso_humano" | "aviso_humano_repetido"; createdAt: Date; docs: string[] };
export type DecisionAviso = { tipo: "completo" | "corto" | "nada"; docsNuevos: string[] };

/** Huella estable de los documentos (hash del archivo o, si falta, id del análisis). */
export function clavesDocs(docs: { hash?: string | null; id: string }[]): string[] {
  return [...new Set(docs.map((d) => (d.hash ? `h:${d.hash}` : `d:${d.id}`)))].sort();
}

export function dedupeAviso(claves: string[]): string {
  return claves.join("|").slice(0, 180) || "sin-docs";
}

export function decidirAvisoHumano(i: {
  casoId: string | null;
  docs: string[];
  previos: AvisoPrevio[];
  solicitudNueva: boolean;
  ahora: Date;
}): DecisionAviso {
  if (!i.casoId) return { tipo: "completo", docsNuevos: i.docs };
  const avisados = new Set(i.previos.filter((p) => p.tipo === "aviso_humano").flatMap((p) => p.docs));
  const docsNuevos = i.docs.filter((d) => !avisados.has(d));
  if (avisados.size === 0 || docsNuevos.length > 0 || i.solicitudNueva) return { tipo: "completo", docsNuevos };
  const ultimo = Math.max(...i.previos.map((p) => p.createdAt.getTime()));
  return { tipo: i.ahora.getTime() - ultimo >= AVISO_REPETIDO_HORAS * 36e5 ? "corto" : "nada", docsNuevos };
}
