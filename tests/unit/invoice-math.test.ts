import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidInvoiceNumber,
  isValidDocNumber,
  nextNumberInSeries,
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

test("isValidDocNumber: cada serie rechaza el formato de la otra", () => {
  // Facturas: AA_NNN, sin P.
  assert.ok(isValidDocNumber("26_018", "invoice"));
  assert.ok(!isValidDocNumber("P26_018", "invoice"));
  // Presupuestos: P + AA_NNN, obligatoria la P.
  assert.ok(isValidDocNumber("P26_001", "quote"));
  assert.ok(isValidDocNumber("P26_0012", "quote"));
  assert.ok(!isValidDocNumber("26_001", "quote"));
  assert.ok(!isValidDocNumber("p26_001", "quote"));
  assert.ok(!isValidDocNumber("P26-001", "quote"));
  assert.ok(!isValidDocNumber("P26_01", "quote"));
});

test("nextNumberInSeries: serie de facturas ignora los P y cuenta los quotes históricos sin P", () => {
  const existing = ["26_010", "26_011", "26_045", "P26_003", "25_099", null];
  assert.equal(nextNumberInSeries(existing, "invoice", "26"), "26_046");
});

test("nextNumberInSeries: serie P solo cuenta los P de su año; los históricos sin P no", () => {
  const existing = ["26_011", "26_030", "26_041", "26_045", "P25_007"];
  assert.equal(nextNumberInSeries(existing, "quote", "26"), "P26_001");
  assert.equal(nextNumberInSeries([...existing, "P26_002"], "quote", "26"), "P26_003");
});

test("nextNumberInSeries: series vacías arrancan en 001", () => {
  assert.equal(nextNumberInSeries([], "invoice", "26"), "26_001");
  assert.equal(nextNumberInSeries([], "quote", "26"), "P26_001");
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

// ---- Rectificativas (VeriFactu, 3-sep-2026): negativos solo con allowNegative ----
import { normalizeLines as nl2, computeLineTotals as ct2, rectificationLines } from "../../lib/invoice-math.ts";

test("líneas negativas: prohibidas por defecto, permitidas en rectificativa", () => {
  const lines = [{ description: "Traducción", amountCents: -5000 }];
  assert.equal(nl2(lines)[0].amountCents, 0, "una factura normal recorta la línea negativa a 0 (como antes)");
  assert.equal(nl2(lines, { allowNegative: true })[0].amountCents, -5000);
  assert.deepEqual(ct2(lines, 0.21, { allowNegative: true }), { baseCents: -5000, vatCents: -1050, totalCents: -6050 });
  assert.deepEqual(ct2(lines, 0.21), { baseCents: 0, vatCents: 0, totalCents: 0 });
});

test("rectificationLines niega cada línea de la original y la referencia", () => {
  const r = rectificationLines([{ description: "Acta de nacimiento", amountCents: 4000 }, { description: "Apostilla", detail: "1 pág", amountCents: 1500 }], "26_050");
  assert.equal(r.length, 2);
  assert.equal(r[0].amountCents, -4000);
  assert.match(r[0].description, /^Rectificación de 26_050: Acta de nacimiento/);
  assert.equal(r[1].detail, "1 pág");
  assert.deepEqual(rectificationLines(undefined, "26_050"), []);
});
