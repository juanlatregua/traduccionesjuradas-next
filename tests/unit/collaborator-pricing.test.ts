import test from "node:test";
import assert from "node:assert/strict";
import {
  customerPriceFromSupplierCost,
  netFromGross,
  DEFAULT_COLLABORATOR_MARGIN_PCT,
} from "../../lib/quotes.ts";

test("precio cliente = coste × 1,25 × 1,21 (margen 25% por defecto)", () => {
  // coste 100€ → 100 × 1,25 = 125€ → × 1,21 = 151,25€
  assert.equal(customerPriceFromSupplierCost(10000), 15125);
  assert.equal(DEFAULT_COLLABORATOR_MARGIN_PCT, 25);
});

test("precio cliente con margen explícito distinto", () => {
  // coste 100€, margen 30% → 100 × 1,30 × 1,21 = 157,30€
  assert.equal(customerPriceFromSupplierCost(10000, 30), 15730);
  // margen 0% → solo IVA
  assert.equal(customerPriceFromSupplierCost(10000, 0), 12100);
});

test("netFromGross deshace el IVA del precio final", () => {
  // 151,25€ con IVA → 125,00€ neto
  assert.equal(netFromGross(15125), 12500);
});

test("el margen neto de IVA es el coste × margen", () => {
  const cost = 10000; // 100€
  const customer = customerPriceFromSupplierCost(cost, 25); // 151,25€
  const revenueNet = netFromGross(customer); // 125,00€
  const marginCents = revenueNet - cost; // 25,00€
  assert.equal(marginCents, 2500);
  assert.ok(marginCents > 0, "el margen debe ser positivo, no negativo como el bug previo");
});

test("entradas inválidas/cero no rompen", () => {
  assert.equal(customerPriceFromSupplierCost(0), 0);
  assert.equal(customerPriceFromSupplierCost(-500), 0);
  assert.equal(netFromGross(0), 0);
});
