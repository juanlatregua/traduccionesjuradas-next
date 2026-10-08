import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, computeTotals, type OrderRow, type PanelData } from "../../lib/panel-metrics.ts";
import { buildPeriod } from "../../lib/panel-period.ts";
import { filterPanelData, matchesOrderSlicers, parseSlicers, slicerOptions, slicerParams, orderSegmentInput } from "../../lib/panel-slicers.ts";
import { buildBreakdown, parseBreakdown } from "../../lib/pedidos-breakdown.ts";
import { computePedidosKpis, pedidosHref } from "../../lib/pedidos-kpis.ts";

const NOW = new Date("2026-10-08T10:00:00.000Z");

// Mismos pedidos vistos como fila del Panel y como pedido de la tabla.
const base = [
  { ref: "A", langPair: "NL>ES", assignedTo: "Daniela", client: "Acme, S.L.", pm: "STRIPE", wa: false, cents: 12100 },
  { ref: "B", langPair: "NL>EN", assignedTo: "Marta", client: "Beta", pm: "BIZUM", wa: true, cents: 24200 },
  { ref: "C", langPair: "DE>ES", assignedTo: "Daniela", client: "Gama", pm: "STRIPE", wa: false, cents: 6050 },
  { ref: "D", langPair: "FR>ES", assignedTo: null, client: "Delta", pm: "STRIPE", wa: false, cents: 12100 },
];
const tableOrder = (b: (typeof base)[number]) => ({
  reference: b.ref,
  langPair: b.langPair,
  assignedTo: b.assignedTo,
  clientName: b.client,
  clientEmail: "x@y.z",
  paymentMethod: b.pm,
  createdAt: "2026-10-03T10:00:00.000Z",
  paymentStatus: "PAID",
  status: "PAID",
  amountCents: b.cents,
  events: b.wa ? [{ type: "wa.lead_received" }] : [],
});
const panelRow = (b: (typeof base)[number]): OrderRow => ({
  paidAt: "2026-10-05T10:00:00.000Z",
  amountCents: b.cents,
  invoiceBaseCents: null,
  supplierCostCents: null,
  langPair: b.langPair,
  assignedTo: b.assignedTo,
  client: b.client,
  paymentMethod: b.pm,
  channel: b.wa ? "WHATSAPP" : "WEB",
});
const data: PanelData = { orders: base.map(panelRow), quotes: [], requests: [], expenses: [] };

test("parse/serialize: ida y vuelta, con comas dentro de un valor", () => {
  const f = { lengua: ["NL", "DE"], cliente: ["Acme, S.L."] };
  const sp = new URLSearchParams(slicerParams(f));
  assert.equal(sp.get("f_lengua"), "NL,DE");
  assert.deepEqual(parseSlicers((k) => new URLSearchParams(sp.toString()).get(k)), f);
  assert.deepEqual(parseSlicers(() => undefined), {});
});

test("lengua + traductor se combinan con AND; varios valores de uno, con OR", () => {
  const f = parseSlicers((k) => ({ f_lengua: "nl,de", f_trad: "Daniela" })[k]);
  const hit = base.map(tableOrder).filter((o) => matchesOrderSlicers(o, f)).map((o) => o.reference);
  assert.deepEqual(hit, ["A", "C"]);
  const onlyNl = base.map(tableOrder).filter((o) => matchesOrderSlicers(o, { lengua: ["nl"] })).map((o) => o.reference);
  assert.deepEqual(onlyNl, ["A", "B"]);
  assert.equal(base.map(tableOrder).filter((o) => matchesOrderSlicers(o, {})).length, 4);
});

test("canal y vía de pago filtran", () => {
  assert.deepEqual(base.map(tableOrder).filter((o) => matchesOrderSlicers(o, { canal: ["whatsapp"] })).map((o) => o.reference), ["B"]);
  assert.deepEqual(base.map(tableOrder).filter((o) => matchesOrderSlicers(o, { via: ["Bizum"] })).map((o) => o.reference), ["B"]);
});

test("los KPI cuadran con la tabla filtrada", () => {
  const f = { lengua: ["NL", "DE"], trad: ["Daniela"] };
  const table = base.map(tableOrder).filter((o) => matchesOrderSlicers(o, f));
  const period = buildPeriod("mes", undefined, NOW);
  assert.equal(computePedidosKpis(table, period, NOW).nuevos.value, table.length);
  const filtered = filterPanelData(data, f);
  assert.equal(filtered.orders.length, table.length);
  const sumNet = table.reduce((a, o) => a + Math.round(o.amountCents / 1.21), 0);
  assert.equal(computeTotals(filtered, "ingresos_netos"), Math.round(sumNet) / 100);
  assert.equal(computeTotals(filtered, "pedidos"), 2);
});

