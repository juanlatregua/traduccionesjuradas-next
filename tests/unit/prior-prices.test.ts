import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLabel,
  labelOfDescription,
  labelsMatch,
  pickPriorMatches,
  isAutoApplicablePrior,
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
  assert.ok(!labelsMatch("certificado", "certificado de nacimiento"));
  assert.ok(!labelsMatch("apostilla", "registro mercantil con apostilla"));
  assert.ok(!labelsMatch("poder notarial", "revision poder notarial"));
});

test("misma línea repetida en un presupuesto ocupa un solo hueco", () => {
  const lines = [
    line("Certificado de acciones", { quoteNumber: "A", issuedMs: 3 }),
    line("Certificado de acciones", { quoteNumber: "A", issuedMs: 3 }),
    line("Certificado de acciones", { quoteNumber: "B", issuedMs: 2 }),
  ];
  assert.deepEqual(pickPriorMatches(lines, "Certificado de acciones").map((m) => m.quoteNumber), ["A", "B"]);
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

test("los precios propios del cliente van antes aunque sean más viejos y sin pagar", () => {
  const r = pickPriorMatches(
    [
      line("Certificado de acciones", { quoteNumber: "A", unitPrice: 40, paid: true }),
      line("Certificado de acciones", { quoteNumber: "B", unitPrice: 35, own: true, issuedMs: 1 }),
    ],
    "Certificado de acciones"
  );
  assert.equal(r[0].quoteNumber, "B");
  assert.equal(r[0].own, true);
  assert.equal(r[1].own, undefined);
});

test("etiqueta sin titular, mes ni apostilla (líneas a mano del 00322)", () => {
  assert.equal(labelOfDescription("NFS-e Contabilidade agosto 2026 — Quintão Machado Advocacia (Portugués→Español)"), "nfs e contabilidade agosto 2026");
  assert.equal(labelOfDescription("Diploma de Mestrado — Sarah Quintão con apostilla (Portugués→Español)"), "diploma de mestrado");
  assert.equal(labelOfDescription("Certificado de antecedentes penales con apostilla"), "certificado de antecedentes penales");
});

test("casa por tipo de documento aunque la etiqueta sea otra; pagado del cliente primero", () => {
  const base = { supplierUnitCost: 25, issuedAt: "2026-10-29", status: "PAID", translatorName: null, paid: true };
  const lines = [
    { ...base, description: "NFS-e (Portugués→Español)", unitPrice: 90, quoteNumber: "X", issuedMs: 3, docKind: "service_invoice", own: false, paid: false },
    { ...base, description: "NFS-e Contabilidade agosto 2026 — Quintão (Portugués→Español)", unitPrice: 38, quoteNumber: "00322", issuedMs: 1, docKind: "service_invoice", own: true },
  ];
  const r = pickPriorMatches(lines as any, "Nota fiscal de servicios electrónica", "service_invoice");
  assert.equal(r[0].quoteNumber, "00322");
  assert.equal(r[0].paid, true);
  assert.equal(r[0].own, true);
  assert.equal(pickPriorMatches(lines as any, "Nota fiscal de servicios electrónica", null).length, 0);
});

test("tipos comodín no casan por docKind", () => {
  const l = { description: "Carta de banco", unitPrice: 38, supplierUnitCost: 25, quoteNumber: "Q", issuedAt: "2026-10-01", issuedMs: 1, status: "PAID", translatorName: null, paid: true, docKind: "other" };
  assert.equal(pickPriorMatches([l] as any, "Certificado de nacimiento", "other").length, 0);
});

test("solo se aplica solo: mismo cliente, pagado, con coste, 1 unidad y mismo tamaño", () => {
  const m = { unitPrice: 38, supplierUnitCost: 25, quoteNumber: "00322", issuedAt: "", status: "PAID", translatorName: null, own: true, paid: true, quantity: 1, pages: 1 };
  assert.equal(isAutoApplicablePrior(m, 1), true);
  assert.equal(isAutoApplicablePrior(m, 12), false);
  assert.equal(isAutoApplicablePrior({ ...m, supplierUnitCost: null }, 1), false);
  assert.equal(isAutoApplicablePrior({ ...m, quantity: 5 }, 1), false);
  assert.equal(isAutoApplicablePrior({ ...m, own: false }, 1), false);
  assert.equal(isAutoApplicablePrior({ ...m, pages: null }, 2), true);
  assert.equal(isAutoApplicablePrior({ ...m, pages: null }, 4), false);
});
