// Motivos de presupuesto perdido (enum QuoteLostReason). Módulo sin deps para
// que lo compartan el cliente (/q/[token], ficha admin, lista) y el servidor
// (ruta mark-lost, digest) — una sola lista de etiquetas en 3ª persona.
export const QUOTE_LOST_REASONS = ["PRICE", "DEADLINE", "NO_LONGER_NEEDED", "SOLVED_ELSEWHERE", "OTHER"] as const;
export type QuoteLostReasonCode = (typeof QUOTE_LOST_REASONS)[number];

export const QUOTE_LOST_REASON_LABELS: Record<QuoteLostReasonCode, string> = {
  PRICE: "el precio",
  DEADLINE: "el plazo",
  NO_LONGER_NEEDED: "ya no lo necesita",
  SOLVED_ELSEWHERE: "lo resolvió con otro traductor",
  OTHER: "otro motivo",
};

export function quoteLostReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return QUOTE_LOST_REASON_LABELS[code as QuoteLostReasonCode] || code;
}
