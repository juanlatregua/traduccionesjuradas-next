// Parity of lib/dinero against the code in production. Every difference found is
// asserted as a documented category; anything else fails the test.
import test from "node:test";
import assert from "node:assert/strict";
import { computeBase } from "../../../lib/pricing-engine/calculator.ts";
import { computePagePricing } from "../../../lib/pricing-engine/page-pricing.ts";
import { autoClientPriceCentsFromCost, computeQuoteTotals } from "../../../lib/quote-math.ts";
import { priceDocWithRate, fitsDocSize as oldFitsDocSize, canAutoQuote, evaluateLinesMargin } from "../../../lib/learned-rates-math.ts";
import { channelPriceToBaseCents, baseToChannelPriceCents, spreadCents } from "../../../lib/lavori-directo-math.ts";
import { computeLineTotals, totalsFromGross } from "../../../lib/invoice-math.ts";
import { regularizacionFlatApplies } from "../../../lib/regularizacion-price.ts";
import { priceFrToEs, frSameDayCents } from "../../../lib/dinero/tariff-fr.ts";
import { estimateInternalCost } from "../../../lib/dinero/estimate.ts";
import { priceWithRate, fitsDocSize } from "../../../lib/dinero/rate.ts";
import { suggestClientPrice } from "../../../lib/dinero/suggest.ts";
import { costFromStoredBase, toBase, fromBase } from "../../../lib/dinero/supplier.ts";
import { canIssue } from "../../../lib/dinero/margin.ts";
import { spread } from "../../../lib/dinero/money.ts";
import { addVat, splitGross, VAT_GENERAL_21 } from "../../../lib/dinero/vat.ts";
import { quoteTotals } from "../../../lib/dinero/totals.ts";

const toC = (eur: number) => Math.round(eur * 100);
const round2NoEps = (n: number) => Math.round(n * 100) / 100; // the engine's own round2
/** Old value was a float that should have been an exact half cent and rounded down by float error. */
const isFloatHalfDown = (oldRawEur: number, oldC: number, newC: number) =>
  newC - oldC === 1 && Math.abs(oldRawEur * 100 - (oldC + 0.5)) < 1e-6;

const TYPES = [
  "birth_certificate", "marriage_certificate", "death_certificate", "criminal_record", "passport", "id_card", "degree",
  "transcript", "grades", "bank_statement", "company_registration", "contract", "power_of_attorney", "divorce_decree",
  "apostille", "payslip", "medical_report", "tax_return", "other", "residence_permit",
];
const CX = ["standard", "complex", "highly_complex"] as const;
// whole and fractional pages (the analysis may send 1.5)
const PAGES_FR = [...Array.from({ length: 26 }, (_, i) => i), 0.5, 1.5, 2.5, 3.5, 12.5];

