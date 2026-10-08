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

// Motivos deducidos por el sistema. lostReason es un enum de Prisma (cambiarlo
// exige db push), así que se guardan como marca en lostReasonNote y el enum se
// deja a null: lo que el cliente o Juan eligen sigue mandando sobre la deducción.
export const AUTO_LOST_NOTES = { NOT_OPENED: "auto:no_abierto", REPLACED: "auto:sustituido" } as const;
export type AutoLostCode = keyof typeof AUTO_LOST_NOTES;
export const AUTO_LOST_LABELS: Record<AutoLostCode, string> = {
  NOT_OPENED: "nunca abrió el presupuesto",
  REPLACED: "pagó otro presupuesto del mismo encargo",
};

/** Motivo efectivo de un presupuesto perdido: el humano (enum) o el deducido (marca). */
export function effectiveLostReason(q: { lostReason?: string | null; lostReasonNote?: string | null }): string | null {
  if (q.lostReason) return q.lostReason;
  const hit = (Object.keys(AUTO_LOST_NOTES) as AutoLostCode[]).find((k) => q.lostReasonNote === AUTO_LOST_NOTES[k]);
  return hit ?? null;
}

export function effectiveLostReasonLabel(q: { lostReason?: string | null; lostReasonNote?: string | null }): string | null {
  const code = effectiveLostReason(q);
  if (!code) return null;
  return (AUTO_LOST_LABELS as Record<string, string>)[code] ?? quoteLostReasonLabel(code);
}
