// Periodos del Panel: fronteras en hora local Europe/Madrid. Módulo puro (server + client safe).
export const PANEL_TZ = "Europe/Madrid";

export type Granularity = "dia" | "semana" | "mes" | "trimestre" | "anio";
export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "trimestre", label: "Trimestre" },
  { value: "anio", label: "Año" },
];

export type Bucket = { key: string; label: string };

export type Period = {
  p: Granularity;
  anchor: string;
  label: string;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  buckets: Bucket[];
  prevBuckets: Bucket[];
};

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const cal = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

let partsFmt: Intl.DateTimeFormat | null = null;
function fmt() {
  partsFmt ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: PANEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  return partsFmt;
}

export function madridParts(date: Date | string) {
  const o: Record<string, number> = {};
  for (const part of fmt().formatToParts(new Date(date))) {
    if (part.type !== "literal") o[part.type] = Number(part.value);
  }
  return { y: o.year, m: o.month, d: o.day, h: o.hour };
}

function offsetMs(t: number) {
  const p = madridParts(new Date(t));
  return Date.UTC(p.y, p.m - 1, p.d, p.h, 0, 0) - Math.floor(t / 3600e3) * 3600e3;
}

/** Instante UTC de las 00:00 Madrid del día de calendario dado. */
export function madridMidnightUtc(day: Date): Date {
  const t = day.getTime();
  const guess = t - offsetMs(t);
  return new Date(t - offsetMs(guess));
}

export function todayMadrid(now: Date = new Date()): string {
  const p = madridParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function parseYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const d = cal(Number(m[1]), Number(m[2]), Number(m[3]));
  return ymd(d) === s ? d : null;
}

export function parseGranularity(s: string | null | undefined): Granularity {
  return GRANULARITIES.some((g) => g.value === s) ? (s as Granularity) : "mes";
}

function rangeFor(p: Granularity, a: Date): { start: Date; end: Date } {
  const y = a.getUTCFullYear();
  const m = a.getUTCMonth();
  switch (p) {
    case "dia":
      return { start: a, end: cal(y, m + 1, a.getUTCDate() + 1) };
    case "semana": {
      const back = (a.getUTCDay() + 6) % 7;
      const start = cal(y, m + 1, a.getUTCDate() - back);
      return { start, end: cal(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate() + 7) };
    }
    case "mes":
      return { start: cal(y, m + 1, 1), end: cal(y, m + 2, 1) };
    case "trimestre": {
      const q = Math.floor(m / 3) * 3;
      return { start: cal(y, q + 1, 1), end: cal(y, q + 4, 1) };
    }
    case "anio":
      return { start: cal(y, 1, 1), end: cal(y + 1, 1, 1) };
  }
}

export function shiftAnchor(p: Granularity, anchor: string, dir: 1 | -1): string {
  const a = parseYmd(anchor) ?? cal(1970, 1, 1);
  const { start } = rangeFor(p, a);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + 1;
  const d = start.getUTCDate();
  switch (p) {
    case "dia":
      return ymd(cal(y, m, d + dir));
    case "semana":
      return ymd(cal(y, m, d + 7 * dir));
    case "mes":
      return ymd(cal(y, m + dir, 1));
    case "trimestre":
      return ymd(cal(y, m + 3 * dir, 1));
    case "anio":
      return ymd(cal(y + dir, 1, 1));
  }
}

function bucketsFor(p: Granularity, start: Date, end: Date): Bucket[] {
  const out: Bucket[] = [];
  if (p === "dia") {
    for (let h = 0; h < 24; h++) out.push({ key: `${ymd(start)} ${pad(h)}`, label: `${pad(h)}h` });
    return out;
  }
  if (p === "trimestre" || p === "anio") {
    for (let c = start; c < end; c = cal(c.getUTCFullYear(), c.getUTCMonth() + 2, 1)) {
      out.push({ key: ymd(c).slice(0, 7), label: MONTHS_SHORT[c.getUTCMonth()] });
    }
    return out;
  }
  for (let c = start; c < end; c = cal(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate() + 1)) {
    out.push({
      key: ymd(c),
      label: p === "semana" ? `${DAYS_SHORT[c.getUTCDay()]} ${c.getUTCDate()}` : String(c.getUTCDate()),
    });
  }
  return out;
}

export function bucketKey(p: Granularity, date: Date | string): string {
  const { y, m, d, h } = madridParts(date);
  if (p === "dia") return `${y}-${pad(m)}-${pad(d)} ${pad(h)}`;
  if (p === "trimestre" || p === "anio") return `${y}-${pad(m)}`;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function labelFor(p: Granularity, start: Date): string {
  const y = start.getUTCFullYear();
  const d = start.getUTCDate();
  const mon = start.getUTCMonth();
  switch (p) {
    case "dia":
      return `${DAYS_SHORT[start.getUTCDay()]} ${d} ${MONTHS_SHORT[mon]} ${y}`;
    case "semana": {
      const last = cal(y, mon + 1, d + 6);
      return `${d} ${MONTHS_SHORT[mon]} – ${last.getUTCDate()} ${MONTHS_SHORT[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
    }
    case "mes":
      return `${MONTHS_LONG[mon]} ${y}`;
    case "trimestre":
      return `T${Math.floor(mon / 3) + 1} ${y}`;
    case "anio":
      return String(y);
  }
}

export function buildPeriod(p: Granularity, anchorInput: string | null | undefined, now: Date = new Date()): Period {
  const anchor = parseYmd(anchorInput) ? (anchorInput as string) : todayMadrid(now);
  const cur = rangeFor(p, parseYmd(anchor)!);
  const prev = rangeFor(p, parseYmd(shiftAnchor(p, anchor, -1))!);
  return {
    p,
    anchor,
    label: labelFor(p, cur.start),
    start: madridMidnightUtc(cur.start).toISOString(),
    end: madridMidnightUtc(cur.end).toISOString(),
    prevStart: madridMidnightUtc(prev.start).toISOString(),
    prevEnd: madridMidnightUtc(prev.end).toISOString(),
    buckets: bucketsFor(p, cur.start, cur.end),
    prevBuckets: bucketsFor(p, prev.start, prev.end),
  };
}
