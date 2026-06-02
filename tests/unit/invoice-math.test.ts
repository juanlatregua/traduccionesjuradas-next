import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidInvoiceNumber,
  clampVatRate,
  normalizeLines,
  computeLineTotals,
  totalsFromGross,
} from "../../lib/invoice-math.ts";

test("isValidInvoiceNumber acepta AA_NNN y rechaza el resto", () => {
  assert.ok(isValidInvoiceNumber("26_018"));
  assert.ok(isValidInvoiceNumber("26_0001"));
  assert.ok(!isValidInvoiceNumber("FAC-2026-001"));
  assert.ok(!isValidInvoiceNumber("26-018"));
  assert.ok(!isValidInvoiceNumber("2026_18"));
});

test("clampVatRate normaliza fracción, porcentaje y basura", () => {
  assert.equal(clampVatRate(0.21), 0.21);
  assert.equal(clampVatRate(21), 0.21); // porcentaje → fracción
  assert.equal(clampVatRate(0), 0); // exento
  assert.equal(clampVatRate(null), 0.21); // por defecto
  assert.equal(clampVatRate("abc"), 0.21);
  assert.equal(clampVatRate(-5), 0.21);
});

test("normalizeLines limpia y descarta líneas vacías", () => {
  const lines = normalizeLines([
    { description: "  Partida nacimiento ", detail: " 320 palabras ", amountCents: 2500.4 },
    { description: "", amountCents: 0 }, // vacía → fuera
    { description: "Apostilla", amountCents: -100 }, // negativo → 0 pero con descripción se queda
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].description, "Partida nacimiento");
  assert.equal(lines[0].detail, "320 palabras");
  assert.equal(lines[0].amountCents, 2500);
  assert.equal(lines[1].amountCents, 0);
});

test("computeLineTotals: líneas en base → suma base + IVA", () => {
  const t = computeLineTotals([{ description: "a", amountCents: 2500 }, { description: "b", amountCents: 1500 }], 0.21);
  assert.equal(t.baseCents, 4000);
  assert.equal(t.vatCents, 840);
  assert.equal(t.totalCents, 4840);
});

test("computeLineTotals con IVA 0 (exento) → total = base", () => {
  const t = computeLineTotals([{ description: "a", amountCents: 5000 }], 0);
  assert.equal(t.baseCents, 5000);
  assert.equal(t.vatCents, 0);
  assert.equal(t.totalCents, 5000);
});

test("totalsFromGross: desde total CON IVA saca base e IVA", () => {
  const t = totalsFromGross(3025, 0.21);
  assert.equal(t.baseCents, 2500);
  assert.equal(t.vatCents, 525);
  assert.equal(t.totalCents, 3025);
});
