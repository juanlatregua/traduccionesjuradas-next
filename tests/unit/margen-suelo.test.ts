import test from "node:test";
import assert from "node:assert/strict";
import { priceDocWithRate, canAutoQuote, marginPctOf, MIN_AUTO_MARGIN_PCT, LEARNED_MARGIN_PCT } from "../../lib/learned-rates-math.ts";

// "Nunca puedo perder" (Juan, 28-ago-2026). El presupuesto automático no sale
// si el margen no llega al suelo. Estas pruebas fijan la aritmética que decide.

test("una tarifa con coste igual al precio deja margen CERO", () => {
  const p = priceDocWithRate({ unit: "doc", costCents: 5500, clientCents: 5500 }, null);
  assert.equal(p.clientCents - p.costCents, 0);
  assert.ok(marginPctOf(p.clientCents, p.costCents) < MIN_AUTO_MARGIN_PCT, "no debe superar el suelo");
});

test("el coste inventado (cliente ÷ 1,12) deja exactamente el margen mínimo de la horquilla", () => {
  // Caso real: apostilla EN>ES guardada con coste 49,11 y cliente 55,00.
  const p = priceDocWithRate({ unit: "doc", costCents: 4911, clientCents: 5500 }, null);
  const pct = marginPctOf(p.clientCents, p.costCents);
  assert.ok(Math.abs(pct - LEARNED_MARGIN_PCT) < 0.5, `esperaba ~${LEARNED_MARGIN_PCT} %, salió ${pct.toFixed(1)} %`);
  // Con la tarifa REAL de Vanessa (0,08 €/palabra sobre 307 palabras = 24,56 €)
  // el mismo documento deja mucho más:
  const real = priceDocWithRate({ unit: "doc", costCents: 2456, clientCents: 5500 }, null);
  assert.ok(real.clientCents - real.costCents > (p.clientCents - p.costCents) * 4);
});

test("una tarifa con coste real supera el suelo con holgura", () => {
  // Morton, alemán, penales con apostilla: coste 25, cliente 60.
  const p = priceDocWithRate({ unit: "doc", costCents: 2500, clientCents: 6000 }, null);
  assert.ok(marginPctOf(p.clientCents, p.costCents) >= MIN_AUTO_MARGIN_PCT);
  assert.equal(p.clientCents - p.costCents, 3500);
});

test("sin precio de cliente, el precio se deriva del coste y respeta la horquilla", () => {
  const p = priceDocWithRate({ unit: "doc", costCents: 10000, clientCents: null }, null);
  assert.ok(marginPctOf(p.clientCents, p.costCents) >= MIN_AUTO_MARGIN_PCT);
});

test("canAutoQuote resume la regla: cero y coste inventado NO salen, coste real SÍ", () => {
  assert.equal(canAutoQuote(5500, 5500), false, "coste = precio no sale");
  assert.equal(canAutoQuote(5000, 6000), false, "margen negativo no sale");
  assert.equal(canAutoQuote(5500, 4911), true, "12 % pasa el suelo del 10 %");
  assert.equal(canAutoQuote(6000, 2500), true, "coste real de Morton sale");
  assert.equal(canAutoQuote(5000, 0), false, "sin coste no se tarifica sola");
});