test("paridad tariff-fr ↔ computeBase/computePagePricing (FR→ES)", () => {
  let same = 0;
  const diffs: Record<string, number> = {};
  for (const t of TYPES) for (const pages of PAGES_FR) for (const words of [null, 0, 300, 900, 901, 1000, 2500, 7777])
    for (const ap of [false, true]) for (const sep of ap ? [false, true] : [false]) for (const bank of [1, 5]) for (const cat of [null, "legal"]) for (const cx of CX) {
      const old = computeBase({ specificType: t, foreignLang: "fr", words: words as number, pages, complexity: cx, hasApostille: ap, inbound: true, apostilleSeparatePage: sep, bankStatementsInQuote: bank, category: cat });
      const oldC = toC(round2NoEps(old.basePrice));
      const nw = priceFrToEs({ docType: t, pages, words, apostille: ap, apostilleOnSeparatePage: sep, bankStatementsInQuote: bank, category: cat, complexity: cx });
      if (nw.kind === "priced" && nw.cents === oldC) {
        same++;
        if (old.pagePricing) assert.equal(toC(computePagePricing({ specificType: t, foreignLang: "fr", inbound: true, pages, hasApostille: ap, apostilleSeparatePage: sep, bankStatementsInQuote: bank, words, category: cat })!.priceEur), nw.cents);
        const oldUrgentRaw = old.basePrice * 1.4;
        const oldUrgent = toC(round2NoEps(oldUrgentRaw));
        const newUrgent = frSameDayCents(nw.cents);
        if (oldUrgent !== newUrgent) {
          if (isFloatHalfDown(oldUrgentRaw, oldUrgent, newUrgent)) diffs.urgentHalfCent = (diffs.urgentHalfCent || 0) + 1;
          else {
            // DOCUMENTED: per-word base with fractional cents — old applies +40 % to the unrounded base, new to the published price.
            assert.ok(nw.rule === "perWord" && Math.abs(newUrgent - oldUrgent) === 1, `urgente ${t} ${pages}p ${words}w: ${oldUrgent} vs ${newUrgent}`);
            diffs.urgentOnRoundedBase = (diffs.urgentOnRoundedBase || 0) + 1;
          }
        }
        continue;
      }
      // DOCUMENTED: per-word without a word count — old prices the bare minimum (35/55 €), new gives «sin tarifa».
      if (nw.kind === "noTariff" && t !== "apostille" && !words && !old.pagePricing && !old.fixedPriceApplied && old.basePrice === old.minimum + old.apostilleSurcharge) {
        diffs.perWordWithoutWords = (diffs.perWordWithoutWords || 0) + 1;
        continue;
      }
      // DOCUMENTED: a lone apostille — old prices it per word (min 35 €) inside the engine; checkout rejects it; new gives «sin tarifa».
      if (nw.kind === "noTariff" && t === "apostille") {
        diffs.looseApostille = (diffs.looseApostille || 0) + 1;
        continue;
      }
      assert.fail(`diferencia no documentada: ${JSON.stringify({ t, pages, words, ap, sep, bank, cat, cx, oldC, nw })}`);
    }
  assert.ok(same > 120000);
  assert.deepEqual(Object.keys(diffs).sort(), ["looseApostille", "perWordWithoutWords", "urgentOnRoundedBase"]);
  // concrete examples
  assert.equal(toC(computeBase({ specificType: "contract", foreignLang: "fr", words: 0, pages: 1, inbound: true }).basePrice), 3500);
  assert.equal(priceFrToEs({ docType: "contract", pages: 1, words: 0, apostille: false }).kind, "noTariff");
  // contract, 901 words, complex: base 86,496 € → published 86,50 €; urgent old 121,09 (86,496 × 1,4), new 121,10 (86,50 × 1,4)
  const c901 = computeBase({ specificType: "contract", foreignLang: "fr", words: 901, pages: 1, complexity: "complex", inbound: true });
  assert.equal(toC(round2NoEps(c901.basePrice)), 8650);
  assert.equal(toC(round2NoEps(c901.basePrice * 1.4)), 12109);
  const n901 = priceFrToEs({ docType: "contract", pages: 1, words: 901, complexity: "complex", apostille: false });
  assert.ok(n901.kind === "priced" && n901.cents === 8650 && frSameDayCents(n901.cents) === 12110);
});

test("paridad regularización ↔ regularizacionFlatApplies", () => {
  for (const t of TYPES) for (let pages = 0; pages <= 6; pages++) {
    const old = regularizacionFlatApplies({ purposeIsRegularizacion: true, foreignLang: "fr", pages, isFrenchCriminalRecord: t === "criminal_record" && pages >= 3 });
    const nw = priceFrToEs({ docType: t, pages, words: 300, apostille: false, regularization: true });
    assert.equal(old, nw.kind === "priced" && nw.rule === "regularization", `${t} ${pages}`);
    if (old) assert.ok(nw.kind === "priced" && nw.cents === 2500);
  }
});

