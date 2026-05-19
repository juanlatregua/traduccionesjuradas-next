import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDiagnosis,
  getDeliveryHours,
  estimateDeliveryDate,
  meetsDeadline,
} from "../../lib/diagnosis.ts";

// diagnosis.ts solo tiene un import runtime relativo (pricing-engine/languages),
// así que se puede importar el módulo real sin reproducir la lógica.

// ─── getDeliveryHours: tabla determinista (docs/v2-fase1-plan.md) ───

test("francés 1-2 páginas → 24 h", () => {
  assert.equal(getDeliveryHours("fr", 1), 24);
  assert.equal(getDeliveryHours("fr", 2), 24);
});

test("francés más de 2 páginas → 48 h", () => {
  assert.equal(getDeliveryHours("fr", 3), 48);
  assert.equal(getDeliveryHours("fr", 12), 48);
});

test("alemán, inglés, portugués, italiano → 48 h", () => {
  for (const lang of ["de", "en", "pt", "it"]) {
    assert.equal(getDeliveryHours(lang, 1), 48);
    assert.equal(getDeliveryHours(lang, 9), 48);
  }
});

test("árabe → 72 h", () => {
  assert.equal(getDeliveryHours("ar", 1), 72);
});

test("idiomas de gestión manual → 72 h conservador", () => {
  for (const lang of ["nl", "sv", "no", "ca", "ro"]) {
    assert.equal(getDeliveryHours(lang, 1), 72);
  }
});

// ─── buildDiagnosis ───

function makeAnalysis(over: any = {}) {
  return {
    document_type: {
      category: over.category ?? "civil_registry",
      specific_type: over.specific_type ?? "birth_certificate",
      specific_type_es: over.specific_type_es ?? "Certificado de nacimiento",
      confidence: 0.9,
    },
    language: {
      source: over.source ?? "fr",
      source_name: "Francés",
      target: over.target ?? "es",
      target_name: "Español",
      confidence: 0.9,
    },
    document_metrics: {
      estimated_words: 200,
      pages: over.pages ?? 1,
      has_tables: false,
      has_stamps_seals: true,
      has_handwriting: false,
      scan_quality: "good",
      is_legible: true,
    },
  } as any;
}

const quoteFixture = { basePrice: 42, totalPrice: 50.82 } as any;

test("inbound (extranjero → español): dirección y frase de validez en España", () => {
  const d = buildDiagnosis(makeAnalysis({ source: "fr", target: "es" }), quoteFixture);
  assert.equal(d.sworn.direction, "inbound");
  assert.equal(d.sworn.required, true);
  assert.match(d.sworn.statement, /España/);
  assert.equal(d.delivery.hours, 24);
});

test("outbound (español → idioma extranjero): frase de acuerdos y país de destino", () => {
  const d = buildDiagnosis(makeAnalysis({ source: "es", target: "fr" }), quoteFixture);
  assert.equal(d.sworn.direction, "outbound");
  assert.match(d.sworn.statement, /acuerdos/);
  assert.match(d.sworn.statement, /país de destino/);
  assert.equal(d.delivery.hours, 24);
});

test("outbound con destino sin determinar: plazo pendiente", () => {
  const d = buildDiagnosis(makeAnalysis({ source: "es", target: "unknown" }), quoteFixture);
  assert.equal(d.sworn.direction, "outbound");
  assert.equal(d.delivery.hours, null);
  assert.match(d.delivery.label, /pendiente/i);
});

test("validez: la jurada no caduca siempre, el original según tipo", () => {
  const penales = buildDiagnosis(
    makeAnalysis({ specific_type: "criminal_record" }),
    quoteFixture
  );
  assert.match(penales.validity.swornTranslation, /no caduca/i);
  assert.match(penales.validity.originalDocument ?? "", /3 meses/);

  const titulo = buildDiagnosis(
    makeAnalysis({ specific_type: "degree" }),
    quoteFixture
  );
  assert.match(titulo.validity.swornTranslation, /no caduca/i);
  assert.equal(titulo.validity.originalDocument, null);
});

test("precio: se traslada el quote al diagnóstico", () => {
  const d = buildDiagnosis(makeAnalysis(), quoteFixture);
  assert.equal(d.price.base, 42);
  assert.equal(d.price.total, 50.82);
  assert.equal(d.price.currency, "EUR");
});

test("tipo: se traslada el tipo específico y la etiqueta en español", () => {
  const d = buildDiagnosis(makeAnalysis(), quoteFixture);
  assert.equal(d.type.specificType, "birth_certificate");
  assert.equal(d.type.label, "Certificado de nacimiento");
  assert.equal(d.type.category, "civil_registry");
});

// ─── estimateDeliveryDate / meetsDeadline ───
// 2026-06-01 es lunes; 2026-06-05 es viernes.
const MON = new Date(2026, 5, 1);
const FRI = new Date(2026, 5, 5);

function ymd(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

test("estimateDeliveryDate: 24/48/72 h → 1/2/3 días laborables", () => {
  assert.equal(ymd(estimateDeliveryDate(24, MON)), "2026-6-2");
  assert.equal(ymd(estimateDeliveryDate(48, MON)), "2026-6-3");
  assert.equal(ymd(estimateDeliveryDate(72, MON)), "2026-6-4");
});

test("estimateDeliveryDate: salta el fin de semana", () => {
  // viernes + 1 día laborable → lunes
  assert.equal(ymd(estimateDeliveryDate(24, FRI)), "2026-6-8");
});

test("meetsDeadline: llega si la fecha del cliente es >= entrega estimada", () => {
  assert.equal(meetsDeadline(24, new Date(2026, 5, 2), MON), true);
  assert.equal(meetsDeadline(24, new Date(2026, 5, 10), MON), true);
});

test("meetsDeadline: no llega si la fecha del cliente es anterior", () => {
  assert.equal(meetsDeadline(24, new Date(2026, 5, 1), MON), false);
  assert.equal(meetsDeadline(72, new Date(2026, 5, 2), MON), false);
});
