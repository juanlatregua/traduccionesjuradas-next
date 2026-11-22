// Lead «no presupuestable» (orden de Juan, 21-nov-2026): par desconocido, documento leído
// con 0 palabras, idioma sin jurado o entrada sin documentos. No es un lead más: falta un dato
// del cliente, y el aviso lleva un BORRADOR para pedírselo (nunca se envía solo). PURO.

/** Idiomas sin jurado en lavori (memoria: EL, RU, UK, PL, ZH; SV añadido por Juan). */
export const NO_JURADO_LANGS = new Set(["el", "ru", "uk", "pl", "zh", "sv"]);

export type NoPresupuestableCode = "par_desconocido" | "sin_palabras" | "sin_jurado" | "sin_documentos";
export type NoPresupuestable = { code: NoPresupuestableCode; falta: string };

const LANG_ES: Record<string, string> = {
  el: "griego", ru: "ruso", uk: "ucraniano", pl: "polaco", zh: "chino", sv: "sueco", fr: "francés", en: "inglés", de: "alemán",
  it: "italiano", pt: "portugués", nl: "neerlandés", ro: "rumano", ar: "árabe", ca: "catalán", no: "noruego", es: "español",
};
export const langEs = (c: string | null | undefined) => LANG_ES[String(c || "").toLowerCase()] || String(c || "?");

const known = (c: string | null | undefined) => {
  const v = String(c || "").trim().toLowerCase();
  return !!v && v !== "unknown" && v !== "other" && v !== "?";
};

export function noPresupuestable(d: {
  sourceLanguage: string | null | undefined;
  targetLanguage: string | null | undefined;
  estimatedWords?: number | null;
  /** El análisis terminó (solo entonces 0 palabras significa «no se pudo leer»). */
  analyzed?: boolean;
  /** La entrada nueva ya resolvió «sin jurado». */
  noJurado?: boolean;
  /** false = la entrada no tiene ningún archivo. */
  hasFiles?: boolean;
}): NoPresupuestable | null {
  const src = String(d.sourceLanguage || "").trim().toLowerCase();
  const tgt = String(d.targetLanguage || "").trim().toLowerCase();
  const foreign = src === "es" ? tgt : src;
  if (d.noJurado || (known(foreign) && NO_JURADO_LANGS.has(foreign))) return { code: "sin_jurado", falta: `idioma sin jurado (${langEs(foreign)})` };
  if (d.hasFiles === false) return { code: "sin_documentos", falta: "no ha subido ningún documento" };
  if (!known(src) || !known(tgt) || (src !== "es" && tgt !== "es") || src === tgt) return { code: "par_desconocido", falta: `par sin determinar (${src || "?"}→${tgt || "?"})` };
  if (d.analyzed && !(Number(d.estimatedWords) > 0)) return { code: "sin_palabras", falta: "el documento se leyó con 0 palabras (ilegible o vacío)" };
  return null;
}

/** Borrador para pedir al cliente el dato que falta. Solo texto: nadie lo envía solo. */
export function clientDraft(np: NoPresupuestable, name: string | null | undefined): { subject: string; body: string } {
  const hola = `Hola${name ? ` ${String(name).trim().split(/\s+/)[0]}` : ""}:`;
  const firma = "Un saludo,\nJuan Silva\nTraductor-Intérprete Jurado · traduccionesjuradas.net";
  const ask: Record<NoPresupuestableCode, string> = {
    par_desconocido: "Hemos recibido su documento, pero no tenemos claro el idioma del original o el idioma al que necesita la traducción. ¿Nos lo confirma? (por ejemplo: del francés al español). En cuanto lo sepamos le enviamos el presupuesto.",
    sin_palabras: "Hemos recibido su documento, pero no conseguimos leerlo bien (parece vacío o la imagen no se lee). ¿Podría enviarnos una copia más nítida, un PDF escaneado o una foto con buena luz de cada página? Le enviamos el presupuesto en cuanto lo tengamos.",
    sin_jurado: "Hemos recibido su solicitud. Ahora mismo no tenemos traductor jurado propio para ese idioma; ¿nos confirma el idioma exacto del documento y para qué organismo es? Así le decimos si podemos ayudarle o le indicamos dónde encontrar uno.",
    sin_documentos: "Hemos recibido su solicitud, pero no nos ha llegado ningún documento. ¿Podría adjuntarlo (PDF o foto de cada página) e indicarnos a qué idioma lo necesita y para cuándo?",
  };
  const subject = np.code === "sin_documentos" ? "Su solicitud de traducción jurada: falta el documento" : "Su solicitud de traducción jurada: nos falta un dato";
  return { subject, body: `${hola}\n\n${ask[np.code]}\n\n¿Para qué fecha lo necesita?\n\n${firma}` };
}

export function mailtoDraft(to: string | null | undefined, d: { subject: string; body: string }): string | null {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || /@whatsapp\.local$/i.test(to)) return null;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
}
