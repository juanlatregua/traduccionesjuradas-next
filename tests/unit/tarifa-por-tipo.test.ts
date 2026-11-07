import { test } from "node:test";
import assert from "node:assert/strict";
import { fitsDocSize, autoSendCapCentsWithVat, AUTO_REVIEW_UNTIL } from "../../lib/learned-rates-math.ts";

test("precio por tipo: más corto que la referencia vale; más de +30 % va a mano", () => {
  assert.equal(fitsDocSize(300, 650), true);
  assert.equal(fitsDocSize(163, 650), true);
  assert.equal(fitsDocSize(60, 650), false);
  assert.equal(fitsDocSize(845, 650), true);
  assert.equal(fitsDocSize(846, 650), false);
  assert.equal(fitsDocSize(null, 650), true);
  assert.equal(fitsDocSize(500, null), true);
});

test("envío solo: hasta el 9-nov 100 € con IVA; después 300 €", () => {
  assert.equal(autoSendCapCentsWithVat(new Date("2026-11-08T12:00:00Z")), 10000);
  assert.equal(autoSendCapCentsWithVat(new Date(AUTO_REVIEW_UNTIL.getTime() - 1)), 10000);
  assert.equal(autoSendCapCentsWithVat(AUTO_REVIEW_UNTIL), 30000);
});
