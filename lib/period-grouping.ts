// Agrupación temporal AÑO → TRIMESTRE → MES para la zona traductor.
// Trimestres naturales (T1 ene–mar … T4 oct–dic), zona horaria Europe/Madrid,
// locale es-ES. Módulo puro: sin Prisma ni dependencias (server + client safe).
// Lo consume /zona-traductor/periodos para contabilidad (ingresos), presupuestos
// y pedidos: una vista resumen con totales por trimestre/mes + drill-down.

export const MADRID_TZ = "Europe/Madrid";

export const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Rango natural de cada trimestre (T1..T4) para etiquetas.
const Q_RANGE_ES = ["ene–mar", "abr–jun", "jul–sep", "oct–dic"];

export type PeriodItem = {
  date: Date | string | null | undefined;
  amountCents: number;
  // Estado opcional (workflow, pago, estado de presupuesto…) para el desglose.
  state?: string | null;
};

export type StateTotals = Record<string, { count: number; totalCents: number }>;

export type MonthBucket = {
  kind: "month";
  key: string; // "2026-05"
  label: string; // "Mayo"
  year: number;
  month: number; // 1-12
  count: number;
  totalCents: number;
  byState: StateTotals;
};

export type QuarterBucket = {
  kind: "quarter";
  key: string; // "2026-Q2"
  label: string; // "T2 (abr–jun)"
  year: number;
  quarter: number; // 1-4
  count: number;
  totalCents: number;
  byState: StateTotals;
  months: MonthBucket[]; // siempre los 3 meses del trimestre, en orden natural
};

export type YearBucket = {
  kind: "year";
  key: string; // "2026"
  label: string; // "2026"
  year: number;
  count: number;
  totalCents: number;
  byState: StateTotals;
  quarters: QuarterBucket[]; // siempre los 4 trimestres, en orden natural
};

export type ParsedPeriod = { year: number; quarter?: number; month?: number };

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Año y mes (1-12) de una fecha en la zona horaria Europe/Madrid (DST-safe). */
export function madridParts(date: Date): { year: number; month: number } {
  // en-CA → "YYYY-MM-DD" estable y fácil de parsear.
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m] = s.split("-");
  return { year: Number(y), month: Number(m) };
}

export function quarterOf(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function quarterKey(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

export function monthLabel(month: number): string {
  return MONTHS_ES[month - 1] ?? String(month);
}

export function quarterLabel(quarter: number): string {
  return `T${quarter} (${Q_RANGE_ES[quarter - 1] ?? ""})`;
}

function addToState(target: StateTotals, state: string | null | undefined, amountCents: number) {
  const key = (state ?? "").trim();
  if (!key) return;
  const cur = target[key] || { count: 0, totalCents: 0 };
  cur.count += 1;
  cur.totalCents += amountCents;
  target[key] = cur;
}

/**
 * Agrupa una lista de elementos (fecha + importe + estado) en árbol
 * AÑO → TRIMESTRE → MES. Solo se materializan los años con datos; dentro de cada
 * año se incluyen SIEMPRE los 4 trimestres y los 12 meses (aunque vacíos) para
 * que el resumen sea consistente. Orden de años: descendente (más reciente primero).
 */
export function groupByPeriod(items: PeriodItem[]): YearBucket[] {
  type MonthAcc = { count: number; totalCents: number; byState: StateTotals };
  const byYear = new Map<number, Map<number, MonthAcc>>(); // year → (month 1-12 → acc)

  for (const item of items) {
    const d = toDate(item.date);
    if (!d) continue;
    const { year, month } = madridParts(d);
    let months = byYear.get(year);
    if (!months) {
      months = new Map();
      byYear.set(year, months);
    }
    const acc = months.get(month) || { count: 0, totalCents: 0, byState: {} };
    acc.count += 1;
    acc.totalCents += item.amountCents;
    addToState(acc.byState, item.state, item.amountCents);
    months.set(month, acc);
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return years.map((year) => {
    const monthsAcc = byYear.get(year)!;
    const quarters: QuarterBucket[] = [];
    let yCount = 0;
    let yTotal = 0;
    const yState: StateTotals = {};

    for (let q = 1; q <= 4; q++) {
      const monthBuckets: MonthBucket[] = [];
      let qCount = 0;
      let qTotal = 0;
      const qState: StateTotals = {};

      for (const month of [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3]) {
        const acc = monthsAcc.get(month) || { count: 0, totalCents: 0, byState: {} as StateTotals };
        monthBuckets.push({
          kind: "month",
          key: monthKey(year, month),
          label: monthLabel(month),
          year,
          month,
          count: acc.count,
          totalCents: acc.totalCents,
          byState: acc.byState,
        });
        qCount += acc.count;
        qTotal += acc.totalCents;
        for (const [s, v] of Object.entries(acc.byState)) {
          const cur = qState[s] || { count: 0, totalCents: 0 };
          cur.count += v.count;
          cur.totalCents += v.totalCents;
          qState[s] = cur;
        }
      }

      quarters.push({
        kind: "quarter",
        key: quarterKey(year, q),
        label: quarterLabel(q),
        year,
        quarter: q,
        count: qCount,
        totalCents: qTotal,
        byState: qState,
        months: monthBuckets,
      });
      yCount += qCount;
      yTotal += qTotal;
      for (const [s, v] of Object.entries(qState)) {
        const cur = yState[s] || { count: 0, totalCents: 0 };
        cur.count += v.count;
        cur.totalCents += v.totalCents;
        yState[s] = cur;
      }
    }

    return {
      kind: "year",
      key: String(year),
      label: String(year),
      year,
      count: yCount,
      totalCents: yTotal,
      byState: yState,
      quarters,
    };
  });
}

/** Años con datos, descendente. Útil para el selector de año. */
export function availableYears(items: PeriodItem[]): number[] {
  const ys = new Set<number>();
  for (const item of items) {
    const d = toDate(item.date);
    if (d) ys.add(madridParts(d).year);
  }
  return Array.from(ys).sort((a, b) => b - a);
}

/** Parsea una clave de periodo: "2026" | "2026-Q2" | "2026-05". */
export function parsePeriodKey(raw?: string | null): ParsedPeriod | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  let m = value.match(/^(\d{4})$/);
  if (m) return { year: Number(m[1]) };
  m = value.match(/^(\d{4})-Q([1-4])$/i);
  if (m) return { year: Number(m[1]), quarter: Number(m[2]) };
  m = value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  return null;
}

/** ¿Cae la fecha dentro del periodo parseado? (Europe/Madrid). */
export function matchesPeriod(date: Date | string | null | undefined, parsed: ParsedPeriod): boolean {
  const d = toDate(date);
  if (!d) return false;
  const { year, month } = madridParts(d);
  if (year !== parsed.year) return false;
  if (parsed.month != null) return month === parsed.month;
  if (parsed.quarter != null) return quarterOf(month) === parsed.quarter;
  return true;
}

/** Etiqueta humana de un periodo: "Mayo 2026" | "T2 2026 (abr–jun)" | "Año 2026". */
export function formatPeriodLabel(parsed: ParsedPeriod): string {
  if (parsed.month != null) return `${monthLabel(parsed.month)} ${parsed.year}`;
  if (parsed.quarter != null) return `T${parsed.quarter} ${parsed.year} (${Q_RANGE_ES[parsed.quarter - 1] ?? ""})`;
  return `Año ${parsed.year}`;
}

export function formatEurCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}