test("paridad estimate ↔ computeBase (no francés)", () => {
  let same = 0, halfCent = 0, urgentHalfCent = 0;
  for (const l of ["en", "de", "nl", "it", "pt", "ca", "sv", "no", "ar", "ro"]) for (const t of TYPES) for (const pages of [0, 1, 1.5, 2, 2.5, 3, 4])
    for (let words = 0; words <= 3000; words += 37) for (const cx of CX) for (const ap of [false, true]) {
      const old = computeBase({ specificType: t, foreignLang: l, words, pages, complexity: cx, hasApostille: ap, inbound: true });
      const nw = estimateInternalCost({ lang: l, docType: t, words, pages, complexity: cx, apostille: ap });
      assert.equal(nw.kind, "internalCostEstimate");
      if (nw.kind !== "internalCostEstimate") continue;
      const oldC = toC(round2NoEps(old.basePrice));
      if (oldC === nw.internalCostCents) same++;
      else {
        // DOCUMENTED rounding: words × rate × complexity lands on an exact half cent that the float rounds down.
        assert.ok(isFloatHalfDown(old.basePrice, oldC, nw.internalCostCents), `${l} ${t} ${words}: ${oldC} vs ${nw.internalCostCents}`);
        halfCent++;
      }
      const oldU = toC(round2NoEps(old.basePrice * 1.25));
      if (oldU !== nw.urgentInternalCostCents) {
        assert.ok(isFloatHalfDown(old.basePrice * 1.25, oldU, nw.urgentInternalCostCents), `urgente ${l} ${t} ${words}`);
        urgentHalfCent++;
      }
    }
  assert.ok(same > 480000 && halfCent > 0 && urgentHalfCent > 0);
  // concrete: 555 words EN highly complex = 91,575 € → old 91,57, new 91,58
  assert.equal(toC(round2NoEps(computeBase({ specificType: "birth_certificate", foreignLang: "en", words: 555, pages: 1, complexity: "highly_complex", inbound: true }).basePrice)), 9157);
  const e = estimateInternalCost({ lang: "en", docType: "birth_certificate", words: 555, pages: 1, complexity: "highly_complex", apostille: false });
  assert.ok(e.kind === "internalCostEstimate" && e.internalCostCents === 9158);
  // DOCUMENTED: a language outside the table — old silently uses 0,10 €/word; new gives no estimate.
  assert.ok(computeBase({ specificType: "contract", foreignLang: "ru", words: 1000, pages: 1, inbound: true }).basePrice > 0);
  assert.equal(estimateInternalCost({ lang: "ru", docType: "contract", words: 1000, pages: 1, apostille: false }).kind, "noEstimate");
});

test("paridad suggest ↔ autoClientPriceCentsFromCost", () => {
  let halfCent = 0;
  for (const floor of [0, 4000]) for (let cost = 0; cost <= 100000; cost++) {
    const old = autoClientPriceCentsFromCost(cost, floor);
    const sug = suggestClientPrice(costFromStoredBase(cost), { floorCents: floor });
    if (cost === 0) {
      // DOCUMENTED: cost 0 = not informed — old suggests the floor; new suggests nothing.
      assert.ok(sug === null && old === floor);
      continue;
    }
    const nw = sug!.suggestedCents;
    if (old === nw) continue;
    // DOCUMENTED rounding: cost × 1,30/1,25/1,20 is an exact half cent; old round2 in euros loses it to float error.
    const band = cost < 10000 ? 130 : cost < 19000 ? 125 : 120;
    assert.ok(nw - old === 1 && (cost * band) % 100 === 50, `coste ${cost} suelo ${floor}: ${old} vs ${nw}`);
    halfCent++;
  }
  assert.ok(halfCent > 0);
  assert.equal(autoClientPriceCentsFromCost(3355, 0), 4361); // 43,615 €
  assert.equal(suggestClientPrice(costFromStoredBase(3355), { floorCents: 0 })!.suggestedCents, 4362);
});

