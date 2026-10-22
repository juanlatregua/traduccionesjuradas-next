import test from "node:test";
import assert from "node:assert/strict";
import { eurosToCents, paidAmountMatches } from "../../lib/payment-amount-math.ts";
import { regularizacionFlatApplies, REGULARIZACION_FR_DOC_CENTS } from "../../lib/regularizacion-price.ts";

test("eurosToCents: cadenas de PayPal y números", () => {
  assert.equal(eurosToCents("50.00"), 5000);
  assert.equal(eurosToCents("12.10"), 1210);
  assert.equal(eurosToCents(0.29), 29);
  assert.equal(eurosToCents(undefined), null);
  assert.equal(eurosToCents("abc"), null);
});

test("paidAmountMatches: solo importe exacto", () => {
  assert.equal(paidAmountMatches(6050, 6050), true);
  assert.equal(paidAmountMatches(6050, 100), false);
  assert.equal(paidAmountMatches(6050, 6051), false);
  assert.equal(paidAmountMatches(6050, null), false);
  assert.equal(paidAmountMatches(0, 0), false);
});

test("regularizacionFlatApplies: 25 € solo FR con 1-2 páginas", () => {
  const base = { purposeIsRegularizacion: true, foreignLang: "fr", pages: 1, isFrenchCriminalRecord: false };
  assert.equal(REGULARIZACION_FR_DOC_CENTS, 2500);
  assert.equal(regularizacionFlatApplies(base), true);
  assert.equal(regularizacionFlatApplies({ ...base, pages: 2 }), true);
  assert.equal(regularizacionFlatApplies({ ...base, pages: 3 }), false);
  assert.equal(regularizacionFlatApplies({ ...base, pages: 40 }), false);
  assert.equal(regularizacionFlatApplies({ ...base, pages: undefined }), false);
  assert.equal(regularizacionFlatApplies({ ...base, pages: 0 }), false);
  assert.equal(regularizacionFlatApplies({ ...base, foreignLang: "en" }), false);
  assert.equal(regularizacionFlatApplies({ ...base, purposeIsRegularizacion: false }), false);
  assert.equal(regularizacionFlatApplies({ ...base, isFrenchCriminalRecord: true }), false);
});
