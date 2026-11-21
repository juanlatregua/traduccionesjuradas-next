/** Attribution presets (?p=) shared by /presupuesto-instantaneo, the home entrance and /api/entrada. */
export const ENTRADA_SOURCES = ["regularizacion-2026", "uge-ce", "lavori", "precios", "whatsapp"] as const;
export type EntradaSource = (typeof ENTRADA_SOURCES)[number];

export function sourceDe(p: string | null | undefined): EntradaSource | null {
  const k = (p ?? "").toLowerCase().trim();
  return (ENTRADA_SOURCES as readonly string[]).includes(k) ? (k as EntradaSource) : null;
}
