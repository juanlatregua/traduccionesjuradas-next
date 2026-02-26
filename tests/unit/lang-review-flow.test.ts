import test from "node:test";
import assert from "node:assert/strict";
import {
  inferFlowProfile,
  requiresInternalReview,
  canTransitionWorkflow,
} from "../../lib/workflow.ts";
import { computeQuoteTotals } from "../../lib/quotes.ts";
import { getWordRateForLangOrPair } from "../../lib/pricing.ts";

// ─── inferFlowProfile: non-French languages trigger LANG_REVIEW ───

test("en-es infiere LANG_REVIEW", () => {
  const profile = inferFlowProfile({ langPair: "en-es" });
  assert.equal(profile, "LANG_REVIEW");
});

test("es-en infiere LANG_REVIEW", () => {
  const profile = inferFlowProfile({ langPair: "es-en" });
  assert.equal(profile, "LANG_REVIEW");
});

test("de-es infiere LANG_REVIEW", () => {
  const profile = inferFlowProfile({ langPair: "de-es" });
  assert.equal(profile, "LANG_REVIEW");
});

test("pt-es infiere LANG_REVIEW", () => {
  const profile = inferFlowProfile({ langPair: "pt-es" });
  assert.equal(profile, "LANG_REVIEW");
});

test("it-es infiere LANG_REVIEW", () => {
  const profile = inferFlowProfile({ langPair: "it-es" });
  assert.equal(profile, "LANG_REVIEW");
});

test("ca-es infiere LANG_REVIEW", () => {
  const profile = inferFlowProfile({ langPair: "ca-es" });
  assert.equal(profile, "LANG_REVIEW");
});

test("fr-es infiere FR_A (no LANG_REVIEW)", () => {
  const profile = inferFlowProfile({ langPair: "fr-es" });
  assert.equal(profile, "FR_A");
});

test("fr-es con hasMixedCart infiere FR_B", () => {
  const profile = inferFlowProfile({ langPair: "fr-es", hasMixedCart: true });
  assert.equal(profile, "FR_B");
});

// ─── requiresInternalReview ───

test("LANG_REVIEW requiere revision interna", () => {
  assert.equal(requiresInternalReview("LANG_REVIEW"), true);
});

test("FR_B requiere revision interna", () => {
  assert.equal(requiresInternalReview("FR_B"), true);
});

test("FR_A no requiere revision interna", () => {
  assert.equal(requiresInternalReview("FR_A"), false);
});

test("GENERAL no requiere revision interna", () => {
  assert.equal(requiresInternalReview("GENERAL"), false);
});

// ─── Workflow transitions for LANG_REVIEW path ───

test("BORRADOR -> PENDIENTE_REVISION es valido", () => {
  assert.equal(canTransitionWorkflow("BORRADOR", "PENDIENTE_REVISION"), true);
});

test("PENDIENTE_REVISION -> PRESUPUESTO_ENVIADO es valido", () => {
  assert.equal(canTransitionWorkflow("PENDIENTE_REVISION", "PRESUPUESTO_ENVIADO"), true);
});

test("PRESUPUESTO_ENVIADO -> PENDIENTE_PAGO es valido", () => {
  assert.equal(canTransitionWorkflow("PRESUPUESTO_ENVIADO", "PENDIENTE_PAGO"), true);
});

test("PENDIENTE_REVISION -> PENDIENTE_PAGO directo NO es valido", () => {
  assert.equal(canTransitionWorkflow("PENDIENTE_REVISION", "PENDIENTE_PAGO"), false);
});

test("cadena completa LANG_REVIEW es valida paso a paso", () => {
  assert.equal(canTransitionWorkflow("BORRADOR", "PENDIENTE_REVISION"), true);
  assert.equal(canTransitionWorkflow("PENDIENTE_REVISION", "PRESUPUESTO_ENVIADO"), true);
  assert.equal(canTransitionWorkflow("PRESUPUESTO_ENVIADO", "PENDIENTE_PAGO"), true);
  assert.equal(canTransitionWorkflow("PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO"), true);
  assert.equal(canTransitionWorkflow("PENDIENTE_PAGO", "PAGO_VALIDADO"), true);
});

// ─── getWordRateForLangOrPair para idiomas del funnel ───

test("tarifa ingles es 0.10", () => {
  assert.equal(getWordRateForLangOrPair("en-es"), 0.1);
});

test("tarifa aleman es 0.12", () => {
  assert.equal(getWordRateForLangOrPair("de-es"), 0.12);
});

test("tarifa portugues es 0.12", () => {
  assert.equal(getWordRateForLangOrPair("pt-es"), 0.12);
});

test("tarifa italiano es 0.12", () => {
  assert.equal(getWordRateForLangOrPair("it-es"), 0.12);
});

test("tarifa catalan es 0.10", () => {
  assert.equal(getWordRateForLangOrPair("ca-es"), 0.1);
});

test("tarifa frances es 0.08", () => {
  assert.equal(getWordRateForLangOrPair("fr-es"), 0.08);
});

test("tarifa idioma desconocido es DEFAULT 0.14", () => {
  assert.equal(getWordRateForLangOrPair("zh-es"), 0.14);
});

// ─── computeQuoteTotals para auto-quote LANG_REVIEW ───

test("auto-quote totals para 500 palabras ingles", () => {
  const rate = getWordRateForLangOrPair("en-es");
  const totals = computeQuoteTotals({
    lines: [{ description: "Traduccion jurada de ingles", quantity: 500, unitPrice: rate }],
    discountType: "NONE",
    discountValue: 0,
    vatRate: 0.21,
    deliveryType: "DIGITAL_PDF",
  });

  assert.equal(totals.subtotal, 50); // 500 * 0.10
  assert.equal(totals.shippingAmount, 0);
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.vatAmount, 10.5); // 50 * 0.21
  assert.equal(totals.total, 60.5);
  assert.equal(totals.lines.length, 1);
  assert.equal(totals.lines[0].lineTotal, 50);
});

test("auto-quote totals para 1000 palabras aleman", () => {
  const rate = getWordRateForLangOrPair("de-es");
  const totals = computeQuoteTotals({
    lines: [{ description: "Traduccion jurada de aleman", quantity: 1000, unitPrice: rate }],
    discountType: "NONE",
    discountValue: 0,
    vatRate: 0.21,
    deliveryType: "DIGITAL_PDF",
  });

  assert.equal(totals.subtotal, 120); // 1000 * 0.12
  assert.equal(totals.vatAmount, 25.2); // 120 * 0.21
  assert.equal(totals.total, 145.2);
});
