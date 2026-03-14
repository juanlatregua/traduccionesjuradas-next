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
    // Strip leading/trailing punctuation and symbols to inspect core content
    // Uses explicit Latin ranges (À-ÿ) + ordinal indicators (ª º) to avoid
    // Unicode property escapes that require es2015+ target
    const core = token.replace(
      /^[^a-zA-Z\xAA\xBA\xC0-\xFF0-9]+|[^a-zA-Z\xAA\xBA\xC0-\xFF0-9]+$/g,
      "",
    );
    if (!core) return false;

    // Exclude tokens that are purely numeric (digits + separators, no letters)
    // Matches: "019570", "01", "1995", "41.113", "019.345.676-01", "6.015/73"
    // Does NOT match: "MG-5.234.891", "A-155", "1ª", "3ème", "nº", "Art.45"
    if (/^[\d.,/:;\-–—]+$/.test(core)) return false;

    return true;
  }).length;
}
