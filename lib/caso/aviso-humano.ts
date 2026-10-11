// lib/caso/aviso-humano.ts — F3a, lógica PURA: ¿el aviso «Lead pide presupuesto
// humano» sale entero, corto o no sale? Idempotente por caso: el mismo cliente que
// repite con los mismos documentos no genera otro aviso completo.
//   completo = primera vez en el caso, hay documentos nuevos, esta vez SÍ salió
//              una solicitud nueva a lavori (es noticia), el contacto cambió o el
//              caso no está ABIERTO (vuelve alguien de un caso cerrado).
//   corto    = repite sin nada nuevo y hace ≥ 12 h del último aviso del caso:
//              «ha vuelto a pedir» (señal de interés), solo email, sin SMS.
//   nada     = repite dentro de las 12 h (doble clic, reintento): sin aviso a staff
//              (el acuse al cliente lo deduplica sendPriceRequestAckToClient).

export const AVISO_REPETIDO_HORAS = 12;

export type AvisoPrevio = { tipo: "aviso_humano" | "aviso_humano_repetido"; createdAt: Date; docs: string[]; email?: string | null; phone?: string | null };

const normEmail = (e: string | null | undefined) => String(e || "").trim().toLowerCase();
const normTel = (t: string | null | undefined) => String(t || "").replace(/\D/g, "").slice(-9);

/** Hay contacto ahora y no coincide con el del último aviso. */
export function contactoCambia(ahora: { email?: string | null; phone?: string | null }, ultimo: { email?: string | null; phone?: string | null } | undefined): boolean {
  if (!ultimo) return false;
  const e = normEmail(ahora.email);
  const t = normTel(ahora.phone);
  return (!!e && e !== normEmail(ultimo.email)) || (!!t && t !== normTel(ultimo.phone));
}
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
  casoEstado?: string | null;
  contacto?: { email?: string | null; phone?: string | null };
  docs: string[];
  previos: AvisoPrevio[];
  solicitudNueva: boolean;
  ahora: Date;
}): DecisionAviso {
  if (!i.casoId || (i.casoEstado && i.casoEstado !== "ABIERTO")) return { tipo: "completo", docsNuevos: i.docs };
  const avisados = new Set(i.previos.filter((p) => p.tipo === "aviso_humano").flatMap((p) => p.docs));
  const docsNuevos = i.docs.filter((d) => !avisados.has(d));
  const ultimoAviso = [...i.previos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (avisados.size === 0 || docsNuevos.length > 0 || i.solicitudNueva || contactoCambia(i.contacto || {}, ultimoAviso)) return { tipo: "completo", docsNuevos };
  return { tipo: i.ahora.getTime() - ultimoAviso.createdAt.getTime() >= AVISO_REPETIDO_HORAS * 36e5 ? "corto" : "nada", docsNuevos };
}