test("paridad supplier ↔ channelPriceToBaseCents / baseToChannelPriceCents (0–3000 €)", () => {
  const BASE = { kind: "base" } as const;
  const DANIELA = { kind: "payable", vatBp: 2100, irpfBp: 1500 } as const;
  const NIELSON = { kind: "totalWithVat", vatBp: 2100 } as const;
  const tally = { payableToBase: 0, payableFromBase: 0, payableInexact: 0, totalInexact: 0 };
  for (let x = 0; x <= 300000; x++) {
    assert.equal(toBase(x, BASE).baseCents, channelPriceToBaseCents(x, "base"));
    assert.equal(fromBase(x, BASE), baseToChannelPriceCents(x, "base"));
    // total con IVA: a single VAT rounding, same as ×1,21 in one step
    const t = toBase(x, NIELSON);
    assert.equal(t.baseCents, channelPriceToBaseCents(x, "total_con_iva"));
    assert.equal(fromBase(x, NIELSON), baseToChannelPriceCents(x, "total_con_iva"));
    if (!t.exact) tally.totalInexact++;
    // líquido: the real invoice rounds VAT and IRPF separately; old does ×1,06 in one step
    const p = toBase(x, DANIELA);
    if (!p.exact) tally.payableInexact++;
    const dTo = p.baseCents - channelPriceToBaseCents(x, "payable_iva_irpf");
    const dFrom = fromBase(x, DANIELA) - baseToChannelPriceCents(x, "payable_iva_irpf");
    assert.ok(Math.abs(dTo) <= 1 && Math.abs(dFrom) <= 1, `líquido ${x}`);
    if (dTo) tally.payableToBase++;
    if (dFrom) tally.payableFromBase++;
  }
  // DOCUMENTED (0–3000 €, 300.001 figures): líquido → base differs from ×1,06 in 25.471 figures by ±1 c,
  // base → líquido in 69.000 bases by ±1 c; 48.113 líquido figures and 52.066 «total con IVA» figures are
  // reachable by no base (closest returned, exact: false). «total con IVA» matches the old code exactly.
  assert.deepEqual(tally, { payableToBase: 25471, payableFromBase: 69000, payableInexact: 48113, totalInexact: 52066 });
  // concrete: 0,24 € líquidos — base 0,22 (0,22 + 0,05 − 0,03 = 0,24); old says 0,23, whose invoice gives 0,25
  assert.equal(channelPriceToBaseCents(24, "payable_iva_irpf"), 23);
  assert.deepEqual(toBase(24, DANIELA), { baseCents: 22, exact: true });
  assert.equal(fromBase(23, DANIELA), 25);
});

test("paridad rate ↔ priceDocWithRate, canAutoQuote y fitsDocSize (coste 0 y costes pequeños incluidos)", () => {
  const costs = [0, 1, 5, 50, 99, 100, 500, 999, ...Array.from({ length: 77 }, (_, i) => 1000 + i * 250)];
  for (const unit of ["doc", "kword"] as const) for (const cost of costs) for (let cl = 1000; cl <= 30000; cl += 333)
    for (const w of [1, 250, 999, 1000, 1234, 2500, 4321]) {
      const old = priceDocWithRate({ unit, costCents: cost, clientCents: cl }, w);
      const nw = priceWithRate({ unit: unit === "kword" ? "per1000Words" : "doc", costCents: cost, clientCents: cl }, w);
      const oldOk = canAutoQuote(old.clientCents, old.costCents);
      if (nw.kind === "noPrice") {
        // cost 0 = not informed: the old code refuses it too (margin % over a 0 cost is 0)
        assert.ok(cost === 0 && !oldOk, `noPrice ${unit} ${cost} ${cl} ${w}`);
        continue;
      }
      assert.equal(nw.clientCents, old.clientCents);
      assert.equal(nw.costCents, old.costCents);
      if (nw.costCents === 0) {
        // per 1000 words with a tiny cost rounds the document cost to 0: both refuse
        assert.ok(nw.kind === "blocked" && !oldOk);
        continue;
      }
      assert.equal(nw.kind === "priced", oldOk, `${unit} ${cost} ${cl} ${w}`);
    }
  for (let w = 1; w <= 3000; w++) for (let r = 1; r <= 2000; r += 7) assert.equal(fitsDocSize(w, r), oldFitsDocSize(w, r));
  // DOCUMENTED: a document without word count — old accepts it against any reference; new: size unknown, does not fit.
  for (const w of [0, null, undefined]) {
    assert.equal(oldFitsDocSize(w, 300), true);
    assert.equal(fitsDocSize(w, 300), false);
  }
  // DOCUMENTED: a per-document tariff without wordsRef — old applies it to any size (a 30-page document); new: not applicable.
  assert.equal(oldFitsDocSize(9000, null), true);
  assert.equal(fitsDocSize(9000, null), false);
  // DOCUMENTED: a tariff without its client price — old invents it with the suggestion rule; new refuses.
  assert.equal(priceDocWithRate({ unit: "doc", costCents: 3000, clientCents: null }, 300).clientCents, 4000);
  assert.equal(priceWithRate({ unit: "doc", costCents: 3000, clientCents: null }, 300).kind, "noPrice");
});

