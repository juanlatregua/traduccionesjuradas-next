import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCents, centsFromEuros, eurosFromCents, euroStringFromCents, sumCents, spread, roundUpToEuro, roundDownToEuro, divRoundHalfUp,
} from "../../../lib/dinero/money.ts";
import {
  addVat, splitGross, parseVatRate, vatOn, vatRateFraction, vatFields, VAT_GENERAL_21, VAT_REDUCED_10, VAT_SUPER_REDUCED_4, VAT_NOT_SUBJECT, VAT_EXEMPT, VAT_REVERSE_CHARGE,
} from "../../../lib/dinero/vat.ts";
import { quoteTotals as quoteTotalsResult, invoiceTotalsFromLines, invoiceTotalsFromGross, splitInstallments, lineTotalCents, discountCents, PAPER_SHIPPING_BASE_CENTS } from "../../../lib/dinero/totals.ts";
import { formatEuros, formatEurosPlain } from "../../../lib/dinero/format.ts";
import { AUTO_SEND_CAP_WITH_VAT_CENTS, withinAutoSendCap } from "../../../lib/dinero/limits.ts";

function quoteTotals(input: Parameters<typeof quoteTotalsResult>[0]) {
  const r = quoteTotalsResult(input);
  if (!r.ok) throw new Error(r.error);
  return r.totals;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test("money: conversiones exactas en la frontera", () => {
  assert.equal(centsFromEuros(30.5), 3050);
  assert.equal(centsFromEuros("30.50"), 3050);
  assert.equal(centsFromEuros({ toString: () => "1234.56" }), 123456);
  assert.equal(centsFromEuros(0.1 + 0.2), 30);
  assert.equal(centsFromEuros(1.005), 101);
  assert.equal(centsFromEuros(19.99), 1999);
  assert.equal(centsFromEuros(-2.5), -250);
  assert.equal(centsFromEuros(0), 0);
  assert.equal(centsFromEuros(1e-7), 0);
  assert.throws(() => centsFromEuros("12,50"));
  assert.throws(() => centsFromEuros(NaN));
  assert.throws(() => centsFromEuros(""));
  assert.equal(eurosFromCents(3050), 30.5);
  assert.equal(euroStringFromCents(3050), "30.50");
  assert.equal(euroStringFromCents(-5), "-0.05");
  assert.throws(() => eurosFromCents(1.5));
  assert.throws(() => assertCents(Number.MAX_SAFE_INTEGER + 1));
  const r = rng(1);
  for (let i = 0; i < 5000; i++) {
    const c = Math.floor(r() * 10_000_000);
    assert.equal(centsFromEuros(eurosFromCents(c)), c);
    assert.equal(centsFromEuros(euroStringFromCents(c)), c);
  }
});

test("money: suma, división y redondeo al euro", () => {
  assert.equal(sumCents([100, 250, 1]), 351);
  assert.equal(sumCents([]), 0);
  assert.throws(() => sumCents([1, 0.5]));
  assert.equal(divRoundHalfUp(5, 2), 3);
  assert.equal(divRoundHalfUp(7, 2), 4);
  assert.equal(divRoundHalfUp(1, 3), 0);
  assert.throws(() => divRoundHalfUp(1, 0));
  assert.equal(roundUpToEuro(4001), 4100);
  assert.equal(roundUpToEuro(4000), 4000);
  assert.equal(roundDownToEuro(4099), 4000);
  assert.equal(roundUpToEuro(0), 0);
});

test("money: reparto — el último absorbe el resto y la suma es exacta", () => {
  assert.deepEqual(spread(10000, [1, 1, 1]), [3333, 3333, 3334]);
  assert.deepEqual(spread(10000, [100, 300]), [2500, 7500]);
  assert.deepEqual(spread(10000, [100, 0]), [10000, 0]); // un peso 0 recibe 0
  assert.deepEqual(spread(10000, [0, 1, 0]), [0, 10000, 0]);
  assert.deepEqual(spread(10000, [1, 1, 0]), [5000, 5000, 0]);
  assert.throws(() => spread(100, [NaN, 1]));
  assert.throws(() => spread(100, [-1, 2]));
  assert.throws(() => spread(100, [0, 0]));
  assert.throws(() => spread(100, [1.5, 1]));
  assert.deepEqual(spread(0, [5, 5]), [0, 0]);
  assert.deepEqual(spread(500, []), []);
  assert.deepEqual(spread(2, [1, 1, 1, 1]), [1, 1, 0, 0]); // nunca una parte negativa
  assert.throws(() => spread(-1, [1]));
  const r = rng(2);
  for (let i = 0; i < 3000; i++) {
    const total = Math.floor(r() * 500000);
    const weights = Array.from({ length: 1 + Math.floor(r() * 6) }, () => (r() < 0.2 ? 0 : Math.floor(r() * 3000)));
    if (weights.every((w) => w === 0)) continue;
    const parts = spread(total, weights);
    weights.forEach((w, k) => w === 0 && assert.equal(parts[k], 0));
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
    assert.ok(parts.every((p) => Number.isSafeInteger(p) && p >= 0));
  }
});

test("vat: regla única mitad hacia arriba", () => {
  assert.equal(vatOn(3050, VAT_GENERAL_21), 641); // 640,5 → 641
  assert.equal(vatOn(5000, VAT_GENERAL_21), 1050);
  assert.equal(vatOn(1, VAT_GENERAL_21), 0);
  assert.equal(vatOn(3, VAT_GENERAL_21), 1); // 0,63
  assert.equal(vatOn(5, VAT_REDUCED_10), 1); // 0,5 → 1
  assert.equal(vatOn(10000, VAT_SUPER_REDUCED_4), 400);
  assert.equal(vatOn(-3050, VAT_GENERAL_21), -641); // rectificativa: simétrica
  assert.equal(vatOn(5000, VAT_NOT_SUBJECT), 0);
  assert.deepEqual(addVat(0, VAT_GENERAL_21), { base: 0, vat: 0, total: 0 });
  assert.deepEqual(addVat(6198, VAT_GENERAL_21), { base: 6198, vat: 1302, total: 7500 });
  assert.deepEqual(addVat(5000, VAT_EXEMPT), { base: 5000, vat: 0, total: 5000 });
  assert.deepEqual(addVat(5000, VAT_REVERSE_CHARGE), { base: 5000, vat: 0, total: 5000 });
  assert.throws(() => addVat(-1, VAT_GENERAL_21));
  assert.throws(() => addVat(1.5, VAT_GENERAL_21));
});

test("vat: splitGross conserva el total cobrado", () => {
  assert.deepEqual(splitGross(6050, VAT_GENERAL_21), { base: 5000, vat: 1050, total: 6050, consistent: true });
  // keeps the 1,01 € charged, but 0,18 ≠ round(0,83 × 21 %) = 0,17: an invoice from it is incoherent
  assert.deepEqual(splitGross(101, VAT_GENERAL_21), { base: 83, vat: 18, total: 101, consistent: false, expectedVat: 17 });
  assert.deepEqual(splitGross(7500, VAT_NOT_SUBJECT), { base: 7500, vat: 0, total: 7500, consistent: true });
  assert.deepEqual(splitGross(0, VAT_GENERAL_21), { base: 0, vat: 0, total: 0, consistent: true });
  assert.throws(() => splitGross(-100, VAT_GENERAL_21));
});

test("vat: propiedades base+vat=total y splitGross sobre muchos importes", () => {
  for (const regime of [VAT_GENERAL_21, VAT_REDUCED_10, VAT_SUPER_REDUCED_4, VAT_NOT_SUBJECT]) {
    for (let c = 0; c <= 60000; c += 7) {
      const a = addVat(c, regime);
      assert.equal(a.base + a.vat, a.total);
      const g = splitGross(c, regime);
      assert.equal(g.consistent, g.vat === vatOn(g.base, regime));
      assert.equal(g.total, c);
      assert.equal(g.base + g.vat, c);
      // the base found is the closest base to total/(1+r)
      assert.ok(Math.abs(g.base * (10000 + (regime.kind === "general" ? regime.rateBp : 0)) - c * 10000) <= (10000 + (regime.kind === "general" ? regime.rateBp : 0)) / 2);
    }
  }
});

test("vat: parser de vatRate explícito, nunca cae a 21 %", () => {
  assert.deepEqual(parseVatRate(0.21), VAT_GENERAL_21);
  assert.deepEqual(parseVatRate("0.2100"), VAT_GENERAL_21);
  assert.deepEqual(parseVatRate(21), VAT_GENERAL_21);
  assert.deepEqual(parseVatRate("21"), VAT_GENERAL_21);
  assert.deepEqual(parseVatRate({ toString: () => "0.21" }), VAT_GENERAL_21);
  assert.deepEqual(parseVatRate(0.1), VAT_REDUCED_10);
  assert.deepEqual(parseVatRate(4), VAT_SUPER_REDUCED_4);
  assert.deepEqual(parseVatRate(0, { zeroAs: "notSubject" }), VAT_NOT_SUBJECT);
  assert.deepEqual(parseVatRate("0.0000", { zeroAs: "exempt" }), VAT_EXEMPT);
  assert.throws(() => parseVatRate(0));
  assert.throws(() => parseVatRate(null));
  assert.throws(() => parseVatRate(undefined));
  assert.throws(() => parseVatRate(""));
  assert.throws(() => parseVatRate("abc"));
  assert.throws(() => parseVatRate(0.19));
  assert.throws(() => parseVatRate(-0.21));
  assert.throws(() => parseVatRate(1));
  assert.throws(() => parseVatRate(true));
  assert.throws(() => parseVatRate([0.21]));
  assert.throws(() => parseVatRate({}));
  assert.throws(() => parseVatRate({ rate: 0.21 }));
  assert.throws(() => parseVatRate({ toString: () => "veintiuno" }));
  assert.deepEqual(vatFields(VAT_REVERSE_CHARGE), { vatRate: 0, vatRegime: "reverseCharge" });
  assert.deepEqual(vatFields(VAT_EXEMPT), { vatRate: 0, vatRegime: "exempt" });
  assert.deepEqual(vatFields(VAT_GENERAL_21), { vatRate: 0.21, vatRegime: "general" });
  assert.equal(vatRateFraction(VAT_GENERAL_21), 0.21);
  assert.equal(vatRateFraction(VAT_NOT_SUBJECT), 0);
});

test("totals: presupuesto — líneas, descuento, envío e IVA una sola vez", () => {
  const t = quoteTotals({
    lines: [{ quantity: 1, unitPriceCents: 12350 }, { quantity: "2.00", unitPriceCents: 3000 }],
    discount: { kind: "percent", percent: 10 },
    shippingCents: PAPER_SHIPPING_BASE_CENTS,
    regime: VAT_GENERAL_21,
  });
  assert.deepEqual(t.lineTotals, [12350, 6000]);
  assert.equal(t.subtotal, 18350);
  assert.equal(t.discount, 1835);
  assert.equal(t.shipping, 1200);
  assert.equal(t.taxableBase, 17715);
  assert.equal(t.vat, 3720); // 3720,15
  assert.equal(t.total, 21435);
  assert.equal(lineTotalCents({ quantity: 1.5, unitPriceCents: 3333 }), 5000); // 4999,5 → 5000
  assert.equal(lineTotalCents({ quantity: 0, unitPriceCents: 3333 }), 0);
  assert.throws(() => lineTotalCents({ quantity: -1, unitPriceCents: 100 }));
  assert.throws(() => lineTotalCents({ quantity: 1, unitPriceCents: -100 }));
});

test("totals: un descuento mayor que el subtotal es un error tipado, no un tope", () => {
  for (const discount of [{ kind: "fixed" as const, cents: 9000 }, { kind: "percent" as const, percent: 150 }]) {
    const r = quoteTotalsResult({ lines: [{ quantity: 1, unitPriceCents: 5000 }], discount, shippingCents: 1200, regime: VAT_GENERAL_21 });
    assert.ok(!r.ok && r.error === "discount_exceeds_subtotal" && r.subtotal === 5000);
  }
  assert.equal(quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 5000 }], discount: { kind: "fixed", cents: 5000 }, shippingCents: 1200, regime: VAT_GENERAL_21 }).total, 1452);
  assert.equal(discountCents(5000, { kind: "percent", percent: "7.5" }), 375);
  assert.equal(discountCents(5000, { kind: "none" }), 0);
  assert.throws(() => discountCents(5000, { kind: "fixed", cents: -1 }));
  const ns = quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 5000 }], discount: { kind: "none" }, shippingCents: 0, regime: VAT_NOT_SUBJECT });
  assert.equal(ns.vat, 0);
  assert.equal(ns.total, 5000);
});

