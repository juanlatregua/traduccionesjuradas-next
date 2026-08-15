import { PER_WORD_RATE } from "./pricing-engine/languages.ts";

// Fallback DELIBERADAMENTE ALTO, no alineado con DEFAULT_RATE (0,10) del motor:
// aquí solo caen idiomas FUERA de la tabla, que son justo los que no deben
// auto-tarificarse (ru, uk, zh…). Este valor alimenta también el suelo
// anti-manipulación de POST /api/orders, donde bajarlo debilitaría la guarda.
// Ver incidente TJ-20260602-NJ42.
export const DEFAULT_WORD_RATE = 0.14;

// Espejo del motor (antes se duplicaba a mano y se quedó sin árabe: es→ar se
// tarificaba a 0,14 por este carril y a 0,10 por la puerta).
export const WORD_RATE_BY_LANG: Record<string, number> = PER_WORD_RATE;

export function getBaseLangFromPair(langOrPair: string) {
  const normalized = String(langOrPair || "").trim().toLowerCase();
  if (!normalized) return "";

  if (normalized.includes("-")) {
    const [from, to] = normalized.split("-");
    if (from === "es" && to) return to;
    if (to === "es" && from) return from;
    return from || normalized;
  }

  return normalized;
}

export function getWordRateForLangOrPair(langOrPair: string) {
  const baseLang = getBaseLangFromPair(langOrPair);
  return WORD_RATE_BY_LANG[baseLang] ?? DEFAULT_WORD_RATE;
}