test("paridad margen ↔ evaluateLinesMargin (una línea no FR, coste 0 incluido)", () => {
  for (const cost of [0, 1, 10, 99, 100, 101, 1000, 3333, 5000, 9999]) for (let price = 0; price <= 12000; price += 5) {
    const old = evaluateLinesMargin([{ quantity: 1, unitPrice: price / 100, supplierUnitCost: cost / 100 }], { isFrench: false });
    const nw = canIssue(price, costFromStoredBase(cost));
    if (price === 0) {
      // DOCUMENTED: nothing charged — old has no priced line and passes; new: no cost informed or a loss → blocked
      assert.equal(nw.ok, false);
      continue;
    }
    if (price === 500 && cost === 0) {
      // DOCUMENTED: old exempts the loose 5 € apostille without cost; new never issues an external line without cost
      assert.ok(old.ok && !nw.ok);
      continue;
    }
    assert.equal(nw.ok, old.ok, `precio ${price} coste ${cost}`);
  }
});

test("paridad spread ↔ spreadCents", () => {
  for (let t = 0; t <= 5000; t++) for (const ws of [[1, 1, 1], [1, 2], [300, 700, 1], [3, 3, 1], [1000, 1], [7]]) {
    assert.deepEqual(spread(t, ws), spreadCents(t, ws));
  }
  // DOCUMENTED old bug: 2 c among 4 equal parts → old leaves −1 c in the last part.
  assert.deepEqual(spreadCents(2, [1, 1, 1, 1]), [1, 1, 1, -1]);
  assert.deepEqual(spread(2, [1, 1, 1, 1]), [1, 1, 0, 0]);
  // DOCUMENTED: a 0 weight — old switches everything to equal parts; new gives that part 0. Old accepts NaN.
  assert.deepEqual(spreadCents(9000, [5, 0, 5]), [3000, 3000, 3000]);
  assert.deepEqual(spread(9000, [5, 0, 5]), [4500, 0, 4500]);
  assert.deepEqual(spreadCents(900, [NaN, 1, 1]), [300, 300, 300]);
  assert.throws(() => spread(900, [NaN, 1, 1]));
});

test("paridad IVA ↔ factura (igual) y ↔ presupuesto (difiere en las medias)", () => {
  let quoteHalf = 0;
  for (let b = 0; b <= 200000; b++) {
    const nw = addVat(b, VAT_GENERAL_21);
    assert.equal(nw.vat, computeLineTotals([{ description: "x", amountCents: b }], 0.21).vatCents);
    assert.equal(splitGross(b, VAT_GENERAL_21).base, totalsFromGross(b, 0.21).baseCents);
    const q = computeQuoteTotals({ lines: [{ description: "x", quantity: 1, unitPrice: b / 100 }], discountType: "NONE", discountValue: 0, vatRate: 0.21, deliveryType: "DIGITAL_PDF" });
    if (toC(q.vatAmount) !== nw.vat) {
      // DOCUMENTED (G3): quote VAT in float euros rounds some exact halves down.
      assert.ok(nw.vat - toC(q.vatAmount) === 1 && (b * 21) % 100 === 50, `base ${b}`);
      quoteHalf++;
    }
  }
  assert.ok(quoteHalf > 0);
  assert.equal(toC(computeQuoteTotals({ lines: [{ description: "x", quantity: 1, unitPrice: 30.5 }], discountType: "NONE", discountValue: 0, vatRate: 0.21, deliveryType: "DIGITAL_PDF" }).vatAmount), 640);
  assert.equal(addVat(3050, VAT_GENERAL_21).vat, 641);
});

