import test from "node:test";
import assert from "node:assert/strict";
import { periodKey, resolveConcept, clampDay, isTemplateDue, mostRecentDuePeriod, buildGeneratedExpenses, type RecurringExpenseTemplateData } from "../../lib/recurring-logic.ts";

function tpl(overrides: Partial<RecurringExpenseTemplateData> = {}): RecurringExpenseTemplateData {
  return {
    label: "Laborlex asesoría",
    brand: "traduccionesjuradas",
    supplier: "LABORLEX ASESORES, S.L.",
    supplierNif: "B92733948",
    category: "asesoría",
    conceptTemplate: "Asesoría — {MES} {AÑO}",
    lineItemsJson: null,
    vatRate: 0.21,
    taxTreatment: "general",
    irpfRetentionPct: 0,
    amountCents: 9082,
    dayOfMonth: 28,
    ...overrides,
  };
}

test("periodKey: YYYY-MM en UTC", () => {
  assert.equal(periodKey(new Date(Date.UTC(2026, 6, 14))), "2026-07");
  assert.equal(periodKey(new Date(Date.UTC(2026, 0, 1))), "2026-01");
});

test("resolveConcept sustituye {MES} y {AÑO} sin caer al mes anterior", () => {
  assert.equal(resolveConcept("Cuota {MES} {AÑO}", "2026-07"), "Cuota JULIO 2026");
  assert.equal(resolveConcept("Cuota {MES_AÑO}", "2026-01"), "Cuota ENERO 2026");
});

test("clampDay limita a 1-28", () => {
  assert.equal(clampDay(0), 1);
  assert.equal(clampDay(31), 28);
  assert.equal(clampDay(15), 15);
  assert.equal(clampDay(NaN), 1);
});

test("isTemplateDue: día alcanzado + periodo no generado", () => {
  const now = new Date(Date.UTC(2026, 6, 14));
  assert.ok(isTemplateDue({ dayOfMonth: 7, lastGeneratedPeriod: "2026-06" }, now));
  assert.ok(isTemplateDue({ dayOfMonth: 14, lastGeneratedPeriod: null }, now));
  // día aún no llegado
  assert.ok(!isTemplateDue({ dayOfMonth: 28, lastGeneratedPeriod: null }, now));
  // idempotencia: ya generado este periodo
  assert.ok(!isTemplateDue({ dayOfMonth: 7, lastGeneratedPeriod: "2026-07" }, now));
});

test("fijo: un Expense con importe, needsReview=false y nota [recurrente:…]", () => {
  const out = buildGeneratedExpenses(tpl(), "2026-07");
  assert.equal(out.length, 1);
  const e = out[0];
  assert.equal(e.date, "2026-07-28");
  assert.equal(e.concept, "Asesoría — JULIO 2026");
  assert.equal(e.baseCents, 9082);
  assert.equal(e.vatRate, 0.21);
  assert.equal(e.taxTreatment, "general");
  assert.equal(e.needsReview, false);
  assert.equal(e.notes, "[recurrente:Laborlex asesoría periodo 2026-07]");
});

test("variable (amountCents null): base 0 y needsReview=true SIEMPRE", () => {
  const out = buildGeneratedExpenses(tpl({ label: "Anthropic", amountCents: null, taxTreatment: "isp_import", vatRate: 0 }), "2026-07");
  assert.equal(out.length, 1);
  assert.equal(out[0].baseCents, 0);
  assert.equal(out[0].needsReview, true);
  assert.equal(out[0].taxTreatment, "isp_import");
});

test("lineItemsJson: un Expense por línea con vatRate/ivaDeducible propios y fallback de taxTreatment", () => {
  const out = buildGeneratedExpenses(
    tpl({
      label: "Orange",
      amountCents: null,
      lineItemsJson: [
        { concept: "Servicios — {MES} {AÑO}", baseCents: 8388, vatRate: 0.21, ivaDeducible: true },
        { concept: "Exentos/dispositivos — {MES}", baseCents: 7172, vatRate: 0, ivaDeducible: false, taxTreatment: "exempt" },
      ],
    }),
    "2026-05"
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].concept, "Servicios — MAYO 2026");
  assert.equal(out[0].vatRate, 0.21);
  assert.equal(out[0].ivaDeducible, true);
  assert.equal(out[0].taxTreatment, "general"); // fallback de la plantilla
  assert.equal(out[1].vatRate, 0); // el 0 de la línea NO cae al de la plantilla
  assert.equal(out[1].ivaDeducible, false);
  assert.equal(out[1].taxTreatment, "exempt");
  // variables (amountCents null) → todas las líneas pendientes de confirmar
  assert.ok(out.every((e) => e.needsReview));
  assert.ok(out.every((e) => e.notes === "[recurrente:Orange periodo 2026-05]"));
});

test("líneas vacías se descartan y sin conceptTemplate cae al label", () => {
  const out = buildGeneratedExpenses(tpl({ conceptTemplate: "", lineItemsJson: [{ concept: "  ", baseCents: 100, vatRate: 0.21 }] }), "2026-07");
  assert.equal(out.length, 1);
  assert.equal(out[0].concept, "Laborlex asesoría");
});

test("mostRecentDuePeriod: mes corriente si el día llegó, si no el anterior (backfill)", () => {
  const now = new Date(Date.UTC(2026, 6, 14));
  assert.equal(mostRecentDuePeriod(now, 7), "2026-07");
  assert.equal(mostRecentDuePeriod(now, 28), "2026-06");
  // cambio de año
  assert.equal(mostRecentDuePeriod(new Date(Date.UTC(2026, 0, 5)), 28), "2025-12");
});

test("isTemplateDue: backfill de un mes si se perdió la ventana (solo plantillas ya arrancadas)", () => {
  const now = new Date(Date.UTC(2026, 6, 14));
  // plantilla arrancada que perdió el 28-jun (cron caído): pendiente de 2026-06
  assert.ok(isTemplateDue({ dayOfMonth: 28, lastGeneratedPeriod: "2026-05" }, now));
  // plantilla NUEVA (nunca generó): no rellena meses pasados
  assert.ok(!isTemplateDue({ dayOfMonth: 28, lastGeneratedPeriod: null }, now));
});
