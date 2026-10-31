import test from "node:test";
import assert from "node:assert/strict";
import { resumenPanelContable, type PanelExpense } from "../../lib/panel-contable.ts";

const now = new Date("2026-10-31T10:00:00Z");
const gasto = (over: Partial<PanelExpense>): PanelExpense => ({
  date: new Date("2026-10-10T10:00:00Z"),
  baseCents: 10000,
  vatCents: 2100,
  ivaDeducible: true,
  taxTreatment: "general",
  needsReview: false,
  irpfCents: 0,
  ...over,
});

test("mes y trimestre con hora de Madrid", () => {
  const r = resumenPanelContable({
    invoices: [
      { issuedAt: new Date("2026-09-30T22:30:00Z"), baseCents: 100000, vatCents: 21000 }, // 1-oct 00:30 en Madrid
      { issuedAt: new Date("2026-09-30T21:30:00Z"), baseCents: 50000, vatCents: 10500 }, // 30-sep en Madrid
    ],
    expenses: [],
    devengos: [],
    cobrosSinFactura: [],
    now,
  });
  assert.equal(r.ingresosMesCents, 100000);
  assert.equal(r.ivaTrimestreCents, 21000);
});

test("el resultado resta gastos y traductores sin factura", () => {
  const r = resumenPanelContable({
    invoices: [{ issuedAt: new Date("2026-10-02T10:00:00Z"), baseCents: 100000, vatCents: 21000 }],
    expenses: [gasto({ irpfCents: 1500 })],
    devengos: [{ date: new Date("2026-10-20T10:00:00Z"), baseCents: 4000 }, { date: new Date("2026-09-20T10:00:00Z"), baseCents: 9000 }],
    cobrosSinFactura: [{ date: new Date("2026-10-05T10:00:00Z"), baseCents: 2000 }],
    now,
  });
  assert.equal(r.resultadoMesCents, 100000 + 2000 - 10000 - 4000);
  assert.equal(r.ivaTrimestreCents, 21000 - 2100);
  assert.equal(r.retencionesTrimestreCents, 1500);
  assert.equal(r.reservasCents, 21000 - 2100 + 1500);
});

test("un gasto por revisar no cuenta y queda señalado", () => {
  const r = resumenPanelContable({ invoices: [], expenses: [gasto({ needsReview: true })], devengos: [], cobrosSinFactura: [], now });
  assert.equal(r.gastosMesCents, 0);
  assert.equal(r.gastosSinCompletar, 1);
});

test("las facturas de traductor no cuentan como gasto sin completar", () => {
  const r = resumenPanelContable({ invoices: [], expenses: [gasto({ needsReview: true, concept: "Factura del sobre lavori — encargo x (pedido 26_1)" })], devengos: [], cobrosSinFactura: [], now });
  assert.equal(r.gastosSinCompletar, 0);
});

test("IVA a compensar no se reserva en negativo", () => {
  const r = resumenPanelContable({ invoices: [], expenses: [gasto({})], devengos: [], cobrosSinFactura: [], now });
  assert.equal(r.ivaTrimestreCents, 0);
});

test("el IVA cubre el trimestre entero, como el borrador", () => {
  const r = resumenPanelContable({
    invoices: [{ issuedAt: new Date("2026-11-05T10:00:00Z"), baseCents: 10000, vatCents: 2100 }],
    expenses: [],
    devengos: [],
    cobrosSinFactura: [],
    now,
  });
  assert.equal(r.ivaTrimestreCents, 2100);
  assert.equal(r.ingresosMesCents, 0);
});