test("paridad quoteTotals ↔ computeQuoteTotals (cantidades fraccionarias, descuento, envío)", () => {
  let s = 7;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const t = { vatHalf: 0, discountError: 0, discountHalf: 0, lineHalf: 0, same: 0 };
  for (let i = 0; i < 20000; i++) {
    const lines = Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ quantity: [0.5, 1, 1.5, 2, 3][Math.floor(r() * 5)], unitPriceCents: Math.floor(r() * 40000) }));
    const pct = r() < 0.4;
    const value = pct ? [0, 5, 10, 15, 20, 150][Math.floor(r() * 6)] : Math.floor(r() * 50000);
    const paper = r() < 0.3;
    const old = computeQuoteTotals({
      lines: lines.map((l) => ({ description: "x", quantity: l.quantity, unitPrice: l.unitPriceCents / 100 })),
      discountType: pct ? "PERCENT" : "FIXED", discountValue: pct ? value : value / 100, vatRate: 0.21, deliveryType: paper ? "PAPER_SHIP" : "DIGITAL_PDF", shippingBase: 12,
    });
    const res = quoteTotals({ lines, discount: pct ? { kind: "percent", percent: value } : { kind: "fixed", cents: value }, shippingCents: paper ? 1200 : 0, regime: VAT_GENERAL_21 });
    if (!res.ok) {
      // DOCUMENTED decision: a discount above the subtotal is a typed error; old caps it at subtotal + shipping.
      assert.ok(res.error === "discount_exceeds_subtotal" && toC(old.discountAmount) >= toC(old.subtotal) && Math.abs(toC(old.subtotal) - res.subtotal) <= lines.length);
      t.discountError++;
      continue;
    }
    const nw = res.totals;
    const oldLines = old.lines.map((l) => toC(l.lineTotal));
    if (nw.subtotal !== toC(old.subtotal)) {
      // DOCUMENTED rounding: qty 0,5/1,5 × odd cents is an exact half; old float sometimes rounds it down.
      nw.lineTotals.forEach((c, k) => {
        if (c !== oldLines[k]) assert.ok(c - oldLines[k] === 1 && (lines[k].quantity * 100 * lines[k].unitPriceCents) % 100 === 50, `línea ${lines[k].quantity} × ${lines[k].unitPriceCents}`);
      });
      t.lineHalf++;
      continue;
    }
    if (nw.discount !== toC(old.discountAmount)) {
      // DOCUMENTED rounding: percent discount on an exact half cent, old float rounds it down.
      assert.ok(pct && nw.discount - toC(old.discountAmount) === 1 && (nw.subtotal * value * 100) % 10000 === 5000);
      t.discountHalf++;
      continue;
    }
    if (nw.vat !== toC(old.vatAmount)) {
      assert.ok(nw.vat - toC(old.vatAmount) === 1 && (nw.taxableBase * 21) % 100 === 50);
      t.vatHalf++;
    } else t.same++;
    assert.equal(nw.total - nw.vat, toC(old.total) - toC(old.vatAmount));
  }
  assert.ok(t.vatHalf > 0 && t.discountError > 0 && t.discountHalf > 0 && t.same > 10000, JSON.stringify(t));
  // concrete: 15 % of 1.070,10 € = 160,515 € → old 160,51, new 160,52
  assert.equal(toC(computeQuoteTotals({ lines: [{ description: "x", quantity: 1, unitPrice: 1070.1 }], discountType: "PERCENT", discountValue: 15, vatRate: 0.21, deliveryType: "DIGITAL_PDF" }).discountAmount), 16051);
  const c = quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 107010 }], discount: { kind: "percent", percent: 15 }, shippingCents: 0, regime: VAT_GENERAL_21 });
  assert.ok(c.ok && c.totals.discount === 16052);
  // concrete: 60 € off a 50 € line with paper shipping — old charges 2,42 € (eats 10 € of shipping); new: error
  assert.equal(computeQuoteTotals({ lines: [{ description: "x", quantity: 1, unitPrice: 50 }], discountType: "FIXED", discountValue: 60, vatRate: 0.21, deliveryType: "PAPER_SHIP", shippingBase: 12 }).total, 2.42);
  const e = quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 5000 }], discount: { kind: "fixed", cents: 6000 }, shippingCents: 1200, regime: VAT_GENERAL_21 });
  assert.ok(!e.ok && e.error === "discount_exceeds_subtotal");
});
