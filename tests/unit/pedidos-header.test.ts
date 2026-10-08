import test from "node:test";
import assert from "node:assert/strict";
import { allTimePeriod, buildPeriod, parsePedidosP, periodBounds, resolvePedidosPeriod } from "../../lib/panel-period.ts";
import { formatDelta } from "../../lib/panel-metrics.ts";
import { computePedidosKpis, inRange, pedidosHref, type KpiOrder } from "../../lib/pedidos-kpis.ts";

const NOW = new Date("2026-10-08T10:00:00.000Z");

test("parsePedidosP: por defecto mes, acepta todo", () => {
  assert.equal(parsePedidosP(undefined), "mes");
  assert.equal(parsePedidosP("basura"), "mes");
  assert.equal(parsePedidosP("todo"), "todo");
  assert.equal(parsePedidosP("semana"), "semana");
});

test("resolvePedidosPeriod: todo = null; mes = octubre en hora de Madrid", () => {
  assert.equal(resolvePedidosPeriod("todo", undefined, NOW), null);
  const m = resolvePedidosPeriod("mes", undefined, NOW)!;
  assert.equal(m.start, "2026-09-30T22:00:00.000Z");
  assert.equal(m.end, "2026-10-31T23:00:00.000Z");
  assert.equal(m.prevStart, "2026-08-31T22:00:00.000Z");
});

test("periodBounds e inRange: [from, to) con la frontera de Madrid", () => {
  const b = periodBounds(buildPeriod("mes", "2026-10-15", NOW));
  assert.equal(inRange("2026-09-30T22:00:00.000Z", b.from, b.to), true);
  assert.equal(inRange("2026-09-30T21:59:59.999Z", b.from, b.to), false);
  assert.equal(inRange("2026-10-31T23:00:00.000Z", b.from, b.to), false);
  assert.equal(inRange(null, b.from, b.to), false);
  assert.equal(inRange("2026-09-15T10:00:00.000Z", b.prevFrom, b.prevTo), true);
});

test("allTimePeriod: ventana enorme y sin periodo anterior", () => {
  const a = allTimePeriod(NOW);
  assert.ok(new Date(a.start) < new Date("2020-01-01"));
  assert.ok(new Date(a.end) > NOW);
  assert.equal(a.prevStart, a.prevEnd);
});

test("variación frente al periodo anterior (reutiliza formatDelta)", () => {
  assert.deepEqual(formatDelta("pedidos", 12, 10)?.sign, 1);
  assert.deepEqual(formatDelta("pedidos", 5, 10)?.sign, -1);
  assert.equal(formatDelta("pedidos", 5, 10)?.text, "-50 %");
  assert.equal(formatDelta("pedidos", 5, 0), null);
  assert.equal(formatDelta("pedidos", 5, undefined), null);
});

const o = (x: Partial<KpiOrder> = {}): KpiOrder => ({
  createdAt: "2026-10-03T10:00:00.000Z",
  paymentStatus: "PAID",
  status: "PAID",
  dueDate: null,
  amountCents: 12100,
  ...x,
});

test("computePedidosKpis: nuevos por periodo y anterior", () => {
  const period = buildPeriod("mes", undefined, NOW);
  const k = computePedidosKpis(
    [o(), o({ createdAt: "2026-10-07T10:00:00.000Z" }), o({ createdAt: "2026-09-10T10:00:00.000Z" }), o({ createdAt: "2026-07-01T10:00:00.000Z" })],
    period,
    NOW
  );
  assert.equal(k.nuevos.value, 2);
  assert.equal(k.nuevos.prev, 1);
});

test("computePedidosKpis: todo = sin comparación", () => {
  const k = computePedidosKpis([o(), o({ createdAt: "2025-01-01T00:00:00.000Z" })], null, NOW);
  assert.equal(k.nuevos.value, 2);
  assert.equal(k.nuevos.prev, undefined);
});

test("computePedidosKpis: por entregar con vencimientos y por cobrar", () => {
  const orders = [
    o({ dueDate: "2026-10-08T15:00:00.000Z" }), // hoy
    o({ dueDate: "2026-10-09T15:00:00.000Z" }), // mañana
    o({ dueDate: "2026-10-10T15:00:00.000Z" }), // pasado
    o({ dueDate: "2026-10-01T15:00:00.000Z", status: "IN_PROGRESS" }), // vencido
    o({ status: "DELIVERED" }), // entregado: fuera
    o({ paymentStatus: "PENDING", status: "PENDING_PAYMENT", amountCents: 5000 }),
    o({ paymentStatus: "PENDING", status: "CANCELLED", amountCents: 9999 }),
  ];
  const k = computePedidosKpis(orders, null, NOW);
  assert.deepEqual(k.porEntregar, { count: 4, vencenPronto: 2, vencidos: 1 });
  assert.deepEqual(k.porCobrar, { count: 1, cents: 5000 });
});

test("pedidosHref: omite los valores por defecto", () => {
  assert.equal(pedidosHref({ p: "mes", d: "2026-10-08" }).startsWith("/zona-traductor?d="), true);
  assert.equal(pedidosHref({ p: "mes" }), "/zona-traductor");
  assert.equal(pedidosHref({ p: "todo", d: "2026-10-08", filtro: "por-cobrar" }), "/zona-traductor?p=todo&filtro=por-cobrar");
  assert.equal(pedidosHref({ p: "semana", d: "2026-10-05", base: "paid", vista: "tabla" }), "/zona-traductor?p=semana&d=2026-10-05&base=paid&vista=tabla");
});
