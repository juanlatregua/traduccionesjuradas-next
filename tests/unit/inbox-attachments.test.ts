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

import { isSignatureImage } from "../../lib/inbox-attachments.ts";

const img = (o: Partial<Parameters<typeof isSignatureImage>[0]>) =>
  isSignatureImage({ contentType: "image/jpeg", isInline: true, size: 100000, width: 1000, height: 1000, ...o });

test("isSignatureImage: casos reales", () => {
  assert.equal(img({ size: 212362, width: 1206, height: 1808 }), false); // Aline
  assert.equal(img({ size: 212362, width: 1206, height: 1808, seenInOtherConversation: false }), false);
  assert.equal(img({ size: 79000, width: 1334, height: 1334 }), false); // Olmalca, primera vez
  assert.equal(img({ size: 79000, width: 1334, height: 1334, seenInOtherConversation: true }), true); // Olmalca repetida
  assert.equal(img({ size: 41000, width: 500, height: 336 }), true); // Calamus
  assert.equal(img({ size: 32000, contentType: "image/png", width: 150, height: 112 }), true); // DXC
  assert.equal(img({ size: 5000000, width: 4032, height: 3024 }), false); // foto móvil
  assert.equal(img({ size: 200000, width: 1600, height: 511 }), false); // captura
});

test("isSignatureImage: sin dimensiones no descarta; adjunto no inline nunca por dimensiones; no-imagen inline fuera", () => {
  assert.equal(img({ width: null, height: null }), false);
  assert.equal(img({ isInline: false, width: 100, height: 100 }), false);
  assert.equal(img({ size: 1000, isInline: false }), true);
  assert.equal(img({ contentType: "application/pdf", isInline: true }), true);
});
