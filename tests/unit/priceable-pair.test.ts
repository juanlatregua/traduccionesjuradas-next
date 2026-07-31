import test from "node:test";
import assert from "node:assert/strict";
import { resolvePriceablePair, isAutoPriceable } from "../../lib/pricing-engine/languages.ts";

// Presupuesto 2026-00045: es→unknown se tarificó en silencio como "es" con la
// tarifa por defecto. El par solo es tarificable si tiene un lado extranjero
// determinado y el otro es español.

test("resolvePriceablePair: original ES exige destino conocido", () => {
  assert.equal(resolvePriceablePair("es", "pt"), "pt");
  assert.equal(resolvePriceablePair("es", "unknown"), null); // el incidente
  assert.equal(resolvePriceablePair("es", ""), null);
  assert.equal(resolvePriceablePair("es", null), null);
  assert.equal(resolvePriceablePair("es", "es"), null);
});

test("resolvePriceablePair: original extranjero asume destino ES", () => {
  assert.equal(resolvePriceablePair("fr", "es"), "fr");
  assert.equal(resolvePriceablePair("fr", "unknown"), "fr");
  assert.equal(resolvePriceablePair("fr", null), "fr");
  assert.equal(resolvePriceablePair("PT", "ES"), "pt"); // normaliza mayúsculas
});

test("resolvePriceablePair: traducción cruzada (sin español) → null", () => {
  assert.equal(resolvePriceablePair("fr", "en"), null);
  assert.equal(resolvePriceablePair("ar", "fr"), null);
});

test("resolvePriceablePair: origen sin determinar → null", () => {
  assert.equal(resolvePriceablePair("unknown", "es"), null);
  assert.equal(resolvePriceablePair("", "pt"), null);
  assert.equal(resolvePriceablePair(null, null), null);
});

test("resolvePriceablePair + isAutoPriceable: idiomas sin tarifa no pasan", () => {
  // El par es válido (ru→es) pero ruso NO se auto-tarifica (incidente NJ42):
  // el gate de negocio sigue siendo isAutoPriceable sobre el lado extranjero.
  assert.equal(resolvePriceablePair("ru", "es"), "ru");
  assert.equal(isAutoPriceable("ru"), false);
});

// NOTA: computeBase (calculator.ts) no se puede importar bajo `node --test`
// porque calculator usa imports relativos sin extensión (mismo motivo por el
// que diagnosis.test falla desde antes con el alias @/lib). Su equivalencia
// con calculatePrice queda garantizada porque calculatePrice delega en él.