test("totals: propiedad base+IVA=total en presupuestos aleatorios", () => {
  const r = rng(3);
  for (let i = 0; i < 3000; i++) {
    const lines = Array.from({ length: 1 + Math.floor(r() * 5) }, () => ({ quantity: Math.floor(r() * 400) / 100, unitPriceCents: Math.floor(r() * 30000) }));
    const discount = r() < 0.5 ? { kind: "percent" as const, percent: Math.floor(r() * 30) } : { kind: "fixed" as const, cents: Math.floor(r() * 5000) };
    const res = quoteTotalsResult({ lines, discount, shippingCents: 0, regime: VAT_GENERAL_21 });
    if (!res.ok) { assert.ok(res.discount > res.subtotal); continue; }
    const t = quoteTotals({ lines, discount, shippingCents: r() < 0.5 ? 0 : 1200, regime: VAT_GENERAL_21 });
    assert.equal(t.subtotal, t.lineTotals.reduce((a, b) => a + b, 0));
    assert.equal(t.taxableBase, t.subtotal - t.discount + t.shipping);
    assert.ok(t.discount <= t.subtotal && t.taxableBase >= 0);
    assert.equal(t.taxableBase + t.vat, t.total);
  }
});

test("totals: facturas desde líneas y desde bruto; rectificativas negativas", () => {
  assert.deepEqual(invoiceTotalsFromLines([5000, 2500], VAT_GENERAL_21), { base: 7500, vat: 1575, total: 9075 });
  assert.deepEqual(invoiceTotalsFromLines([], VAT_GENERAL_21), { base: 0, vat: 0, total: 0 });
  assert.throws(() => invoiceTotalsFromLines([-5000], VAT_GENERAL_21));
  assert.deepEqual(invoiceTotalsFromLines([-3050], VAT_GENERAL_21, { allowNegative: true }), { base: -3050, vat: -641, total: -3691 });
  assert.deepEqual(invoiceTotalsFromGross(6050, VAT_GENERAL_21), { base: 5000, vat: 1050, total: 6050, consistent: true });
});

