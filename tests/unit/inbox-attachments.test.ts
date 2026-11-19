import test from "node:test";
import assert from "node:assert/strict";
import { isSignatureLike } from "../../lib/inbox-attachments.ts";

test("justificante de Aline: foto inline de 212 KB (iPhone) cuenta como adjunto", () => {
  assert.equal(isSignatureLike({ contentType: "image/jpeg", size: 212362, isInline: true }), false);
});

test("logo de firma inline o no, por debajo de 30 KB: fuera", () => {
  assert.equal(isSignatureLike({ contentType: "image/png", size: 8000, isInline: true }), true);
  assert.equal(isSignatureLike({ contentType: "image/png", size: 8000, isInline: false }), true);
});

test("PDF adjunto cuenta; adjunto inline que no es imagen no", () => {
  assert.equal(isSignatureLike({ contentType: "application/pdf", size: 5000, isInline: false }), false);
  assert.equal(isSignatureLike({ contentType: "application/octet-stream", size: 5000, isInline: true }), true);
});
