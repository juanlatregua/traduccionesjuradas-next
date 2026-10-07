// lib/ai/word-counter.ts — Conteo de palabras estilo Microsoft Word
//
// Replicates Microsoft Word behavior: splits on whitespace over the COMPLETE
// extracted text — including headers, proper names, alphanumeric codes,
// signature formulas, annotations, and marginal notes (averbações).
//
// Numbers count as words, exactly like Word and CAT tools ("12", "1,210",
// "019.345.676-01" = 1 word each). Excludes ONLY tokens with no letter and no
// digit (dashes, ellipsis, bullets, underscores, decorative separators).

export function countDocumentWords(text: string): number {
  if (!text || !text.trim()) return 0;

  const tokens = text.split(/\s+/).filter(Boolean);

  return tokens.filter((token) => {
    // Strip leading/trailing punctuation to inspect core content.
    // Uses \p{L} (any Unicode letter) + \p{N} (any Unicode number) so that
    // non-Latin scripts (Arabic, Cyrillic, CJK, Hebrew, etc.) are counted.
    const core = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    return core.length > 0;
  }).length;
}

// Palabras FACTURABLES. Los documentos oficiales españoles co-oficiales
// (castellano + català/valencià/gallego/euskera) y otros con el MISMO contenido
// en dos idiomas en paralelo se traducen UNA vez, pero el texto extraído los
// cuenta dos veces. Cuando el análisis marca is_bilingual_duplicate, dividimos
// el conteo entre 2 (aproximación: el grueso del documento está duplicado; los
// sellos/encabezados únicos son una fracción menor). Ver lib/ai/prompts.ts y el
// incidente Candela (expediente ca/es contado a 1.373 en vez de ~687 palabras).
export function billableWordCount(
  text: string,
  opts?: { bilingualDuplicate?: boolean }
): number {
  const words = countDocumentWords(text);
  return opts?.bilingualDuplicate ? Math.round(words / 2) : words;
}
