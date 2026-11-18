// Parity of lib/dinero against the code in production. Every difference found is
// asserted as a documented category; anything else fails the test.
import test from "node:test";
import assert from "node:assert/strict";
import { computeBase } from "../../../lib/pricing-engine/calculator.ts";
import { computePagePricing } from "../../../lib/pricing-engine/page-pricing.ts";
import { autoClientPriceCentsFromCost, computeQuoteTotals } from "../../../lib/quote-math.ts";
import { priceDocWithRate, fitsDocSize as oldFitsDocSize, canAutoQuote } from "../../../lib/learned-rates-math.ts";
import { channelPriceToBaseCents, baseToChannelPriceCents, spreadCents } from "../../../lib/lavori-directo-math.ts";
import { computeLineTotals, totalsFromGross } from "../../../lib/invoice-math.ts";
import { regularizacionFlatApplies } from "../../../lib/regularizacion-price.ts";
import { priceFrToEs, frSameDayCents } from "../../../lib/dinero/tariff-fr.ts";
import { estimateInternalCost } from "../../../lib/dinero/estimate.ts";
import { priceWithRate, fitsDocSize } from "../../../lib/dinero/rate.ts";
import { suggestClientPrice } from "../../../lib/dinero/suggest.ts";
import { knownCost, toBase, fromBase } from "../../../lib/dinero/supplier.ts";
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

test("paridad tariff-fr ↔ computeBase/computePagePricing (FR→ES)", () => {
  let same = 0;
  const diffs: Record<string, number> = {};
  for (const t of TYPES) for (let pages = 0; pages <= 25; pages++) for (const words of [null, 0, 300, 900, 901, 1000, 2500, 7777])
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
  for (const l of ["en", "de", "nl", "it", "pt", "ca", "sv", "no", "ar", "ro"]) for (const t of TYPES) for (let pages = 0; pages <= 4; pages++)
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
    const nw = suggestClientPrice(knownCost(cost), { floorCents: floor })!.suggestedCents;
    if (old === nw) continue;
    // DOCUMENTED rounding: cost × 1,30/1,25/1,20 is an exact half cent; old round2 in euros loses it to float error.
    const band = cost < 10000 ? 130 : cost < 19000 ? 125 : 120;
    assert.ok(nw - old === 1 && (cost * band) % 100 === 50, `coste ${cost} suelo ${floor}: ${old} vs ${nw}`);
    halfCent++;
  }
  assert.ok(halfCent > 0);
  assert.equal(autoClientPriceCentsFromCost(3355, 0), 4361); // 43,615 €
  assert.equal(suggestClientPrice(knownCost(3355), { floorCents: 0 })!.suggestedCents, 4362);
});

test("paridad supplier ↔ channelPriceToBaseCents / baseToChannelPriceCents", () => {
  const pairs = [["base", "base"], ["payable_iva_irpf", "payableVatIrpf"], ["total_con_iva", "totalWithVat"]] as const;
  for (const [o, n] of pairs) for (let x = 0; x <= 300000; x++) {
    assert.equal(toBase(x, n), channelPriceToBaseCents(x, o));
    assert.equal(fromBase(x, n), baseToChannelPriceCents(x, o));
  }
});

test("paridad rate ↔ priceDocWithRate y fitsDocSize", () => {
  for (const unit of ["doc", "kword"] as const) for (let cost = 1000; cost <= 20000; cost += 250) for (let cl = 1000; cl <= 30000; cl += 333)
    for (const w of [1, 250, 999, 1000, 1234, 2500, 4321]) {
      const old = priceDocWithRate({ unit, costCents: cost, clientCents: cl }, w);
      const nw = priceWithRate({ unit: unit === "kword" ? "per1000Words" : "doc", costCents: cost, clientCents: cl }, w);
      if (nw.kind === "noPrice") assert.fail(`noPrice ${unit} ${cost} ${cl} ${w}`);
      assert.equal(nw.clientCents, old.clientCents);
      assert.equal(nw.costCents, old.costCents);
      assert.equal(nw.kind === "priced", canAutoQuote(old.clientCents, old.costCents));
    }
  for (let w = 0; w <= 3000; w++) for (let r = 1; r <= 2000; r += 7) assert.equal(fitsDocSize(w, r), oldFitsDocSize(w, r));
  // DOCUMENTED: a tariff without its client price — old invents it with the suggestion rule; new refuses.
  assert.equal(priceDocWithRate({ unit: "doc", costCents: 3000, clientCents: null }, 300).clientCents, 4000);
  assert.equal(priceWithRate({ unit: "doc", costCents: 3000, clientCents: null }, 300).kind, "noPrice");
});

