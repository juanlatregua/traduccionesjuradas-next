import test from "node:test";
import assert from "node:assert/strict";
import { toBase, fromBase, parseSupplierBasis, knownCost, costFromSupplier, sumCosts, OWN_WORK, UNKNOWN_COST } from "../../../lib/dinero/supplier.ts";
import { marginOf, canIssue, pctOverCost, MIN_MARGIN_PCT_OVER_COST } from "../../../lib/dinero/margin.ts";
import { priceFrToEs, frSameDayCents } from "../../../lib/dinero/tariff-fr.ts";
import { priceWithRate, fitsDocSize, selectRate, unitFor } from "../../../lib/dinero/rate.ts";
import { suggestClientPrice, marginPctForCostCents } from "../../../lib/dinero/suggest.ts";
import { estimateInternalCost } from "../../../lib/dinero/estimate.ts";

const fr = (over: Partial<Parameters<typeof priceFrToEs>[0]> = {}) =>
  priceFrToEs({ docType: "birth_certificate", pages: 1, words: 300, apostille: false, ...over });
const cents = (p: ReturnType<typeof priceFrToEs>) => (p.kind === "priced" ? p.cents : null);

test("supplier: base ↔ cifra del jurado", () => {
  assert.equal(toBase(10000, "base"), 10000);
  assert.equal(toBase(10000, "payableVatIrpf"), 9434); // Daniela: 100 € líquidos = 94,34 base
  assert.equal(toBase(6000, "totalWithVat"), 4959); // Nielson: 60 € = 49,59 + 10,41
  assert.equal(fromBase(9434, "payableVatIrpf"), 10000);
  assert.equal(fromBase(50, "totalWithVat"), 61); // 60,5 → 61
  assert.throws(() => toBase(-1, "base"));
  for (const basis of ["base", "payableVatIrpf", "totalWithVat"] as const) {
    for (let b = 0; b <= 100000; b += 13) assert.equal(toBase(fromBase(b, basis), basis), b);
  }
  assert.equal(parseSupplierBasis("payable_iva_irpf"), "payableVatIrpf");
  assert.equal(parseSupplierBasis("total_con_iva"), "totalWithVat");
  assert.throws(() => parseSupplierBasis(null));
  assert.deepEqual(costFromSupplier(10000, "payableVatIrpf"), { known: true, baseCents: 9434 });
  assert.deepEqual(sumCosts([knownCost(100), knownCost(250)]), { known: true, baseCents: 350 });
  assert.deepEqual(sumCosts([knownCost(100), UNKNOWN_COST]), UNKNOWN_COST);
  assert.deepEqual(sumCosts([OWN_WORK, OWN_WORK]), OWN_WORK);
  assert.deepEqual(sumCosts([OWN_WORK, knownCost(500)]), { known: true, baseCents: 500 });
  assert.deepEqual(sumCosts([]), UNKNOWN_COST);
});

