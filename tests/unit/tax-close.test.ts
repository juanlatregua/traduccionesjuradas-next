import test from "node:test";
import assert from "node:assert/strict";
import { parseTaxPeriod, taxPeriodCloseDate, isClosableTaxPeriod } from "../../lib/tax-close.ts";

test("parseTaxPeriod: acepta YYYY-TN válidos", () => {
  assert.deepEqual(parseTaxPeriod("2026-T2"), { year: 2026, quarter: 2 });
  assert.deepEqual(parseTaxPeriod("2025-T4"), { year: 2025, quarter: 4 });
  assert.deepEqual(parseTaxPeriod("2026-T1"), { year: 2026, quarter: 1 });
});

test("parseTaxPeriod: rechaza formatos inválidos", () => {
  assert.equal(parseTaxPeriod("2026-T5"), null);
  assert.equal(parseTaxPeriod("2026-T0"), null);
  assert.equal(parseTaxPeriod("2026-2"), null);
  assert.equal(parseTaxPeriod("2026-t2"), null);
  assert.equal(parseTaxPeriod("26-T2"), null);
  assert.equal(parseTaxPeriod("2026-T2 "), null);
  assert.equal(parseTaxPeriod(""), null);
});

test("taxPeriodCloseDate: primer día UTC del trimestre siguiente", () => {
  assert.equal(taxPeriodCloseDate("2026-T1")?.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(taxPeriodCloseDate("2026-T2")?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(taxPeriodCloseDate("2026-T3")?.toISOString(), "2026-10-01T00:00:00.000Z");
  // T4 → primer día del año siguiente
  assert.equal(taxPeriodCloseDate("2026-T4")?.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(taxPeriodCloseDate("garbage"), null);
});

test("isClosableTaxPeriod: solo trimestres ya terminados", () => {
  const now = new Date("2026-07-14T10:00:00.000Z");
  assert.equal(isClosableTaxPeriod("2026-T1", now), true);
  assert.equal(isClosableTaxPeriod("2026-T2", now), true); // terminó el 1-jul
  assert.equal(isClosableTaxPeriod("2026-T3", now), false); // en curso
  assert.equal(isClosableTaxPeriod("2026-T4", now), false); // futuro
  assert.equal(isClosableTaxPeriod("2027-T1", now), false);
  assert.equal(isClosableTaxPeriod("no-valido", now), false);
});

test("isClosableTaxPeriod: el límite exacto (fin del trimestre) ya es cerrable", () => {
  const boundary = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(isClosableTaxPeriod("2026-T2", boundary), true);
  assert.equal(isClosableTaxPeriod("2026-T3", boundary), false);
});
