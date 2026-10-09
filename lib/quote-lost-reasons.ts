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
export const AUTO_LOST_NOTES = { NOT_OPENED: "auto:no_abierto", REPLACED: "auto:sustituido", NO_RESPONSE: "auto:sin_respuesta" } as const;
// NO_RESPONSE no se deduce al caducar: lo escribe el cierre suave del cron (lostReason = NO_LONGER_NEEDED).
export type AutoLostCode = "NOT_OPENED" | "REPLACED";
export type AutoLostKey = keyof typeof AUTO_LOST_NOTES;
export const AUTO_LOST_LABELS: Record<AutoLostKey, string> = {
  NO_RESPONSE: "Cerrado sin respuesta tras 2º contacto",
  NOT_OPENED: "nunca abrió el presupuesto",
  REPLACED: "pagó otro presupuesto del mismo encargo",
};

/** Motivo efectivo de un presupuesto perdido: el humano (enum) o el deducido (marca). */
export function effectiveLostReason(q: { lostReason?: string | null; lostReasonNote?: string | null }): string | null {
  // El cierre suave pone NO_LONGER_NEEDED + auto:sin_respuesta: ahí la marca manda sobre el enum.
  if (q.lostReason && q.lostReasonNote !== AUTO_LOST_NOTES.NO_RESPONSE) return q.lostReason;
  const hit = (Object.keys(AUTO_LOST_NOTES) as AutoLostKey[]).find((k) => q.lostReasonNote === AUTO_LOST_NOTES[k]);
  if (hit) return hit;
  return q.lostReason ?? null;
}

export function effectiveLostReasonLabel(q: { lostReason?: string | null; lostReasonNote?: string | null }): string | null {
  const code = effectiveLostReason(q);
  if (!code) return null;
  return (AUTO_LOST_LABELS as Record<string, string>)[code] ?? quoteLostReasonLabel(code);
}