test("slicerOptions: valores con recuento y los ya elegidos se conservan", () => {
  const o = slicerOptions(base.map(tableOrder).map(orderSegmentInput), { trad: ["Ausente"] });
  assert.deepEqual(o.lengua.map((x) => x.value), ["NL", "DE", "FR"]);
  assert.equal(o.lengua[0].count, 2);
  assert.ok(o.trad.some((x) => x.value === "Ausente" && x.count === 0));
  assert.ok(o.trad.some((x) => x.value === "Juan (propio)"));
  assert.deepEqual(o.canal.map((x) => x.value).sort(), ["Web", "WhatsApp"]);
});

test("canal de entrada es dimensión del Panel", () => {
  const period = buildPeriod("mes", undefined, NOW);
  const rows = aggregate(data, { metric: "pedidos", dimension: "canal", period });
  assert.deepEqual(rows.map((r) => [r.label, r.value]), [["Web", 3], ["WhatsApp", 1]]);
});

test("desglose: valor, mismo tramo anterior, variación y barra", () => {
  const period = buildPeriod("mes", undefined, NOW);
  const prev: PanelData = { ...data, orders: [{ ...panelRow(base[0]), paidAt: "2026-09-05T10:00:00.000Z" }] };
  const sel = parseBreakdown("trad", "pedidos", true);
  const rows = buildBreakdown(data, prev, { dimension: sel.dimension, metric: sel.metric.metric, period });
  const dani = rows.find((r) => r.label === "Daniela")!;
  assert.equal(dani.value, 2);
  assert.equal(dani.prev, 1);
  assert.equal(dani.delta?.text, "+100 %");
  assert.equal(dani.share, 100);
  assert.equal(rows.find((r) => r.label === "Marta")!.delta, null);
  const noCompare = buildBreakdown(data, undefined, { dimension: sel.dimension, metric: sel.metric.metric, period });
  assert.equal(noCompare[0].prev, undefined);
});

test("desglose: un PM solo ve recuentos", () => {
  assert.equal(parseBreakdown("par", "cobrado", false).metric.key, "pedidos");
  assert.deepEqual(parseBreakdown("par", "margen", false).allowed.map((m) => m.key), ["pedidos"]);
  assert.equal(parseBreakdown("par", "margen", true).metric.key, "margen");
  assert.equal(parseBreakdown("zzz", undefined, true).slicer, "par");
});

test("pedidosHref conserva los segmentadores", () => {
  assert.equal(pedidosHref({ p: "todo", f: { lengua: ["NL"], trad: ["Daniela"] } }), "/zona-traductor?p=todo&f_lengua=NL&f_trad=Daniela");
});

test("desglose con comparación: unión de claves, «Anterior» suma lo del KPI anterior", () => {
  const period = buildPeriod("mes", undefined, NOW);
  const prev: PanelData = {
    ...data,
    orders: [
      { ...panelRow(base[0]), paidAt: "2026-09-05T10:00:00.000Z" },
      { ...panelRow(base[1]), assignedTo: "Solo-anterior", paidAt: "2026-09-06T10:00:00.000Z" },
    ],
  };
  const sel = parseBreakdown("trad", "pedidos", true);
  const rows = buildBreakdown(data, prev, { dimension: sel.dimension, metric: sel.metric.metric, period });
  const only = rows.find((r) => r.label === "Solo-anterior")!;
  assert.equal(only.value, 0);
  assert.equal(only.prev, 1);
  assert.equal(rows.reduce((a, r) => a + (r.prev ?? 0), 0), computeTotals(prev, "pedidos"));
  const without = buildBreakdown(data, undefined, { dimension: sel.dimension, metric: sel.metric.metric, period });
  assert.equal(without.some((r) => r.label === "Solo-anterior"), false);
});

test("parseSlicers acepta parámetros repetidos (array de Next)", () => {
  assert.deepEqual(parseSlicers((k) => (k === "f_lengua" ? ["nl", "de"] : undefined)), { lengua: ["nl", "de"] });
  assert.deepEqual(parseSlicers((k) => (k === "f_trad" ? [] : undefined)), {});
});
