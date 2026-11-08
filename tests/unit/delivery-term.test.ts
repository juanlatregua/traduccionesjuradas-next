import test from "node:test";
import assert from "node:assert/strict";
import { parseDeliveryTerm } from "../../lib/delivery-term.ts";
import { isClosedPriceDirectLang, quoteCostCents } from "../../lib/lavori-directo-math.ts";

const lunes = new Date("2026-11-09T10:00:00Z");

test("N-M días hábiles usa M", () => {
  assert.equal(parseDeliveryTerm("2-3 días hábiles", lunes)?.getDay(), 4);
  assert.equal(parseDeliveryTerm("1 día hábil", lunes)?.getDay(), 2);
  assert.equal(parseDeliveryTerm("3 días hábiles", lunes)?.getDay(), 4);
});

test("fecha en español a las 18:00 Madrid, invierno y verano", () => {
  assert.equal(parseDeliveryTerm("martes 10 de noviembre", lunes)?.toISOString(), "2026-11-10T17:00:00.000Z");
  assert.equal(parseDeliveryTerm("10 de julio", lunes)?.toISOString(), "2027-07-10T16:00:00.000Z");
});

test("año: el próximo en que la fecha no es anterior al pago", () => {
  assert.equal(parseDeliveryTerm("9 de noviembre", lunes)?.toISOString(), "2026-11-09T17:00:00.000Z");
  assert.equal(parseDeliveryTerm("5 de noviembre", lunes)?.toISOString(), "2026-11-05T17:00:00.000Z");
  assert.equal(parseDeliveryTerm("1 de septiembre", lunes)?.toISOString(), "2027-09-01T16:00:00.000Z");
  assert.equal(parseDeliveryTerm("29 de febrero", lunes)?.toISOString(), "2028-02-29T17:00:00.000Z");
  assert.equal(parseDeliveryTerm("31 de febrero", lunes), null);
});

test("otro texto no se toca", () => {
  assert.equal(parseDeliveryTerm("lo antes posible", lunes), null);
  assert.equal(parseDeliveryTerm("", lunes), null);
  assert.equal(parseDeliveryTerm(null, lunes), null);
});

test("closed-price: solo NL/PT/DE", () => {
  for (const l of ["nl", "PT", " de "]) assert.equal(isClosedPriceDirectLang(l), true);
  for (const l of ["fr", "en", "ro", "it", "", null, undefined]) assert.equal(isClosedPriceDirectLang(l), false);
});

test("coste del presupuesto multiplica por cantidad", () => {
  assert.equal(quoteCostCents([{ quantity: 1200, supplierUnitCost: 0.06 }]), 7200);
  assert.equal(quoteCostCents([{ quantity: 3, supplierUnitCost: 25 }]), 7500);
  assert.equal(quoteCostCents([{ quantity: null, supplierUnitCost: "30" }]), 3000);
});
