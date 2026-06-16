import test from "node:test";
import assert from "node:assert/strict";
import { marginPctForCost, isFrenchForeign, clientPriceFromCost } from "../../lib/quote-math.ts";

test("marginPctForCost: tramos 30/25/20 por coste (sin IVA)", () => {
  assert.equal(marginPctForCost(50), 30);
  assert.equal(marginPctForCost(99.99), 30);
  assert.equal(marginPctForCost(100), 25);
  assert.equal(marginPctForCost(150), 25);
  assert.equal(marginPctForCost(189.99), 25);
  assert.equal(marginPctForCost(190), 20);
  assert.equal(marginPctForCost(200), 20);
  assert.equal(marginPctForCost(0), 30);
  assert.equal(marginPctForCost(-5), 30); // negativo saneado a 0 → tramo bajo
});

test("isFrenchForeign: par y código suelto, ambos sentidos", () => {
  assert.equal(isFrenchForeign("fr"), true);
  assert.equal(isFrenchForeign("fr-es"), true);
  assert.equal(isFrenchForeign("es-fr"), true);
  assert.equal(isFrenchForeign("FR-ES"), true);
  assert.equal(isFrenchForeign("en"), false);
  assert.equal(isFrenchForeign("en-es"), false);
  assert.equal(isFrenchForeign("es-en"), false);
  assert.equal(isFrenchForeign(""), false);
  assert.equal(isFrenchForeign(null), false);
  assert.equal(isFrenchForeign(undefined), false);
});

test("clientPriceFromCost: no-FR aplica tiered, FR no aplica margen", () => {
  // no francés
  assert.equal(clientPriceFromCost(50, "en"), 65); // 50×1.30
  assert.equal(clientPriceFromCost(150, "de"), 187.5); // 150×1.25
  assert.equal(clientPriceFromCost(200, "it"), 240); // 200×1.20
  assert.equal(clientPriceFromCost(100, "pt"), 125); // borde inferior 25%
  assert.equal(clientPriceFromCost(190, "ar"), 228); // borde inferior 20%
  assert.equal(clientPriceFromCost(50, "en-es"), 65); // par
  assert.equal(clientPriceFromCost(50, "es-en"), 65); // par invertido
  // francés → sin margen a cualquier coste
  assert.equal(clientPriceFromCost(50, "fr"), 50);
  assert.equal(clientPriceFromCost(150, "fr-es"), 150);
  assert.equal(clientPriceFromCost(200, "es-fr"), 200);
});
