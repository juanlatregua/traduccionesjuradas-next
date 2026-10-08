import test from "node:test";
import assert from "node:assert/strict";
import { allTimePeriod, compareLabel, tablePeriod, buildPeriod, parsePedidosP, periodBounds, resolvePedidosPeriod } from "../../lib/panel-period.ts";
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
  assert.equal(inRange("2026-09-05T10:00:00.000Z", b.prevFrom, b.prevTo), true);
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
    [o(), o({ createdAt: "2026-10-07T10:00:00.000Z" }), o({ createdAt: "2026-09-05T10:00:00.000Z" }), o({ createdAt: "2026-07-01T10:00:00.000Z" })],
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
  assert.equal(pedidosHref({ p: "mes", d: "2026-10-08" }) === "/zona-traductor?p=mes&d=2026-10-08", true);
  assert.equal(pedidosHref({}), "/zona-traductor");
  assert.equal(pedidosHref({ p: "mes" }), "/zona-traductor?p=mes");
  assert.equal(pedidosHref({ p: "todo", d: "2026-10-08", filtro: "por-cobrar" }), "/zona-traductor?p=todo&filtro=por-cobrar");
  assert.equal(pedidosHref({ p: "semana", d: "2026-10-05", base: "paid", vista: "tabla" }), "/zona-traductor?p=semana&d=2026-10-05&base=paid&vista=tabla");
});

test("tablePeriod: sin p la tabla no filtra por fecha; con q tampoco; con p sí", () => {
  assert.equal(tablePeriod(undefined, undefined, "", NOW), null);
  assert.equal(tablePeriod("", "2026-10-01", "", NOW), null);
  assert.equal(tablePeriod("mes", undefined, "garcia", NOW), null);
  assert.equal(tablePeriod("todo", undefined, "", NOW), null);
  assert.equal(tablePeriod("mes", undefined, "  ", NOW)?.start, "2026-09-30T22:00:00.000Z");
});

test("periodo en curso: compara con el mismo tramo del anterior", () => {
  const cur = buildPeriod("mes", undefined, NOW); // 8-oct 12:00 Madrid
  assert.equal(cur.partial, true);
  assert.equal(cur.prevCompareEnd, "2026-09-08T10:00:00.000Z");
  assert.equal(periodBounds(cur).prevTo.toISOString(), cur.prevCompareEnd);
  assert.equal(compareLabel(cur), "vs mismo tramo de septiembre 2026");
  const past = buildPeriod("mes", "2026-09-10", NOW);
  assert.equal(past.partial, false);
  assert.equal(past.prevCompareEnd, past.prevEnd);
  assert.equal(compareLabel(past), "vs periodo anterior");
});

test("periodo en curso: los pedidos del tramo no cuentan contra el mes anterior entero", () => {
  const period = buildPeriod("mes", undefined, NOW);
  const k = computePedidosKpis(
    [{ ...o(), createdAt: "2026-10-03T10:00:00.000Z" }, { ...o(), createdAt: "2026-09-05T10:00:00.000Z" }, { ...o(), createdAt: "2026-09-20T10:00:00.000Z" }],
    period,
    NOW
  );
  assert.equal(k.nuevos.prev, 1);
});
