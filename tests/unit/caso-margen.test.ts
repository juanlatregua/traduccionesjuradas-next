import test from "node:test";
import assert from "node:assert/strict";
import { costeDelPresupuesto, margenPedido } from "../../lib/caso/margen.ts";

test("margen: neto del presupuesto (total − IVA) menos el coste del jurado", () => {
  assert.deepEqual(margenPedido({ quoteTotal: 121, quoteVat: 21, supplierCostCents: 6000 }), { neto: 100, margen: 40 });
});

test("margen cero o negativo se ve como tal (nunca puedo perder)", () => {
  assert.equal(margenPedido({ quoteTotal: 121, quoteVat: 21, supplierCostCents: 10000 }).margen, 0);
  assert.equal(margenPedido({ quoteTotal: 60.5, quoteVat: 10.5, supplierCostCents: 7000 }).margen, -20);
});

test("margen: sin presupuesto o sin coste no se inventa", () => {
  assert.deepEqual(margenPedido({ quoteTotal: null, quoteVat: null, supplierCostCents: 5000 }), { neto: null, margen: null });
  assert.deepEqual(margenPedido({ quoteTotal: 121, quoteVat: 21, supplierCostCents: null }), { neto: 100, margen: null });
  assert.equal(margenPedido({ quoteTotal: 0, quoteVat: 0, supplierCostCents: 0 }).margen, 0);
});

test("dos pedidos vivos de un presupuesto: coste sumado; si falta uno, sin margen", () => {
  const coste = costeDelPresupuesto([{ supplierCostCents: 4000 }, { supplierCostCents: 5000 }]);
  assert.equal(coste, 9000);
  assert.equal(margenPedido({ quoteTotal: 121, quoteVat: 21, supplierCostCents: coste }).margen, 10);
  assert.equal(costeDelPresupuesto([{ supplierCostCents: 4000 }, { supplierCostCents: null }]), null);
});