test("totals: plazos suman exactamente el total", () => {
  assert.deepEqual(splitInstallments(287980, [40, 60]), [115192, 172788]);
  assert.deepEqual(splitInstallments(37752, [50, 50]), [18876, 18876]);
  assert.deepEqual(splitInstallments(10001, [50, 50]), [5001, 5000]);
  assert.throws(() => splitInstallments(100, []));
  assert.throws(() => splitInstallments(100, [0, 100]));
  const r = rng(4);
  for (let i = 0; i < 2000; i++) {
    const total = Math.floor(r() * 400000);
    const parts = splitInstallments(total, [1 + Math.floor(r() * 99), 1 + Math.floor(r() * 99), 1 + Math.floor(r() * 99)]);
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
  }
});

test("format: euros es-ES", () => {
  assert.equal(formatEuros(123456), "1.234,56 €");
  assert.equal(formatEuros(0), "0,00 €");
  assert.equal(formatEuros(5), "0,05 €");
  assert.equal(formatEuros(-123456789), "-1.234.567,89 €");
  assert.equal(formatEurosPlain(100000), "1.000,00");
  assert.equal(formatEurosPlain(99999), "999,99");
});

test("limits: tope de envío solo sobre el total CON IVA", () => {
  assert.equal(AUTO_SEND_CAP_WITH_VAT_CENTS, 30000);
  assert.equal(withinAutoSendCap(30000), true);
  assert.equal(withinAutoSendCap(30001), false);
  assert.equal(withinAutoSendCap(0), true);
  assert.throws(() => withinAutoSendCap(-1));
});
