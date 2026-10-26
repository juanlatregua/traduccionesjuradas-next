// Fecha límite del cliente (26-oct-2026): la puerta pregunta SIEMPRE «¿Para cuándo
// lo necesitas?» (lo antes posible / fecha / sin prisa). Lógica pura: neededBy se
// guarda como medianoche UTC del día elegido y los «días que faltan» se cuentan en
// calendario de Madrid.

export const DEADLINE_URGENCIES = ["ASAP", "DATE", "FLEXIBLE"] as const;
export type DeadlineUrgency = (typeof DEADLINE_URGENCIES)[number];
export type Deadline = { urgency: DeadlineUrgency | string | null; neededBy: Date | null };

const DAY_MS = 864e5;
export const NEEDED_BY_MAX_DAYS = 365;
export const URGENT_WITHIN_DAYS = 2;

/** Hoy en Madrid como medianoche UTC. */
export function madridToday(now = new Date()): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "YYYY-MM-DD" (o ISO) → fecha real, de hoy a un año vista; si no, null. */
export function parseNeededBy(value: unknown, now = new Date()): Date | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const diff = Math.round((date.getTime() - madridToday(now).getTime()) / DAY_MS);
  return diff >= 0 && diff <= NEEDED_BY_MAX_DAYS ? date : null;
}

/** Urgencia + fecha del cliente. DATE exige fecha válida; ASAP/FLEXIBLE no llevan fecha. */
export function parseDeadline(urgency: unknown, neededBy: unknown, now = new Date()): { urgency: DeadlineUrgency; neededBy: Date | null } | null {
  const u = typeof urgency === "string" ? urgency.trim().toUpperCase() : "";
  if (u === "ASAP" || u === "FLEXIBLE") return { urgency: u, neededBy: null };
  if (u === "DATE" || (!u && neededBy)) {
    const d = parseNeededBy(neededBy, now);
    return d ? { urgency: "DATE", neededBy: d } : null;
  }
  return null;
}

export function daysUntil(neededBy: Date, now = new Date()): number {
  return Math.round((neededBy.getTime() - madridToday(now).getTime()) / DAY_MS);
}

export function fmtNeededBy(neededBy: Date): string {
  return neededBy.toLocaleDateString("es-ES", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

function relative(days: number): string {
  if (days <= 0) return days < 0 ? "fecha ya pasada" : "HOY";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

/** «Lo necesita: …» para staff; null si el cliente no contestó. */
export function deadlineLine(d: Deadline | null | undefined, now = new Date()): string | null {
  if (!d) return null;
  if (d.urgency === "ASAP") return "Lo necesita: lo antes posible";
  if (d.urgency === "FLEXIBLE") return "Lo necesita: sin prisa";
  if (!d.neededBy) return null;
  const long = d.neededBy.toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `Lo necesita: ${long} (${relative(daysUntil(d.neededBy, now))})`;
}

/** Lo antes posible, o fecha dentro de 3 días naturales (hoy, mañana, +2). */
export function isUrgentDeadline(d: Deadline | null | undefined, now = new Date()): boolean {
  if (!d) return false;
  if (d.urgency === "ASAP") return true;
  return !!d.neededBy && d.urgency !== "FLEXIBLE" && daysUntil(d.neededBy, now) <= URGENT_WITHIN_DAYS;
}

export function urgentSubjectPrefix(d: Deadline | null | undefined, now = new Date()): string {
  if (!isUrgentDeadline(d, now)) return "";
  if (d!.urgency === "ASAP" || !d!.neededBy) return "URGENTE · lo antes posible · ";
  return `URGENTE · lo necesita el ${fmtNeededBy(d!.neededBy).slice(0, 5)} · `;
}

/** Texto para el jurado en lavori (especificaciones); sin PII. */
export function jurorDeadlineNote(d: Deadline | null | undefined): string | null {
  if (!d) return null;
  if (d.urgency === "ASAP") return "El cliente lo necesita lo antes posible.";
  return d.neededBy && d.urgency !== "FLEXIBLE" ? `Fecha límite del cliente: ${fmtNeededBy(d.neededBy)}` : null;
}

/** El de la sesión: el primero que contestó (todas las filas se actualizan a la vez). */
export function deadlineOf<T extends { urgency?: string | null; neededBy?: Date | null }>(rows: T[]): Deadline | null {
  const r = rows.find((x) => x.urgency || x.neededBy);
  return r ? { urgency: r.urgency ?? null, neededBy: r.neededBy ?? null } : null;
}

/** Plazo FR para el builder (regla de Juan, 26-oct-2026): ≤5 págs = 1 día hábil; en el día = +40 %.
 * `term` va al PDF y al email del cliente; `hint` es solo para staff. */
export function frDeliveryPrefill(d: Deadline | null | undefined, pages: number, now = new Date()): { term: string; hint: string | null } | null {
  if (!d) return null;
  if (d.neededBy && d.urgency !== "FLEXIBLE" && daysUntil(d.neededBy, now) <= 0) {
    return { term: "En el día", hint: "Entrega en el día: +40 % sobre el precio normal" };
  }
  if (pages > 5) return null;
  return { term: "1 día hábil", hint: d.urgency === "ASAP" ? "Si lo quiere en el día: +40 % sobre el precio normal" : null };
}
