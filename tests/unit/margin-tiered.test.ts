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

/* ───── Regla única del precio automático no-FR (Juan, 9-oct-2026) ───── */
import { autoClientPriceFromCost, autoClientPriceCentsFromCost } from "../../lib/quote-math.ts";
import { priceDocWithRate } from "../../lib/learned-rates-math.ts";
import { clientBaseFromQuote } from "../../lib/pricing-engine/page-pricing.ts";

test("autoClientPriceFromCost: max(suelo, min(coste×1,6, max(coste×(1+m), coste+10)))", () => {
  assert.equal(autoClientPriceFromCost(35), 45.5);
  assert.equal(autoClientPriceFromCost(5), 40, "suelo");
  assert.equal(autoClientPriceFromCost(20), 40, "el suelo gana al tope (20×1,6 = 32)");
  assert.equal(autoClientPriceFromCost(150), 187.5);
  assert.equal(autoClientPriceFromCost(300), 360);
  assert.equal(autoClientPriceFromCost(60), 78);
});

test("autoClientPriceFromCost: mínimo +10 € y tope +60 % sin suelo", () => {
  assert.equal(autoClientPriceFromCost(30, 0), 40, "30×1,3 = 39 < 30+10");
  assert.equal(autoClientPriceFromCost(10, 0), 16, "10+10 = 20 supera el tope 16");
  assert.equal(autoClientPriceFromCost(0, 0), 0);
  assert.equal(autoClientPriceCentsFromCost(6000), 7800);
  assert.equal(autoClientPriceCentsFromCost(500), 4000);
});

test("tarifario aprendido: sin precio aprendido usa la regla; con precio aprobado lo respeta", () => {
  assert.equal(priceDocWithRate({ unit: "doc", costCents: 6000, clientCents: null }, null).clientCents, 7800);
  assert.equal(priceDocWithRate({ unit: "doc", costCents: 3500, clientCents: null }, null).clientCents, 4550);
  assert.equal(priceDocWithRate({ unit: "doc", costCents: 6000, clientCents: 9000 }, null).clientCents, 9000);
  assert.deepEqual(priceDocWithRate({ unit: "kword", costCents: 3000, clientCents: null }, 2000), { clientCents: 7800, costCents: 6000 });
});

test("puerta: no-FR con la regla (sin suelo propio); FR sin margen", () => {
  const q = { basePrice: 60, urgentPrice: 75 };
  assert.equal(clientBaseFromQuote(q, "de"), 78);
  assert.equal(clientBaseFromQuote(q, "fr"), 60);
  assert.equal(clientBaseFromQuote({ basePrice: 20, urgentPrice: 25 }, "de"), 30, "20+10 = 30 ≤ 32");
});
