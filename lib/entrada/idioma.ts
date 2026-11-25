export function knownLang(code: string | null | undefined): string | null {
  const c = String(code ?? "").trim().toLowerCase();
  return /^[a-z]{2,3}$/.test(c) && c !== "unknown" ? c : null;
}

/** The client's choice wins; otherwise the single language detected among the included documents; otherwise null. */
export function resolveSourceLang(sourceLang: string | null | undefined, docs: { included: boolean; sourceLang: string }[]): string | null {
  const chosen = knownLang(sourceLang);
  if (chosen) return chosen;
  const found = new Set(docs.filter((d) => d.included).map((d) => knownLang(d.sourceLang)).filter((c): c is string => c !== null));
  return found.size === 1 ? [...found][0] : null;
}
