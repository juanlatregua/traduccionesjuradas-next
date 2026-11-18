// One test per fix from the adversarial reviews (rounds 2 and 3). Namespace imports so that,
// run against an older lib/dinero, each test fails on its own instead of the whole file.
import test from "node:test";
import assert from "node:assert/strict";
import * as margin from "../../../lib/dinero/margin.ts";
import * as money from "../../../lib/dinero/money.ts";
import * as rate from "../../../lib/dinero/rate.ts";
import * as suggest from "../../../lib/dinero/suggest.ts";
import * as supplier from "../../../lib/dinero/supplier.ts";
import * as totals from "../../../lib/dinero/totals.ts";
import * as vat from "../../../lib/dinero/vat.ts";

const loose = (x: unknown) => x as any;

test("R2-1: una tarifa con coste 0 no da precio (coste sin informar)", () => {
  assert.equal(rate.priceWithRate({ unit: "doc", costCents: 0, clientCents: 6000 }, 400).kind, "noPrice");
});

test("R2-1: coste 0 de jurado ajeno bloquea la emisión", () => {
  const r = margin.canIssue(5000, supplier.costFromStoredBase(0));
  assert.ok(!r.ok && /sin informar/i.test(r.reason));
});

test("R2-2: splitGross dice si su cuota es coherente con la base", () => {
  assert.equal(loose(vat.splitGross(101, vat.VAT_GENERAL_21)).consistent, false);
  assert.equal(loose(vat.splitGross(6050, vat.VAT_GENERAL_21)).consistent, true);
});

test("R2-3: trabajo propio sin ingreso es pérdida", () => {
  assert.equal(margin.marginOf(0, supplier.OWN_WORK).class, "loss");
  assert.equal(margin.canIssue(0, supplier.OWN_WORK).ok, false);
});

test("R2-4: líquido del jurado con IVA e IRPF redondeados por separado", () => {
  const daniela = { kind: "payable", vatBp: 2100, irpfBp: 1500 } as const;
  assert.equal(supplier.fromBase(23, daniela), 25);
  assert.deepEqual(supplier.toBase(24, daniela), { baseCents: 22, exact: true });
});

test("R2-5: descuento mayor que el subtotal es un error tipado", () => {
  const r = loose(totals.quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 5000 }], discount: { kind: "fixed", cents: 6000 }, shippingCents: 1200, regime: vat.VAT_GENERAL_21 }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "discount_exceeds_subtotal");
});

test("R2-6: no hay constructor de coste a pelo y el suelo de la sugerencia es obligatorio", () => {
  assert.equal(loose(supplier).knownCost, undefined);
  assert.throws(() => suggest.suggestClientPrice(supplier.OWN_WORK, loose({})));
});

test("R2-8: spread — peso 0 recibe 0; NaN, negativos o todo ceros lanzan", () => {
  assert.deepEqual(money.spread(9000, [5, 0, 5]), [4500, 0, 4500]);
  assert.throws(() => money.spread(100, [0, 0]));
  assert.throws(() => money.spread(100, [NaN, 1]));
  assert.throws(() => money.spread(100, [-1, 2]));
});

test("R2-9: parseVatRate rechaza arrays y objetos cualesquiera", () => {
  assert.throws(() => vat.parseVatRate([0.21]));
  assert.throws(() => vat.parseVatRate({ rate: 0.21 }));
});

test("R2-10: al escribir el IVA se guarda también el régimen", () => {
  assert.deepEqual(loose(vat).vatFields(vat.VAT_REVERSE_CHARGE), { vatRate: 0, vatRegime: "reverseCharge" });
});

test("R2-11: tarifa por documento sin referencia de tamaño no se aplica", () => {
  const exact = { unit: "doc" as const, costCents: 3000, clientCents: 5000, wordsRef: null, approved: true };
  const r = loose(rate.selectRate({ exact, wildcard: null }, { words: 9000, pages: 30 }));
  assert.equal(r?.kind, "none");
  assert.equal(r?.reason, "tarifa sin referencia de tamaño");
});

test("R3-1: documento sin recuento no encaja en una tarifa por documento", () => {
  assert.equal(rate.fitsDocSize(null, 300), false);
  const exact = { unit: "doc" as const, costCents: 3000, clientCents: 5000, wordsRef: 300, approved: true };
  const r = loose(rate.selectRate({ exact, wildcard: null }, { words: null, pages: 1 }));
  assert.equal(r?.kind, "none");
  assert.equal(r?.reason, "documento sin recuento: no se puede comprobar el tamaño");
});
