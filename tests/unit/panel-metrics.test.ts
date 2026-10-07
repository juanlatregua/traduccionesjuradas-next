import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  computeTotals,
  dimensionsFor,
  isTestTitle,
  netCents,
  OWN_LABEL,
  type ExpenseRow,
  type OrderRow,
  type PanelData,
  type QuoteRow,
} from "../../lib/panel-metrics.ts";
import { buildPeriod, shiftAnchor } from "../../lib/panel-period.ts";

const order = (o: Partial<OrderRow> = {}): OrderRow => ({
  paidAt: "2026-10-05T10:00:00.000Z",
  amountCents: 12100,
  invoiceBaseCents: null,
  supplierCostCents: null,
  langPair: "fr>es",
  assignedTo: null,
  client: "Ana",
  paymentMethod: "STRIPE",
  ...o,
});
const quote = (q: Partial<QuoteRow> = {}): QuoteRow => ({
  id: "q",
  issuedAt: "2026-10-05T10:00:00.000Z",
  status: "SENT",
  total: 100,
  sourceLang: "fr",
  targetLang: "es",
  lostReason: null,
  ...q,
});
const data = (d: Partial<PanelData>): PanelData => ({ orders: [], quotes: [], requests: [], expenses: [], ...d });
const period = buildPeriod("mes", "2026-10-15");
const total = (d: PanelData, metric: Parameters<typeof computeTotals>[1]) => computeTotals(d, metric);

test("neto: prefiere la base de la factura; si no, bruto / 1,21", () => {
  assert.equal(netCents(order({ amountCents: 12100 })), 10000);
  assert.equal(netCents(order({ amountCents: 12100, invoiceBaseCents: 9500 })), 9500);
  const d = data({ orders: [order(), order({ invoiceBaseCents: 9500 })] });
  assert.equal(total(d, "ingresos_brutos"), 242);
  assert.equal(total(d, "ingresos_netos"), 195);
});

test("par de la casa: coste 0 y traductor «Juan (propio)»; con asignado, su nombre y su coste", () => {
  const d = data({
    orders: [order(), order({ langPair: "en>es", assignedTo: "Daniel", supplierCostCents: 3000 }), order({ langPair: "ru>es" })],
  });
  assert.equal(total(d, "coste_traductores"), 30);
  const rows = aggregate(d, { metric: "pedidos", dimension: "traductor", period });
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.label, r.value])), { [OWN_LABEL]: 1, Daniel: 1, "Sin asignar": 1 });
  assert.equal(total(d, "margen_eur"), 300 - 30);
  assert.equal(total(data({ orders: [order()] }), "margen_pct"), 100);
});

test("Bizum entra en los ingresos y se separa por vía de pago", () => {
  const d = data({ orders: [order(), order({ paymentMethod: "BIZUM", amountCents: 6050 })] });
  assert.equal(total(d, "ingresos_netos"), 150);
  assert.equal(total(d, "bizum_eur"), 50);
  const rows = aggregate(d, { metric: "ingresos_netos", dimension: "via_pago", period });
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.label, r.value])), { "Tarjeta (Stripe)": 100, Bizum: 50 });
});

test("presupuestos: enviados, pagados, perdidos y conversión", () => {
  const d = data({
    quotes: [
      quote({ status: "DRAFT" }),
      quote({ status: "SENT" }),
      quote({ status: "PAID" }),
      quote({ status: "PAID" }),
      quote({ status: "EXPIRED" }),
      quote({ status: "OPENED", lostReason: "PRICE" }),
    ],
  });
  assert.equal(total(d, "presupuestos_enviados"), 5);
  assert.equal(total(d, "presupuestos_pagados"), 2);
  assert.equal(total(d, "presupuestos_perdidos"), 2);
  assert.equal(total(d, "conversion_pct"), 50);
  assert.equal(total(data({}), "conversion_pct"), 0);
});

test("resultado = neto − coste − gastos, sin contar los gastos «colaborador» (ya van en el coste)", () => {
  const expenses: ExpenseRow[] = [
    { date: "2026-10-03T10:00:00.000Z", baseCents: 2000, category: "software", supplier: null },
    { date: "2026-10-03T10:00:00.000Z", baseCents: 3000, category: "Colaborador", supplier: null },
  ];
  const d = data({ orders: [order({ supplierCostCents: 3000 })], expenses });
  assert.equal(total(d, "gastos"), 50);
  assert.equal(total(d, "resultado"), 100 - 30 - 20);
  const rows = aggregate(d, { metric: "gastos", dimension: "categoria_gasto", period });
  assert.equal(rows.length, 2);
});

test("comparación con el periodo anterior y dimensiones válidas", () => {
  const cur = data({ orders: [order()] });
  const prev = data({ orders: [order(), order()] });
  const [row] = aggregate(cur, { metric: "pedidos", dimension: "total", period, compare: prev });
  assert.deepEqual(row, { label: "Total", value: 1, compareValue: 2 });
  assert.deepEqual(aggregate(cur, { metric: "gastos", dimension: "cliente", period }), []);
  assert.ok(dimensionsFor(["ingresos_netos", "coste_traductores"]).includes("traductor"));
  assert.ok(!dimensionsFor(["pedidos", "gastos"]).includes("traductor"));
});

test("tiempo: el mes se reparte por días de Madrid (23:30 UTC del 31 ya es 1-nov)", () => {
  const d = data({
    orders: [order({ paidAt: "2026-10-31T22:30:00.000Z" }), order({ paidAt: "2026-10-31T23:30:00.000Z" })],
  });
  const rows = aggregate(d, { metric: "pedidos", dimension: "tiempo", period });
  assert.equal(rows.length, 31);
  assert.equal(rows[30].value, 1);
});

test("fronteras en Europe/Madrid: mes, trimestre, año, semana lunes y cambio de hora", () => {
  const oct = buildPeriod("mes", "2026-10-15");
  assert.equal(oct.start, "2026-09-30T22:00:00.000Z");
  assert.equal(oct.end, "2026-10-31T23:00:00.000Z");
  assert.equal(oct.prevStart, "2026-08-31T22:00:00.000Z");
  const q4 = buildPeriod("trimestre", "2026-11-20");
  assert.equal(q4.start, "2026-09-30T22:00:00.000Z");
  assert.equal(q4.end, "2026-12-31T23:00:00.000Z");
  assert.equal(q4.buckets.length, 3);
  const year = buildPeriod("anio", "2026-06-01");
  assert.equal(year.start, "2025-12-31T23:00:00.000Z");
  assert.equal(year.buckets.length, 12);
  const week = buildPeriod("semana", "2026-10-07");
  assert.equal(week.start, "2026-10-04T22:00:00.000Z");
  assert.equal(week.end, "2026-10-11T22:00:00.000Z");
  assert.equal(week.label, "5 oct – 11 oct 2026");
  assert.equal(shiftAnchor("mes", "2026-01-31", -1), "2025-12-01");
  assert.equal(buildPeriod("dia", "2026-03-29").end, "2026-03-29T22:00:00.000Z");
  assert.equal(buildPeriod("dia", "2026-03-29").start, "2026-03-28T23:00:00.000Z");
});

test("pedidos de prueba: palabra suelta, no «Attestation»", () => {
  assert.equal(isTestTitle("Pedido de prueba"), true);
  assert.equal(isTestTitle("TEST pago"), true);
  assert.equal(isTestTitle("Attestation de travail"), false);
});
