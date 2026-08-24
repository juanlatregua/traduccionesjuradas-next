// lib/pricing-engine/languages.ts — Tarifas por idioma

export const PER_WORD_RATE: Record<string, number> = {
  fr: 0.08, // Francés (especialidad, tarifa base)
  en: 0.11, // Inglés
  de: 0.12, // Alemán
  nl: 0.14, // Neerlandés
  it: 0.12, // Italiano
  pt: 0.12, // Portugués
  ca: 0.08, // Catalán
  sv: 0.14, // Sueco
  no: 0.14, // Noruego
  ar: 0.10, // Árabe
  ro: 0.09, // Rumano
};

export const DEFAULT_RATE = 0.10;

// Fuente ÚNICA de verdad de los idiomas extranjeros que el negocio auto-tarifica
// (== claves de PER_WORD_RATE). Cualquier idioma fuera de aquí (p.ej. ruso "ru",
// ucraniano "uk", chino, japonés) NO debe recibir precio instantáneo ni checkout:
// se enruta a presupuesto manual. getRate() conserva el fallback DEFAULT_RATE
// para callers internos, pero el GATE de negocio vive en los bordes (diagnosis +
// checkout) usando isAutoPriceable. Ver incidente TJ-20260602-NJ42 (doc ruso
// malclasificado como "uk" y cobrado por el fallback silencioso).
export const AUTO_PRICEABLE_FOREIGN = new Set(Object.keys(PER_WORD_RATE));

export function isAutoPriceable(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const c = lang.toLowerCase();
  return c === "es" || AUTO_PRICEABLE_FOREIGN.has(c);
}

/** Precio INSTANTÁNEO de cara al PÚBLICO (puerta, chatbot, checkout de la
 * puerta): SOLO francés (decisión Juan 24-ago-2026, auditoría del funnel:
 * cero autopagos por encima de 70 € y el motor tarificaba muy por encima del
 * cierre real — "necesito volumen en fr; el resto previa cotización en lavori").
 * El STAFF sigue tarificando todos los idiomas de PER_WORD_RATE con
 * isAutoPriceable/resolvePriceablePair: este gate es solo del escaparate. */
export function isPublicAutoPriceable(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const c = lang.toLowerCase();
  return c === "es" || c === "fr";
}

// Lado extranjero del par SOLO si forma un par tarificable es↔X (fuente única
// para diagnosis, checkout y el builder de staff — presupuesto 2026-00045):
// - Original ES: exige destino conocido y distinto de ES. Sin destino NO hay
//   tarifa (antes caía al propio "es" y tarificaba en silencio con DEFAULT_RATE).
// - Original extranjero: destino ES o sin determinar → se asume hacia ES; a un
//   TERCER idioma (traducción cruzada, p. ej. fr→en) no se auto-tarifica.
// null = sin par válido → análisis/presupuesto a mano.
export function resolvePriceablePair(
  source: string | null | undefined,
  target: string | null | undefined
): string | null {
  const s = (source || "").trim().toLowerCase();
  const t = (target || "").trim().toLowerCase();
  const known = (c: string) => !!c && c !== "unknown";
  if (!known(s)) return null;
  if (s === "es") return known(t) && t !== "es" ? t : null;
  if (known(t) && t !== "es") return null;
  return s;
}

// Motivo (texto staff) por el que un documento NO lleva precio automático.
// Fuente única: lo devuelve el endpoint de análisis de staff y lo muestra el
// builder — si divergieran, el server y el badge dirían cosas distintas.
export function manualPriceReason(
  source: string | null | undefined,
  foreign: string | null
): string {
  if ((source || "").trim().toLowerCase() === "es") return "Falta el idioma de destino";
  return foreign ? "Idioma sin tarifa automática" : "Par sin español (traducción cruzada)";
}

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "Francés",
  en: "Inglés",
  de: "Alemán",
  nl: "Neerlandés",
  it: "Italiano",
  pt: "Portugués",
  ca: "Catalán",
  sv: "Sueco",
  no: "Noruego",
  ar: "Árabe",
  ro: "Rumano",
  es: "Español",
};

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

export function getRate(langCode: string): number {
  return PER_WORD_RATE[langCode] || DEFAULT_RATE;
}
