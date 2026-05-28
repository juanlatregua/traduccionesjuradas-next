// lib/search/match.ts — Buscador del sitio: índice de páginas + matcher puro.
// Sin dependencias: normaliza acentos y puntúa por token (AND), con tolerancia
// a erratas vía subsecuencia. Pensado para "teclea y salta" sobre ~150 páginas.

export type SearchEntry = {
  title: string;
  path: string;
  group: string;
  keywords?: string;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function searchSite(
  query: string,
  index: SearchEntry[],
  limit = 20
): SearchEntry[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ entry: SearchEntry; score: number }> = [];

  for (const entry of index) {
    const title = normalize(entry.title);
    const haystack = `${title} ${normalize(entry.keywords || "")}`;
    let score = 0;
    let matchesAll = true;

    for (const token of tokens) {
      if (title.startsWith(token)) score += 100;
      else if (title.includes(token)) score += 50;
      else if (haystack.includes(token)) score += 20;
      else {
        matchesAll = false;
        break;
      }
    }

    if (matchesAll) {
      // Títulos más cortos = match más específico → ligero bonus.
      score += Math.max(0, 12 - title.length / 8);
      scored.push({ entry, score });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length
  );
  return scored.slice(0, limit).map((s) => s.entry);
}

// Agrupa resultados por `group`, preservando el orden de aparición.
export function groupResults(
  results: SearchEntry[]
): Array<[string, SearchEntry[]]> {
  const map = new Map<string, SearchEntry[]>();
  for (const r of results) {
    const arr = map.get(r.group);
    if (arr) arr.push(r);
    else map.set(r.group, [r]);
  }
  return Array.from(map.entries());
}