test("paridad spread ↔ spreadCents", () => {
  for (let t = 0; t <= 5000; t++) for (const ws of [[1, 1, 1], [1, 2], [300, 700, 1], [5, 0, 5], [3, 3, 1], [1000, 1], [7]]) {
    assert.deepEqual(spread(t, ws), spreadCents(t, ws));
  }
  // DOCUMENTED old bug: 2 c among 4 equal parts → old leaves −1 c in the last part.
  assert.deepEqual(spreadCents(2, [1, 1, 1, 1]), [1, 1, 1, -1]);
  assert.deepEqual(spread(2, [1, 1, 1, 1]), [1, 1, 0, 0]);
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

test("paridad quoteTotals ↔ computeQuoteTotals (líneas, descuento, envío)", () => {
  let s = 7;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let vatHalf = 0, shippingEaten = 0, discountHalf = 0;
  for (let i = 0; i < 20000; i++) {
    const lines = Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ quantity: 1 + Math.floor(r() * 3), unitPriceCents: Math.floor(r() * 40000) }));
    const pct = r() < 0.4;
    const value = pct ? [0, 5, 10, 15, 20][Math.floor(r() * 5)] : Math.floor(r() * 50000);
    const paper = r() < 0.3;
    const old = computeQuoteTotals({
      lines: lines.map((l) => ({ description: "x", quantity: l.quantity, unitPrice: l.unitPriceCents / 100 })),
      discountType: pct ? "PERCENT" : "FIXED", discountValue: pct ? value : value / 100, vatRate: 0.21, deliveryType: paper ? "PAPER_SHIP" : "DIGITAL_PDF", shippingBase: 12,
    });
    const nw = quoteTotals({ lines, discount: pct ? { kind: "percent", percent: value } : { kind: "fixed", cents: value }, shippingCents: paper ? 1200 : 0, regime: VAT_GENERAL_21 });
    assert.equal(nw.subtotal, toC(old.subtotal));
    if (nw.discount !== toC(old.discountAmount)) {
      if (pct) {
        // DOCUMENTED rounding: percent discount on an exact half cent, old float rounds it down.
        assert.ok(nw.discount - toC(old.discountAmount) === 1 && (nw.subtotal * value * 100) % 10000 === 5000);
        discountHalf++;
      } else {
        // DOCUMENTED decision: the discount is capped at the subtotal; old lets it eat the paper shipping.
        assert.ok(paper && toC(old.discountAmount) > nw.subtotal && nw.discount === nw.subtotal);
        shippingEaten++;
      }
      continue;
    }
    if (nw.vat !== toC(old.vatAmount)) {
      assert.ok(nw.vat - toC(old.vatAmount) === 1 && (nw.taxableBase * 21) % 100 === 50);
      vatHalf++;
    }
    assert.equal(nw.total - nw.vat, toC(old.total) - toC(old.vatAmount));
  }
  assert.ok(vatHalf > 0 && shippingEaten > 0 && discountHalf > 0);
  // concrete: 15 % of 1.070,10 € = 160,515 € → old 160,51, new 160,52
  assert.equal(toC(computeQuoteTotals({ lines: [{ description: "x", quantity: 1, unitPrice: 1070.1 }], discountType: "PERCENT", discountValue: 15, vatRate: 0.21, deliveryType: "DIGITAL_PDF" }).discountAmount), 16051);
  assert.equal(quoteTotals({ lines: [{ quantity: 1, unitPriceCents: 107010 }], discount: { kind: "percent", percent: 15 }, shippingCents: 0, regime: VAT_GENERAL_21 }).discount, 16052);
});
