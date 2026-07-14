// lib/fiscal-period.ts — Parseo ÚNICO del periodo contable ?year&q&m → rango UTC.
// Compartido por los exports CSV y el paquete gestoría: los límites de trimestre
// deben ser idénticos en las tres rutas o los CSVs del zip divergen de los sueltos.

export type FiscalPeriod = {
  gte: Date;
  lt: Date;
  tag: string; // "2026-T2" | "2026-07" | "2026"
  label: string; // "2026 · T2"
};

export function parseFiscalPeriod(url: URL): FiscalPeriod | null {
  const year = url.searchParams.get("year");
  if (!year || !/^\d{4}$/.test(year)) return null;
  const y = Number(year);
  const q = url.searchParams.get("q");
  const m = url.searchParams.get("m");
  let startMonth = 0;
  let endMonth = 12;
  let tag = year;
  let label = year;
  if (q && /^[1-4]$/.test(q)) {
    startMonth = (Number(q) - 1) * 3;
    endMonth = startMonth + 3;
    tag = `${year}-T${q}`;
    label = `${year} · T${q}`;
  } else if (m && /^([1-9]|1[0-2])$/.test(m)) {
    startMonth = Number(m) - 1;
    endMonth = startMonth + 1;
    const mm = String(Number(m)).padStart(2, "0");
    tag = `${year}-${mm}`;
    label = `${year} · mes ${mm}`;
  }
  return { gte: new Date(Date.UTC(y, startMonth, 1)), lt: new Date(Date.UTC(y, endMonth, 1)), tag, label };
}
