import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLabel,
  labelOfDescription,
  labelsMatch,
  pickPriorMatches,
  type PriorLine,
} from "../../lib/prior-prices-match.ts";

const line = (description: string, o: Partial<PriorLine> = {}): PriorLine => ({
  description,
  unitPrice: 30,
  supplierUnitCost: 17.5,
  quoteNumber: "2026-00136",
  issuedAt: "2026-09-10T10:00:00.000Z",
  issuedMs: Date.parse("2026-09-10T10:00:00.000Z"),
  status: "SENT",
  translatorName: null,
  paid: false,
  ...o,
});

test("normaliza acentos, mayúsculas y signos", () => {
  assert.equal(normalizeLabel("  Certificado de ACCIONES "), "certificado de acciones");
  assert.equal(normalizeLabel("Registro de socios / accionistas"), "registro de socios accionistas");
  assert.equal(normalizeLabel("Carta de suscripción"), "carta de suscripcion");
});

test("la etiqueta es lo anterior a ' ('", () => {
  assert.equal(labelOfDescription("Certificado de acciones (EN → ES) 3 págs"), "certificado de acciones");
  assert.equal(labelOfDescription("Certificado de acciones"), "certificado de acciones");
});

test("coincidencia exacta y difusa (mín. 8 caracteres)", () => {
  assert.ok(labelsMatch("certificado de acciones", "certificado de acciones"));
  assert.ok(labelsMatch("carta de suscripcion", "carta de suscripcion de acciones"));
  assert.ok(!labelsMatch("acta", "acta de nacimiento"));
  assert.ok(!labelsMatch("", "acta de nacimiento"));
});

test("prefiere pagados y luego los más recientes, máximo 3", () => {
  const lines = [
    line("Certificado de acciones", { quoteNumber: "A", issuedMs: 3 }),
    line("Certificado de acciones (EN)", { quoteNumber: "B", issuedMs: 1, paid: true, status: "PAID" }),
    line("Certificado de acciones", { quoteNumber: "C", issuedMs: 2 }),
    line("Certificado de acciones", { quoteNumber: "D", issuedMs: 4 }),
    line("Otro documento distinto", { quoteNumber: "X" }),
  ];
  const r = pickPriorMatches(lines, "certificado de Acciones");
  assert.deepEqual(r.map((m) => m.quoteNumber), ["B", "D", "A"]);
});
