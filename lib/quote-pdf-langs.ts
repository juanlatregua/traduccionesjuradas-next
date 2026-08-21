// Idiomas del PDF del presupuesto (petición Juan 21-ago-2026). Módulo aparte y
// SIN dependencias para que los componentes cliente no arrastren jspdf/@vercel/blob.
export const QUOTE_PDF_LANGS = ["es", "en", "fr", "it", "pt", "de"] as const;
export type QuotePdfLang = (typeof QUOTE_PDF_LANGS)[number];
export const QUOTE_PDF_LANG_LABELS: Record<QuotePdfLang, string> = {
  es: "Español", en: "English", fr: "Français", it: "Italiano", pt: "Português", de: "Deutsch",
};
export function normalizeQuotePdfLang(v: string | null | undefined): QuotePdfLang {
  const l = String(v || "").trim().toLowerCase();
  return (QUOTE_PDF_LANGS as readonly string[]).includes(l) ? (l as QuotePdfLang) : "es";
}
