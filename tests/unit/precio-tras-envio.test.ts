import test from "node:test";
import assert from "node:assert/strict";
import {
  decideSentQuotePrice,
  freezeKeyFor,
  shouldFreeze,
  isUnpaidSentQuote,
  isPaymentFrozen,
} from "../../lib/precio-tras-envio-math.ts";
import { channelPriceToBaseCents } from "../../lib/lavori-directo-math.ts";
import { publicDict, type PublicLang } from "../../lib/quote-public-i18n.ts";

// Datos reales en BD el 11-oct-2026.
const FLORIAN = [{ quantity: 1, unitPrice: 91, supplierUnitCost: 70 }]; // 2026-00250 DE>ES, Morton base 40 €
const BIANCA = [
  { quantity: 1, unitPrice: 84.5, supplierUnitCost: 65 },
  { quantity: 1, unitPrice: 117, supplierUnitCost: 90 },
]; // 2026-00245 PT>ES, Nielson 90 € con IVA (total_con_iva)

test("Florian 2026-00250: Morton 40 € → ok, coste real 40 en la línea, margen sube (sin SMS)", () => {
  const d = decideSentQuotePrice({ lines: FLORIAN, discountCents: 0, realCostCents: 4000 });
  assert.equal(d.kind, "ok");
  assert.equal(d.clientBaseCents, 9100);
  assert.equal(d.estimatedCostCents, 7000);
  assert.equal(d.marginCents, 5100);
  assert.equal(d.marginDown, false);
  assert.deepEqual(d.newLineCostCents, [4000]);
  assert.equal(d.unchanged, false);
});

test("Bianca 2026-00245: Nielson 90 € con IVA = 74,38 base, repartido por el coste estimado", () => {
  const base = channelPriceToBaseCents(9000, "total_con_iva");
  assert.equal(base, 7438);
  const d = decideSentQuotePrice({ lines: BIANCA, discountCents: 0, realCostCents: base });
  assert.equal(d.kind, "ok");
  assert.equal(d.clientBaseCents, 20150);
  assert.equal(d.estimatedCostCents, 15500);
  assert.equal(d.marginCents, 12712);
  assert.deepEqual(d.newLineCostCents, [3119, 4319]);
  assert.equal(d.newLineCostCents!.reduce((a, c) => a + c, 0), base);
});

test("margen bajo: 0 ≤ margen < 10 % sobre coste → se escribe y marginDown", () => {
  const d = decideSentQuotePrice({ lines: FLORIAN, discountCents: 0, realCostCents: 8500 });
  assert.equal(d.kind, "margen_bajo");
  assert.equal(d.marginCents, 600);
  assert.equal(d.marginDown, true);
  assert.deepEqual(d.newLineCostCents, [8500]);
  const cero = decideSentQuotePrice({ lines: FLORIAN, discountCents: 0, realCostCents: 9100 });
  assert.equal(cero.kind, "margen_bajo");
  assert.equal(cero.marginCents, 0);
});

test("pérdida: no se escribe el coste y se congela; el descuento cuenta", () => {
  const d = decideSentQuotePrice({ lines: BIANCA, discountCents: 0, realCostCents: 21000 });
  assert.equal(d.kind, "perdida");
  assert.equal(d.marginCents, -850);
  assert.equal(d.newLineCostCents, null);
  const conDescuento = decideSentQuotePrice({ lines: FLORIAN, discountCents: 1500, realCostCents: 8000 });
  assert.equal(conDescuento.clientBaseCents, 7600);
  assert.equal(conDescuento.kind, "perdida");
});

test("no se reparte con cantidades ≠ 1 ni con otra solicitud con precio", () => {
  const q = decideSentQuotePrice({ lines: [{ quantity: 2, unitPrice: 50, supplierUnitCost: 30 }], discountCents: 0, realCostCents: 4000 });
  assert.equal(q.kind, "ok");
  assert.equal(q.newLineCostCents, null);
  assert.match(q.noSpreadReason!, /cantidad/);
  const o = decideSentQuotePrice({ lines: FLORIAN, discountCents: 0, realCostCents: 4000, otherPricedRequests: true });
  assert.equal(o.newLineCostCents, null);
  assert.match(o.noSpreadReason!, /otra solicitud/);
});

test("idempotencia: líneas ya con el coste real → unchanged; misma cifra no recongela", () => {
  const ya = decideSentQuotePrice({ lines: [{ quantity: 1, unitPrice: 91, supplierUnitCost: 40 }], discountCents: 0, realCostCents: 4000 });
  assert.equal(ya.unchanged, true);
  const perdida = decideSentQuotePrice({ lines: FLORIAN, discountCents: 0, realCostCents: 12000 });
  const key = freezeKeyFor("LEAD-C701784649", 12000, "ngus1uku6x5uw2pqbmflpbbt");
  assert.equal(shouldFreeze(perdida, { paymentFrozenAt: null, paymentFreezeKey: null }, key), true);
  assert.equal(shouldFreeze(perdida, { paymentFrozenAt: new Date(), paymentFreezeKey: key }, key), false);
  // Desbloqueado por staff (frozenAt null, clave conservada): el mismo evento no recongela.
  assert.equal(shouldFreeze(perdida, { paymentFrozenAt: null, paymentFreezeKey: key }, key), false);
  // Otra cifra distinta sí.
  assert.equal(shouldFreeze(perdida, { paymentFrozenAt: null, paymentFreezeKey: key }, freezeKeyFor("LEAD-C701784649", 13000, "ngus1uku6x5uw2pqbmflpbbt")), true);
  assert.equal(shouldFreeze(ya, { paymentFrozenAt: null, paymentFreezeKey: null }, key), false);
});

test("carril: solo enviado, sin pagar y sin pedido; congelado solo mientras no esté pagado", () => {
  assert.equal(isUnpaidSentQuote({ status: "OPENED", paidAt: null, ordersCount: 0 }), true);
  assert.equal(isUnpaidSentQuote({ status: "ACCEPTED", paidAt: null, ordersCount: 0 }), true);
  assert.equal(isUnpaidSentQuote({ status: "DRAFT", paidAt: null, ordersCount: 0 }), false);
  assert.equal(isUnpaidSentQuote({ status: "SENT", paidAt: new Date(), ordersCount: 0 }), false);
  assert.equal(isUnpaidSentQuote({ status: "SENT", paidAt: null, ordersCount: 1 }), false);
  assert.equal(isPaymentFrozen({ paymentFrozenAt: new Date(), paidAt: null }), true);
  assert.equal(isPaymentFrozen({ paymentFrozenAt: new Date(), paidAt: new Date() }), false);
  assert.equal(isPaymentFrozen({ paymentFrozenAt: null, paidAt: null }), false);
});

test("i18n: aviso de congelación en los 6 idiomas, sin repetirse", () => {
  const langs: PublicLang[] = ["es", "en", "fr", "pt", "it", "de"];
  const textos = langs.map((l) => publicDict(l).paymentFrozen);
  for (const t of textos) assert.ok(t && t.length > 20);
  assert.equal(new Set(textos).size, 6);
  assert.equal(publicDict("es").paymentFrozen, "Estamos actualizando tu presupuesto; te escribimos en breve.");
  for (const l of langs) assert.ok(publicDict(l).paymentFrozenTitle);
});
