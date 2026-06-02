// lib/i18n/locales.ts — Fundación i18n. UN solo tipo de idioma para todo el
// sitio (home, puerta, nav, utilidades, funnel, diagnóstico) y la fuente única
// de: rutas por idioma, detección por ruta y etiquetas del selector.
//
// Añadir un idioma = añadir su código aquí + su ruta + su columna en cada
// diccionario. El código (componentes) ya mapea sobre `Locale`, no se toca.

export type Locale = "es" | "fr" | "en" | "de" | "pt";

export const LOCALES: Locale[] = ["es", "fr", "en", "de", "pt"];

/** Registro de traducción: obliga (en tiempo de tipo) a cubrir los 5 idiomas. */
export type Tr = Record<Locale, string>;

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "es" || v === "fr" || v === "en" || v === "de" || v === "pt";
}

/** Normaliza cualquier valor (p.ej. Order.clientLocale) a un Locale válido. */
export function resolveLocale(v: string | null | undefined): Locale {
  return isLocale(v) ? v : "es";
}

/** Home propio de cada idioma. Fuente única para selector, nav y detección. */
export const LOCALE_HOME: Record<Locale, string> = {
  es: "/",
  fr: "/traduction-assermentee",
  en: "/sworn-translation",
  de: "/beglaubigte-uebersetzung",
  pt: "/traducao-certificada",
};

/**
 * Lector de requerimientos (utilidad flagship v2). Slugs HÍBRIDOS: ES y FR
 * (nichos fuertes) por intención de búsqueda; EN/DE/PT descriptivos.
 */
export const LECTOR_HOME: Record<Locale, string> = {
  es: "/que-traducciones-necesito",
  fr: "/quelles-traductions-pour-ma-demarche",
  en: "/official-letter-reader",
  de: "/behoerdenbrief-leser",
  pt: "/leitor-de-notificacoes",
};

/** Etiqueta corta (selector) y nombre nativo (aria/menú). */
export const LOCALE_LABEL: Record<Locale, string> = { es: "ES", fr: "FR", en: "EN", de: "DE", pt: "PT" };
export const LOCALE_NATIVE: Record<Locale, string> = {
  es: "Español",
  fr: "Français",
  en: "English",
  de: "Deutsch",
  pt: "Português",
};

// Prefijos de ruta → idioma del marco (header/footer/puerta). El resto del
// sitio (páginas SEO en español) usa el marco español por defecto.
export const LOCALE_PREFIXES: { prefix: string; locale: Locale }[] = [
  { prefix: "/traduction-assermentee", locale: "fr" },
  { prefix: "/fr", locale: "fr" },
  { prefix: "/sworn-translation", locale: "en" },
  { prefix: "/beglaubigte-uebersetzung", locale: "de" },
  { prefix: "/traducao-certificada", locale: "pt" },
  // Lector de requerimientos (header/footer en el idioma correcto)
  { prefix: LECTOR_HOME.fr, locale: "fr" },
  { prefix: LECTOR_HOME.en, locale: "en" },
  { prefix: LECTOR_HOME.de, locale: "de" },
  { prefix: LECTOR_HOME.pt, locale: "pt" },
];

export function localeFromPath(pathname: string | null | undefined): Locale {
  if (!pathname) return "es";
  const hit = LOCALE_PREFIXES.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  return hit ? hit.locale : "es";
}

// ── SEO: URLs absolutas y alternates hreflang (fuente única) ──
export const SITE_URL = "https://www.traduccionesjuradas.net";

/** URL absoluta del home de cada idioma. */
export const LOCALE_ABS: Record<Locale, string> = {
  es: SITE_URL,
  fr: `${SITE_URL}${LOCALE_HOME.fr}`,
  en: `${SITE_URL}${LOCALE_HOME.en}`,
  de: `${SITE_URL}${LOCALE_HOME.de}`,
  pt: `${SITE_URL}${LOCALE_HOME.pt}`,
};

// Etiquetas BCP-47 para hreflang. x-default apunta al home español (mercado base).
export const HREFLANG_ALTERNATES: Record<string, string> = {
  "es-ES": LOCALE_ABS.es,
  "fr-FR": LOCALE_ABS.fr,
  "en-GB": LOCALE_ABS.en,
  "de-DE": LOCALE_ABS.de,
  "pt-PT": LOCALE_ABS.pt,
  "x-default": SITE_URL,
};

/** URL absoluta del lector de requerimientos por idioma. */
export const LECTOR_ABS: Record<Locale, string> = {
  es: `${SITE_URL}${LECTOR_HOME.es}`,
  fr: `${SITE_URL}${LECTOR_HOME.fr}`,
  en: `${SITE_URL}${LECTOR_HOME.en}`,
  de: `${SITE_URL}${LECTOR_HOME.de}`,
  pt: `${SITE_URL}${LECTOR_HOME.pt}`,
};

/** hreflang propio del cluster del lector (NO reutilizar el de los homes). */
export const HREFLANG_LECTOR: Record<string, string> = {
  "es-ES": LECTOR_ABS.es,
  "fr-FR": LECTOR_ABS.fr,
  "en-GB": LECTOR_ABS.en,
  "de-DE": LECTOR_ABS.de,
  "pt-PT": LECTOR_ABS.pt,
  "x-default": LECTOR_ABS.es,
};

/** Locale BCP-47 para Intl (formato de moneda/fecha). */
export const LOCALE_INTL: Record<Locale, string> = {
  es: "es-ES",
  fr: "fr-FR",
  en: "en-GB",
  de: "de-DE",
  pt: "pt-PT",
};

/** Nombre del breadcrumb "inicio" por idioma. */
export const LOCALE_HOME_LABEL: Record<Locale, string> = {
  es: "Inicio",
  fr: "Accueil",
  en: "Home",
  de: "Startseite",
  pt: "Início",
};
