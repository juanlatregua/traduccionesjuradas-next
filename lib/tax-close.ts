// lib/tax-close.ts — Helpers PUROS del cierre de trimestre de IVA (TaxPeriodClose).
// period = "YYYY-TN" (N = 1..4). El "fin" de un periodo cerrado es el primer día
// (UTC) del trimestre siguiente: primera fecha en la que se puede volver a facturar.

const TAX_PERIOD_RE = /^(\d{4})-T([1-4])$/;

export function parseTaxPeriod(period: string): { year: number; quarter: number } | null {
  const m = TAX_PERIOD_RE.exec(period);
  if (!m) return null;
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

// "2026-T2" → 2026-07-01T00:00:00Z (primer día del trimestre siguiente, UTC).
export function taxPeriodCloseDate(period: string): Date | null {
  const p = parseTaxPeriod(period);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.quarter * 3, 1));
}

// Solo se puede cerrar un trimestre YA terminado (su fin no está en el futuro):
// el 303 se presenta después de acabar el trimestre.
export function isClosableTaxPeriod(period: string, now: Date = new Date()): boolean {
  const end = taxPeriodCloseDate(period);
  return !!end && end.getTime() <= now.getTime();
}
