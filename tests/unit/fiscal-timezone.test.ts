import { test } from "node:test";
import assert from "node:assert/strict";
import { madridParts, madridStartOfMonthUtc, quarterOf } from "../../lib/period-grouping.ts";
import { parseFiscalPeriod } from "../../lib/fiscal-period.ts";

// El trimestre fiscal español se devenga en hora LOCAL (Europe/Madrid), no UTC.
// Estas pruebas fijan ese criterio en las tres superficies que antes usaban
// relojes distintos: Contabilidad (vía madridParts), Periodos (idem) y los
// exports/zip de gestoría (vía parseFiscalPeriod).

test("madridStartOfMonthUtc: T2 empieza el 1-abr 00:00 Madrid = 31-mar 22:00 UTC (CEST +2)", () => {
  assert.equal(madridStartOfMonthUtc(2026, 4).toISOString(), "2026-03-31T22:00:00.000Z");
});

test("madridStartOfMonthUtc: T1 empieza el 1-ene 00:00 Madrid = 31-dic 23:00 UTC (CET +1)", () => {
  assert.equal(madridStartOfMonthUtc(2026, 1).toISOString(), "2025-12-31T23:00:00.000Z");
});

test("madridStartOfMonthUtc: T3 empieza el 1-jul 00:00 Madrid = 30-jun 22:00 UTC (CEST +2)", () => {
  assert.equal(madridStartOfMonthUtc(2026, 7).toISOString(), "2026-06-30T22:00:00.000Z");
});

test("madridStartOfMonthUtc: mes 13 = enero siguiente, cierra T4 y el año", () => {
  assert.equal(madridStartOfMonthUtc(2026, 13).toISOString(), "2026-12-31T23:00:00.000Z");
});

test("el caso que rompía: factura del 1-jul 00:30 Madrid es T3, no T2", () => {
  // 2026-06-30T22:30Z = 1-jul 00:30 en Madrid (CEST). En UTC parecía junio (T2).
  const issuedAt = new Date("2026-06-30T22:30:00.000Z");
  const { year, month } = madridParts(issuedAt);
  assert.equal(year, 2026);
  assert.equal(month, 7, "en Madrid es julio");
  assert.equal(quarterOf(month), 3, "por tanto T3");
  assert.notEqual(issuedAt.getUTCMonth() + 1, month, "en UTC caía en el mes anterior: ese era el bug");
});

test("parseFiscalPeriod(T3) incluye la factura del 1-jul 00:30 Madrid", () => {
  const p = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=3"));
  assert.ok(p, "periodo parseado");
  const issuedAt = new Date("2026-06-30T22:30:00.000Z"); // 1-jul 00:30 Madrid
  assert.ok(issuedAt >= p!.gte && issuedAt < p!.lt, "cae dentro de T3 en el zip de gestoría");
  assert.equal(p!.tag, "2026-T3");
});

test("parseFiscalPeriod(T2) NO incluye la factura del 1-jul 00:30 Madrid", () => {
  const p = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=2"));
  assert.ok(p);
  const issuedAt = new Date("2026-06-30T22:30:00.000Z");
  assert.ok(!(issuedAt >= p!.gte && issuedAt < p!.lt), "ya no se cuela en T2");
});

test("parseFiscalPeriod(T2) SÍ incluye la última factura real del trimestre (30-jun 23:00 Madrid)", () => {
  const p = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=2"));
  assert.ok(p);
  const issuedAt = new Date("2026-06-30T21:00:00.000Z"); // 30-jun 23:00 Madrid
  assert.ok(issuedAt >= p!.gte && issuedAt < p!.lt);
});

test("los trimestres son contiguos y no solapan: el lt de T2 es el gte de T3", () => {
  const t2 = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=2"))!;
  const t3 = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=3"))!;
  assert.equal(t2.lt.toISOString(), t3.gte.toISOString(), "sin huecos ni solapes entre trimestres");
});

test("el año completo cubre exactamente T1..T4", () => {
  const year = parseFiscalPeriod(new URL("https://x.test/?year=2026"))!;
  const t1 = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=1"))!;
  const t4 = parseFiscalPeriod(new URL("https://x.test/?year=2026&q=4"))!;
  assert.equal(year.gte.toISOString(), t1.gte.toISOString());
  assert.equal(year.lt.toISOString(), t4.lt.toISOString());
});

test("periodo mensual: julio empieza en medianoche de Madrid", () => {
  const p = parseFiscalPeriod(new URL("https://x.test/?year=2026&m=7"))!;
  assert.equal(p.gte.toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(p.lt.toISOString(), "2026-07-31T22:00:00.000Z");
  assert.equal(p.tag, "2026-07");
});
