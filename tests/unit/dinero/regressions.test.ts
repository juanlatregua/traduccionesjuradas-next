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
import * as dinero from "../../../lib/dinero/index.ts";

const loose = (x: unknown) => x as any;

test("R2-1: una tarifa con coste 0 no da precio (coste sin informar)", () => {
  assert.equal(rate.priceWithRate({ unit: "doc", costCents: 0, clientCents: 6000 }, { words: 400, pages: 1 }).kind, "noPrice");
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

test("R2-6: ninguna exportación crea un coste ajeno conocido sin base > 0; el suelo de la sugerencia es obligatorio", () => {
  const args: unknown[][] = [[0], [-1], [3000], [0, { kind: "base" }], [3000, { kind: "base" }], [null], [undefined], [[]], [{}], ["3000"], [NaN]];
  const looksLikeCost = (v: unknown): v is { known: boolean; ownWork?: unknown; baseCents?: unknown } =>
    !!v && typeof v === "object" && "known" in (v as object);
  const found: unknown[] = [];
  const visit = (v: unknown) => {
    if (looksLikeCost(v)) found.push(v);
    else if (v && typeof v === "object") for (const x of Object.values(v as object)) if (looksLikeCost(x)) found.push(x);
  };
  for (const fn of Object.values(dinero)) {
    if (typeof fn !== "function") continue;
    for (const a of args) {
      try { visit((fn as (...xs: unknown[]) => unknown)(...a)); } catch { /* rejected input is fine */ }
    }
  }
  assert.ok(found.length > 0);
  for (const c of found as { known: boolean; ownWork?: unknown; baseCents?: unknown }[]) {
    if (c.known && c.ownWork !== true) assert.ok(Number.isSafeInteger(c.baseCents) && (c.baseCents as number) > 0, `coste ajeno conocido con base ${String(c.baseCents)}`);
  }
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

const BAD_COSTS = [0, NaN, -500, "3000", Infinity, 1.5].map((baseCents) => loose({ known: true, baseCents, ownWork: false }));

test("R4-M1: un coste mal formado (cast/JSON) nunca da margen ok", () => {
  for (const c of BAD_COSTS) {
    assert.equal(margin.marginOf(5000, c).class, "unknown", JSON.stringify(c));
    assert.equal(margin.canIssue(5000, c).ok, false);
    assert.equal(margin.pctOverCost(5000, c), null);
  }
  assert.equal(margin.canIssue(5000, loose({ known: true, baseCents: 100, ownWork: true })).ok, false); // own work with a base
  assert.equal(margin.canIssue(5000, loose({ known: true, baseCents: 100 })).ok, false); // ownWork missing
});

test("R4-M1: sumCosts y suggestClientPrice validan el coste en ejecución", () => {
  for (const c of BAD_COSTS) {
    assert.deepEqual(supplier.sumCosts([supplier.costFromStoredBase(1000), c]), supplier.UNKNOWN_COST);
    assert.equal(suggest.suggestClientPrice(c, { floorCents: 4000 }), null);
  }
});

test("R4-M2: zeroAs solo admite los tres regímenes de tipo cero", () => {
  for (const z of ["general", "exento", "", "NOTSUBJECT"]) assert.throws(() => vat.parseVatRate(0, { zeroAs: z as never }), RangeError);
  assert.throws(() => vat.parseVatRate(0.21, { zeroAs: "general" as never }), RangeError);
});

test("R4-M2: parseVatFields es la inversa exacta de vatFields y exige coherencia", () => {
  const parse = loose(vat).parseVatFields;
  for (const r of [vat.VAT_GENERAL_21, vat.VAT_REDUCED_10, vat.VAT_SUPER_REDUCED_4, vat.VAT_NOT_SUBJECT, vat.VAT_REVERSE_CHARGE, vat.VAT_EXEMPT]) {
    assert.deepEqual(parse(vat.vatFields(r)), r);
  }
  assert.throws(() => parse({ vatRate: 0.21, vatRegime: "exempt" }), RangeError);
  assert.throws(() => parse({ vatRate: 0, vatRegime: "general" }), RangeError);
  assert.throws(() => parse({ vatRate: 0, vatRegime: "zero" }), RangeError);
  assert.throws(() => parse({ vatRate: 0.21 }), RangeError);
});

test("R4-M2: un régimen mal formado lanza; nunca NaN en un total", () => {
  for (const bad of [{ kind: "general" }, { kind: "general", rateBp: 1900 }, { kind: "bogus" }, null, "21"]) {
    assert.throws(() => vat.addVat(1000, loose(bad)), RangeError, JSON.stringify(bad));
    assert.throws(() => totals.quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 1000 }], discount: { kind: "none" }, shippingCents: 0, regime: loose(bad) }), RangeError);
  }
});

test("R4-M3: tarifa por 1000 palabras solo donde rige esa unidad (no certificados, ≥ 1000 palabras)", () => {
  const kword = { unit: "per1000Words" as const, costCents: 8000, clientCents: 11000 };
  const cert = rate.priceWithRate(kword, loose({ words: 5, pages: 1 }));
  assert.ok(cert.kind === "noPrice" && /no se cobra por palabra/.test(cert.reason));
  const exact = { ...kword, approved: true };
  const sel = loose(rate.selectRate({ exact, wildcard: null }, { words: 5, pages: 1 }));
  assert.equal(sel.kind, "none");
  const ok = rate.priceWithRate(kword, loose({ words: 2500, pages: 3 }));
  assert.equal(ok.kind, "priced");
});

test("R4-B2: un plazo a 0 es un error", () => {
  assert.throws(() => totals.splitInstallments(1, [50, 50]), RangeError);
  assert.throws(() => totals.splitInstallments(2, [1, 1, 1]), RangeError);
  assert.deepEqual(totals.splitInstallments(3, [1, 1, 1]), [1, 1, 1]);
});

test("R4-B3: el motivo de tamaño dice la tolerancia real (25 %–130 %)", () => {
  const exact = { unit: "doc" as const, costCents: 3000, clientCents: 5000, wordsRef: 300, approved: true };
  const r = loose(rate.selectRate({ exact, wildcard: null }, { words: 50, pages: 1 }));
  assert.equal(r.reason, "el documento no encaja en el tamaño de la tarifa (de 25 % a 130 % de la referencia)");
});

test("R4: splitGross incoherente lleva la cuota que daría la base", () => {
  const g = vat.splitGross(101, vat.VAT_GENERAL_21);
  assert.equal(g.consistent, false);
  assert.equal(loose(g).expectedVat, 17);
  assert.equal("expectedVat" in vat.splitGross(6050, vat.VAT_GENERAL_21), false);
});
