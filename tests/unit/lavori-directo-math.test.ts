import test from "node:test";
import assert from "node:assert/strict";
import {
  channelPriceToBaseCents,
  directQuoteLines,
  isAnomalousPrice,
  exceedsQuotedCost,
  DOC_FLOOR_CENTS,
} from "../../lib/lavori-directo-math.ts";

// Funnel directo (Juan, 15-sep-2026): el jurado da su cifra en base o en
// líquido a cobrar (base × 1,06); el presupuesto sale con +20 % sobre la base.

test("channelPriceToBaseCents: payable_iva_irpf divide entre 1,06 (Daniela 100 € → base 94,34)", () => {
  assert.equal(channelPriceToBaseCents(10000, "payable_iva_irpf"), 9434);
});

test("channelPriceToBaseCents: base se queda igual", () => {
  assert.equal(channelPriceToBaseCents(10000, "base"), 10000);
});

test("Daniela 62 € payable, 2 docs 100/75 pal: base 5849, Σcost exacto y suelo por doc", () => {
  const base = channelPriceToBaseCents(6200, "payable_iva_irpf");
  assert.equal(base, 5849);
  const lines = directQuoteLines(base, [{ words: 100 }, { words: 75 }]);
  assert.equal(lines.length, 2);
  const sumCost = lines.reduce((a, l) => a + l.costCents, 0);
  assert.equal(sumCost, base, "la suma de costes tiene que ser EXACTA (el último absorbe el redondeo)");
  for (const l of lines) assert.ok(l.clientCents >= DOC_FLOOR_CENTS, "nunca por debajo del suelo de 40 €");
  // Reparto proporcional a palabras (100/175 y 75/175): el primero queda justo
  // por encima del punto donde el suelo deja de mandar (3342 × 1,20 → 4050
  // tras roundUp50); el segundo se queda en el suelo (2507 × 1,20 = 3050 < 4000).
  assert.deepEqual(lines.map((l) => l.costCents), [3342, 2507]);
  assert.deepEqual(lines.map((l) => l.clientCents), [4050, 4000]);
});

test("Morton 10 € base, 1 doc: suelo de 40 € manda", () => {
  const base = channelPriceToBaseCents(1000, "base");
  const lines = directQuoteLines(base, [{ words: 250 }]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].costCents, 1000);
  assert.equal(lines[0].clientCents, 4000);
});

test("Lourdes 140 € base, 1 doc: +20 % ya está por encima del suelo", () => {
  const base = channelPriceToBaseCents(14000, "base");
  const lines = directQuoteLines(base, [{ words: 900 }]);
  assert.equal(lines[0].costCents, 14000);
  assert.equal(lines[0].clientCents, 16800);
});

test("sin palabras en algún documento, reparto a partes iguales", () => {
  const lines = directQuoteLines(9000, [{ words: 500 }, { words: null }]);
  assert.equal(lines[0].costCents, 4500);
  assert.equal(lines[1].costCents, 4500);
  assert.equal(lines[0].costCents + lines[1].costCents, 9000);
});

test("isAnomalousPrice: sin madurez de historial (<3 muestras) nunca es anómalo", () => {
  assert.equal(isAnomalousPrice(50, [10, 12]), false);
  assert.equal(isAnomalousPrice(500, []), false);
});

test("isAnomalousPrice: por encima de 2× la mediana del historial SÍ es anómalo", () => {
  const historial = [8, 9, 10, 11, 12]; // mediana 10
  assert.equal(isAnomalousPrice(20, historial), false, "exactamente 2x no es anómalo");
  assert.equal(isAnomalousPrice(21, historial), true, "por encima de 2x sí");
});

test("exceedsQuotedCost: dentro de la tolerancia de 1 céntimo no excede", () => {
  assert.equal(exceedsQuotedCost(5849, 5849), false);
  assert.equal(exceedsQuotedCost(5850, 5849), false, "1 céntimo de redondeo tolerado");
});

test("exceedsQuotedCost: por encima del coste presupuestado SÍ excede", () => {
  assert.equal(exceedsQuotedCost(5851, 5849), true);
  assert.equal(exceedsQuotedCost(10000, 5849), true, "Daniela sube de 62 € a mucho más tras enviar el presupuesto");
});
