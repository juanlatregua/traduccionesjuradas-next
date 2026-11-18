// Word count like Microsoft Word: whitespace tokens that contain at least one letter or digit.
// Numbers, dates and codes count; dashes, bullets and separators do not.
export function countWords(text: string): number {
  if (!text) return 0;
  let n = 0;
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) n++;
  return n;
}

// Same content printed twice in parallel (co-official bilingual documents): translated once.
export function billableWords(words: number, bilingualDuplicate: boolean): number {
  return bilingualDuplicate ? Math.round(words / 2) : words;
}

// A PDF text layer is trusted when it is dense enough overall and present on at least half the pages.
export const TEXT_PAGE_MIN_WORDS = 10;
export function isReliableTextLayer(pageWords: readonly number[]): boolean {
  const pages = pageWords.length;
  const total = pageWords.reduce((s, n) => s + n, 0);
  if (pages === 0 || total < 30 || total / pages < 40) return false;
  return pageWords.filter((n) => n >= TEXT_PAGE_MIN_WORDS).length / pages >= 0.5;
}
