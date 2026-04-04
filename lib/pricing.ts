export const DEFAULT_WORD_RATE = 0.14;

export const WORD_RATE_BY_LANG: Record<string, number> = {
  fr: 0.08,
  en: 0.11,
  de: 0.12,
  pt: 0.12,
  it: 0.12,
  nl: 0.14,
  ca: 0.08,
  sv: 0.14,
  no: 0.14,
  ro: 0.09,
};

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
