// lib/ai/word-counter.ts — Conteo de palabras estilo Microsoft Word
//
// Replicates Microsoft Word behavior: splits on whitespace over the COMPLETE
// extracted text — including headers, proper names, alphanumeric codes,
// signature formulas, annotations, and marginal notes (averbações).
//
// Excludes ONLY:
// - Pure numeric tokens (digits + numeric punctuation, no letters)
//   e.g., "019570", "01", "55", "2.301", "019.345.676-01", "0024.19.456.789-3"
// - Empty punctuation-only tokens (dashes, ellipsis, decorative separators)

export function countDocumentWords(text: string): number {
  if (!text || !text.trim()) return 0;

  const tokens = text.split(/\s+/).filter(Boolean);

  return tokens.filter((token) => {
    // Strip leading/trailing punctuation to inspect core content.
    // Uses \p{L} (any Unicode letter) + \p{N} (any Unicode number) so that
    // non-Latin scripts (Arabic, Cyrillic, CJK, Hebrew, etc.) are counted.
    const core = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!core) return false;

    // Exclude tokens that are purely numeric (digits + separators, no letters)
    if (/^[\d.,/:;\-–—]+$/.test(core)) return false;
    if (!/\p{L}/u.test(core)) return false;

    return true;
  }).length;
}
