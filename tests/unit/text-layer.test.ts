import test from "node:test";
import assert from "node:assert/strict";
import { isReliableTextLayer } from "../../lib/ai/extract-text.ts";

test("escaneo con solo la hoja de firma digital NO es capa de texto (26_3D3B0C)", () => {
  assert.equal(isReliableTextLayer([0, 0, 0, 0, 540], 5), false);
  assert.equal(isReliableTextLayer([0, 0, 0, 0, 0, 0, 545], 7), false);
});

test("PDF digital normal sí es capa de texto", () => {
  assert.equal(isReliableTextLayer([420, 380, 15], 3), true);
  assert.equal(isReliableTextLayer([300], 1), true);
});

test("fusionado con minoría de páginas escaneadas sigue por texto", () => {
  assert.equal(isReliableTextLayer([400, 350, 0, 380], 4), true);
});

test("escaneo vacío o con texto residual no es capa de texto", () => {
  assert.equal(isReliableTextLayer([0, 0, 0], 3), false);
  assert.equal(isReliableTextLayer([3, 2, 4], 3), false);
});
