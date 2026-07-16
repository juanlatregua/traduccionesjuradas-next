// lib/fiscal-period.ts — Parseo ÚNICO del periodo contable ?year&q&m → rango.
// Compartido por los exports CSV y el paquete gestoría: los límites de trimestre
// deben ser idénticos en las tres rutas o los CSVs del zip divergen de los sueltos.
//
// Los límites son instantes UTC, pero corresponden a MEDIANOCHE DE MADRID, que
// es el devengo fiscal real. Antes se construían con Date.UTC() → el trimestre
// empezaba 1-2 h tarde en hora local y una factura emitida el 1-jul 00:30 Madrid
// se escapaba del T3 en el zip de la gestoría. Misma fuente de verdad que la
// pantalla de Contabilidad y la de Periodos (lib/period-grouping).

// Import relativo (no alias @/): este módulo es puro y debe poder ejecutarse en
// el runner de tests y viajar fuera de Next — igual que el resto del núcleo fiscal.
import { madridStartOfMonthUtc } from "./period-grouping.ts";

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
  // startMonth/endMonth son 0-11; madridStartOfMonthUtc espera 1-12 (y admite
  // 13 = enero del año siguiente, que es como se cierra T4 / el año completo).
  return {
    gte: madridStartOfMonthUtc(y, startMonth + 1),
    lt: madridStartOfMonthUtc(y, endMonth + 1),
    tag,
    label,
  };
}
