import { getBaseLangFromPair } from "@/lib/pricing";

/**
 * Precio fijo por idioma base para documentos estándar de ~1 hoja.
 * Mismo precio en ambas direcciones (X→ES y ES→X).
 */
export const FIXED_DOC_PRICE_BY_LANG: Record<string, number> = {
  fr: 40,
  en: 50,
  de: 55,
  pt: 75,
  nl: 55,
  it: 55,
  ca: 55,
  sv: 55,
  no: 55,
};

/** Categorías de documento que tienen precio fijo (docs estándar ~1 hoja) */
export const FIXED_PRICE_CATEGORIES = [
  "registro-civil",
  "antecedentes",
  "academico",
  "identidad",
];

/**
 * Devuelve el precio fijo si existe para la combinación + categoría.
 * Devuelve null si no hay precio fijo (doc tipo notarial, financiero, laboral, otro).
 */
export function getFixedPrice(
  langPair: string,
  category: string
): number | null {
  if (!FIXED_PRICE_CATEGORIES.includes(category)) return null;
  const baseLang = getBaseLangFromPair(langPair);
  return FIXED_DOC_PRICE_BY_LANG[baseLang] ?? null;
}
