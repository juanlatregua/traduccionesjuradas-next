import test from "node:test";
import assert from "node:assert/strict";
import { snapshotFromDocs, PAPER_SHIPPING_CENTS } from "../../lib/session-pricing-math.ts";

// Kill-switch de los 40 € planos (STORM 31-jul): el funnel viejo tarificaba a
// 40 €/doc cualquier documento sin quotedCents, a ciegas del idioma (ar/nl/sv
// tienen mínimo 50 € → pérdida). Ya no hay fallback: sin precio por documento
// no hay tarificación automática.

test("todos los documentos con precio → suma + IVA", () => {
  const snap = snapshotFromDocs([5000, 4200], 0);
  assert.ok(snap);
  assert.equal(snap.subtotalCents, 9200);
  assert.equal(snap.vatCents, 1932);
  assert.equal(snap.totalCents, 11132);
  assert.equal(snap.currency, "EUR");
});

test("envío en papel se suma al subtotal y tributa", () => {
  const snap = snapshotFromDocs([5000], PAPER_SHIPPING_CENTS);
  assert.ok(snap);
  assert.equal(snap.subtotalCents, 6200);
  assert.equal(snap.totalCents, 6200 + Math.round(6200 * 0.21));
});

test("un documento sin precio → null (antes: 40 € planos para TODOS)", () => {
  assert.equal(snapshotFromDocs([5000, null], 0), null);
});

test("todos los documentos sin precio → null (el kill-switch)", () => {
  assert.equal(snapshotFromDocs([null], 0), null);
  assert.equal(snapshotFromDocs([null, null, null], PAPER_SHIPPING_CENTS), null);
});

test("sin documentos → total 0 aunque haya envío en papel", () => {
  const snap = snapshotFromDocs([], PAPER_SHIPPING_CENTS);
  assert.ok(snap);
  assert.equal(snap.totalCents, 0);
});

test("subtotal negativo imposible: se recorta a 0", () => {
  const snap = snapshotFromDocs([-100], 0);
  assert.ok(snap);
  assert.equal(snap.subtotalCents, 0);
  assert.equal(snap.totalCents, 0);
});
