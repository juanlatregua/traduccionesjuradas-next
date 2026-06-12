import test from "node:test";
import assert from "node:assert/strict";
import { computeQuoteTotals } from "../../lib/quotes.ts";
import { computeQuoteTotals as computeFromMath } from "../../lib/quote-math.ts";

test("calcula totales con envío en papel (12€) + IVA", () => {
  const totals = computeQuoteTotals({
    lines: [
      { description: "Certificado nacimiento", quantity: 1, unitPrice: 50 },
      { description: "Antecedentes", quantity: 2, unitPrice: 30 },
    ],
    discountType: "NONE",
    discountValue: 0,
    vatRate: 0.21,
    deliveryType: "PAPER_SHIP",
    shippingBase: 12,
  });

  assert.equal(totals.subtotal, 110);
  assert.equal(totals.shippingAmount, 12);
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.vatAmount, 25.62);
  assert.equal(totals.total, 147.62);
});

test("aplica descuento porcentual antes de IVA", () => {
  const totals = computeQuoteTotals({
    lines: [{ description: "Documento", quantity: 1, unitPrice: 100 }],
    discountType: "PERCENT",
    discountValue: 10,
    vatRate: 0.21,
    deliveryType: "DIGITAL_PDF",
    shippingBase: 0,
  });

  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discountAmount, 10);
  assert.equal(totals.shippingAmount, 0);
  assert.equal(totals.vatAmount, 18.9);
  assert.equal(totals.total, 108.9);
});

test("descuento fijo se capa al subtotal + envío (nunca negativo)", () => {
  const totals = computeQuoteTotals({
    lines: [{ description: "Documento", quantity: 1, unitPrice: 40 }],
    discountType: "FIXED",
    discountValue: 999, // mayor que 40 + 12
    vatRate: 0.21,
    deliveryType: "PAPER_SHIP",
    shippingBase: 12,
  });

  assert.equal(totals.subtotal, 40);
  assert.equal(totals.shippingAmount, 12);
  assert.equal(totals.discountAmount, 52); // capado a 40 + 12
  assert.equal(totals.vatAmount, 0);
  assert.equal(totals.total, 0);
});

test("quote-math y quotes exponen la MISMA función (fuente única UI/servidor)", () => {
  const params = {
    lines: [{ description: "Doc", quantity: 2, unitPrice: 25 }],
    discountType: "PERCENT" as const,
    discountValue: 10,
    vatRate: 0.21,
    deliveryType: "PAPER_SHIP" as const,
    shippingBase: 12,
  };
  assert.deepEqual(computeFromMath(params), computeQuoteTotals(params));
});
