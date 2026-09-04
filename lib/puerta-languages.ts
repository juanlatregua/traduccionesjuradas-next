// lib/puerta-languages.ts — Idiomas que el cliente DECLARA en la puerta antes
// de subir nada (Juan, 4-sep-2026: "no se puede subir nada sin antes poner
// email, lenguas"). Hasta hoy la IA adivinaba el par y los originales en
// español llegaban como es→unknown: presupuestos a medias y una llamada para
// preguntar el destino. Ahora el par lo pone el cliente y la IA lo respeta.
//
// Módulo PURO (sin Prisma): lo comparten la puerta (cliente), el registro y el
// análisis (servidor) y se prueba con node --test.

export const PUERTA_LANG_CODES = ["es", "fr", "en", "de", "it", "pt", "nl", "ro", "ar", "ca", "sv", "no", "other"] as const;
export type PuertaLangCode = (typeof PUERTA_LANG_CODES)[number];

const CODES = new Set<string>(PUERTA_LANG_CODES);

/** Código válido de la lista de la puerta, o null. */
export function normalizeDeclaredLang(v: unknown): PuertaLangCode | null {
  const c = String(v ?? "").trim().toLowerCase();
  return CODES.has(c) ? (c as PuertaLangCode) : null;
}

/** Nombres en español para el análisis (source_name/target_name). */
export const LANG_NAMES_ES: Record<PuertaLangCode, string> = {
  es: "Español", fr: "Francés", en: "Inglés", de: "Alemán", it: "Italiano", pt: "Portugués",
  nl: "Neerlandés", ro: "Rumano", ar: "Árabe", ca: "Catalán", sv: "Sueco", no: "Noruego", other: "Otro idioma",
};

/** ¿Par declarado completo y coherente? (origen ≠ destino) */
export function isDeclaredPairValid(source: unknown, target: unknown): boolean {
  const s = normalizeDeclaredLang(source);
  const t = normalizeDeclaredLang(target);
  return Boolean(s && t && s !== t);
}

type LangBlock = { source: string; source_name: string; target: string; target_name: string; confidence: number };

/**
 * Aplica el par DECLARADO por el cliente sobre lo que detectó la IA. El
 * cliente manda: él sabe qué necesita. Lo detectado se conserva en
 * `detected` por si el traductor quiere cotejarlo (p.ej. dijo "francés" y el
 * documento está en inglés). "other" no pisa el origen detectado: la IA sabe
 * más que un "otro" — solo marca que no es un idioma del escaparate.
 */
export function applyDeclaredLanguages<T extends { language: LangBlock }>(
  analysis: T,
  declared: { source?: string | null; target?: string | null }
): T & { language: LangBlock & { declared?: boolean; detected?: { source: string; target: string } } } {
  const s = normalizeDeclaredLang(declared.source);
  const t = normalizeDeclaredLang(declared.target);
  if (!s && !t) return analysis as any;
  const detected = { source: analysis.language.source, target: analysis.language.target };
  const source = s && s !== "other" ? s : analysis.language.source;
  const target = t ?? analysis.language.target;
  return {
    ...analysis,
    language: {
      ...analysis.language,
      source,
      source_name: s && s !== "other" ? LANG_NAMES_ES[s] : analysis.language.source_name,
      target,
      target_name: t ? LANG_NAMES_ES[t] : analysis.language.target_name,
      declared: true,
      detected,
    },
  };
}