test("margin: una definición, cuatro clases", () => {
  assert.equal(MIN_MARGIN_PCT_OVER_COST, 10);
  assert.equal(marginOf(5000, UNKNOWN_COST).class, "unknown");
  assert.equal(marginOf(5000, knownCost(5000)).class, "loss");
  assert.equal(marginOf(4000, knownCost(5000)).class, "loss");
  assert.equal(marginOf(5499, knownCost(5000)).class, "low");
  assert.equal(marginOf(5500, knownCost(5000)).class, "ok"); // exactamente 10 % sobre coste
  assert.equal(marginOf(3000, OWN_WORK).class, "ok");
  assert.equal(marginOf(0, OWN_WORK).class, "ok");
  assert.equal(marginOf(100, knownCost(0)).class, "ok");
  assert.equal(marginOf(0, knownCost(0)).class, "loss");
  assert.equal(pctOverCost(5500, knownCost(5000)), 10);
  assert.equal(pctOverCost(5500, UNKNOWN_COST), null);
  assert.equal(pctOverCost(5500, OWN_WORK), null);
  assert.equal(canIssue(5500, knownCost(5000)).ok, true);
  const low = canIssue(5400, knownCost(5000));
  assert.equal(low.ok, false);
  assert.match(!low.ok ? low.reason : "", /Margen bajo: ingreso 54,00 € − coste 50,00 € = 4,00 € \(8,0 %/);
  const unk = canIssue(5400, UNKNOWN_COST);
  assert.match(!unk.ok ? unk.reason : "", /desconocido/);
  const loss = canIssue(4000, knownCost(5000));
  assert.match(!loss.ok ? loss.reason : "", /Pérdida/);
});

test("tariff-fr: por documento ≤ 2 páginas, apostilla +5, largo 55", () => {
  assert.equal(cents(fr()), 3000);
  assert.equal(cents(fr({ pages: 2 })), 3500);
  assert.equal(cents(fr({ pages: 2, words: 901 })), 5500);
  assert.equal(cents(fr({ pages: 1, words: 900 })), 3000);
  assert.equal(cents(fr({ apostille: true })), 3500);
  assert.equal(cents(fr({ pages: 3, apostille: true, apostilleOnSeparatePage: true })), 4000); // 2 páginas + 5
  assert.equal(cents(fr({ pages: 3, apostille: true })), 9500); // la hoja de apostilla se cobra en la duda
  assert.equal(cents(fr({ docType: "other", pages: 1, words: null })), 3000);
  assert.equal(cents(fr({ pages: 0 })), 3000);
  const p = fr({ pages: 2, apostille: true });
  assert.ok(p.kind === "priced" && p.rule === "perDocument" && p.why.length === 2);
});

test("tariff-fr: certificados por página, penales, RC, extractos, regularización", () => {
  assert.equal(cents(fr({ pages: 4 })), 12000);
  assert.equal(cents(fr({ docType: "criminal_record", pages: 5 })), 6198);
  assert.equal(cents(fr({ docType: "criminal_record", pages: 3, apostille: true })), 6698);
  assert.equal(cents(fr({ docType: "criminal_record", pages: 2 })), 3500);
  assert.equal(cents(fr({ docType: "company_registration", pages: 1 })), 3000);
  assert.equal(cents(fr({ docType: "company_registration", pages: 5 })), 5000);
  assert.equal(cents(fr({ docType: "company_registration", pages: 12 })), 19000);
  assert.equal(cents(fr({ docType: "company_registration", pages: 20 })), 28400);
  assert.equal(cents(fr({ docType: "bank_statement", pages: 4 })), 3000);
  assert.equal(cents(fr({ docType: "bank_statement", pages: 4, bankStatementsInQuote: 5 })), 3000);
  assert.equal(cents(fr({ docType: "bank_statement", pages: 1, bankStatementsInQuote: 6 })), 1500);
  assert.equal(cents(fr({ docType: "contract", pages: 1, words: 300, regularization: true })), 2500);
  assert.equal(cents(fr({ pages: 3, regularization: true })), 9000);
  assert.equal(cents(fr({ docType: "birth_certificate", category: "legal", pages: 1 })), 3000); // por página, no por documento
  assert.equal(frSameDayCents(3500), 4900);
  assert.equal(frSameDayCents(6198), 8677); // 8677,2
});

test("tariff-fr: por palabra y casos sin tarifa (nunca un número inventado)", () => {
  assert.equal(cents(fr({ docType: "contract", pages: 1, words: 300 })), 3500); // mínimo
  assert.equal(cents(fr({ docType: "contract", pages: 3, words: 300 })), 5500); // mínimo pluripágina
  assert.equal(cents(fr({ docType: "contract", pages: 3, words: 1000 })), 8000);
  assert.equal(cents(fr({ docType: "contract", pages: 3, words: 1000, complexity: "complex" })), 9600);
  assert.equal(cents(fr({ docType: "power_of_attorney", pages: 3, words: 1000, apostille: true })), 8500);
  assert.equal(cents(fr({ docType: "other", pages: 4, words: 2000 })), 16000);
  assert.equal(fr({ docType: "contract", words: null }).kind, "noTariff");
  assert.equal(fr({ docType: "apostille" }).kind, "noTariff");
  assert.equal(fr({ docType: "other", pages: 5, words: 0 }).kind, "noTariff");
});

test("rate: tarifa aprobada exige coste y venta", () => {
  const doc = priceWithRate({ unit: "doc", costCents: 3500, clientCents: 4590 }, 400);
  assert.ok(doc.kind === "priced" && doc.clientCents === 4500 && doc.costCents === 3500);
  const floor = priceWithRate({ unit: "doc", costCents: 2000, clientCents: 3000 }, 400);
  assert.ok(floor.kind === "priced" && floor.clientCents === 4000);
  const kw = priceWithRate({ unit: "per1000Words", costCents: 8000, clientCents: 11000 }, 2500);
  assert.ok(kw.kind === "priced" && kw.costCents === 20000 && kw.clientCents === 27500);
  const blocked = priceWithRate({ unit: "doc", costCents: 4000, clientCents: 4300 }, 400);
  assert.ok(blocked.kind === "blocked" && /Margen bajo/.test(blocked.reason));
  assert.equal(priceWithRate({ unit: "doc", costCents: 4000, clientCents: null }, 400).kind, "noPrice");
  assert.equal(priceWithRate({ unit: "doc", costCents: null, clientCents: 6000 }, 400).kind, "noPrice");
  assert.equal(priceWithRate({ unit: "per1000Words", costCents: 8000, clientCents: 11000 }, null).kind, "noPrice");
});

test("rate: tamaño ±30 %, unidad y comodín", () => {
  assert.equal(fitsDocSize(130, 100), true);
  assert.equal(fitsDocSize(131, 100), false);
  assert.equal(fitsDocSize(25, 100), true);
  assert.equal(fitsDocSize(24, 100), false);
  assert.equal(fitsDocSize(null, 100), true);
  assert.equal(unitFor(5000, 2), "doc");
  assert.equal(unitFor(1000, 3), "per1000Words");
  assert.equal(unitFor(999, 3), "doc");
  const exact = { unit: "doc" as const, costCents: 3000, clientCents: 5000, wordsRef: 300, approved: true };
  const wildcard = { unit: "per1000Words" as const, costCents: 8000, clientCents: 11000, approved: true };
  assert.equal(selectRate({ exact, wildcard }, { words: 300, pages: 1 }), exact);
  assert.equal(selectRate({ exact, wildcard }, { words: 1000, pages: 4 }), null); // la exacta manda aunque no encaje
  assert.equal(selectRate({ exact: { ...exact, approved: false }, wildcard }, { words: 1500, pages: 4 }), wildcard);
  assert.equal(selectRate({ exact: null, wildcard }, { words: 1500, pages: 2 }), null);
  assert.equal(selectRate({ exact: null, wildcard: { ...wildcard, approved: false } }, { words: 1500, pages: 4 }), null);
});

test("suggest: regla única de sugerencia desde coste", () => {
  assert.equal(marginPctForCostCents(9999), 30);
  assert.equal(marginPctForCostCents(10000), 25);
  assert.equal(marginPctForCostCents(19000), 20);
  assert.equal(suggestClientPrice(UNKNOWN_COST), null);
  assert.deepEqual(suggestClientPrice(knownCost(1000)), { kind: "suggestion", suggestedCents: 4000, bound: "floor" });
  assert.equal(suggestClientPrice(knownCost(3000))!.suggestedCents, 4000); // 39 € < suelo
  assert.equal(suggestClientPrice(knownCost(5000))!.suggestedCents, 6500);
  assert.equal(suggestClientPrice(knownCost(15000))!.suggestedCents, 18750);
  assert.equal(suggestClientPrice(knownCost(20000))!.suggestedCents, 24000);
  assert.equal(suggestClientPrice(knownCost(2000), { floorCents: 0 })!.suggestedCents, 3000); // +10 € manda
  assert.equal(suggestClientPrice(knownCost(1000), { floorCents: 0 })!.bound, "markupCap"); // 16 € tope ×1,6
  assert.equal(suggestClientPrice(knownCost(0), { floorCents: 0 })!.suggestedCents, 0);
});

test("estimate: coste interno por palabra (no es precio al cliente)", () => {
  const e = estimateInternalCost({ lang: "en", docType: "contract", words: 1000, pages: 3, apostille: false });
  assert.ok(e.kind === "internalCostEstimate" && e.internalCostCents === 11000 && e.urgentInternalCostCents === 13750);
  const min = estimateInternalCost({ lang: "ar", docType: "birth_certificate", words: 100, pages: 1, apostille: true });
  assert.ok(min.kind === "internalCostEstimate" && min.internalCostCents === 7000 && min.minimumApplied);
  const pageMin = estimateInternalCost({ lang: "de", docType: "degree", words: 100, pages: 2, apostille: false });
  assert.ok(pageMin.kind === "internalCostEstimate" && pageMin.internalCostCents === 8000);
  const cx = estimateInternalCost({ lang: "ro", docType: "other", words: 1234, pages: 1, complexity: "highly_complex", apostille: false });
  assert.ok(cx.kind === "internalCostEstimate" && cx.internalCostCents === 16659); // 1234 × 0,09 × 1,5 = 166,59
  assert.equal(estimateInternalCost({ lang: "fr", docType: "contract", words: 1000, pages: 1, apostille: false }).kind, "noEstimate");
  assert.equal(estimateInternalCost({ lang: "ru", docType: "contract", words: 1000, pages: 1, apostille: false }).kind, "noEstimate");
  assert.equal(estimateInternalCost({ lang: "en", docType: "contract", words: -1, pages: 1, apostille: false }).kind, "noEstimate");
});
