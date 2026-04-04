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
