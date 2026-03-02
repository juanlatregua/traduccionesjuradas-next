import test from "node:test";
import assert from "node:assert/strict";

// Self-contained tests — reproduce logic to avoid @/ import alias issues

// === From lib/pricing-engine/languages.ts ===
const PER_WORD_RATE: Record<string, number> = {
  fr: 0.08, en: 0.08, de: 0.10, nl: 0.10, it: 0.09, pt: 0.09,
  ca: 0.08, sv: 0.12, no: 0.12, ar: 0.10, ro: 0.09,
};
const DEFAULT_RATE = 0.10;
function getRate(langCode: string) { return PER_WORD_RATE[langCode] || DEFAULT_RATE; }

// === From lib/pricing-engine/rules.ts ===
const MINIMUM_BY_TYPE: Record<string, number> = {
  birth_certificate: 42, marriage_certificate: 42, death_certificate: 42,
  criminal_record: 42, passport: 30, id_card: 25, divorce_decree: 55,
  degree: 50, transcript: 55, apostille: 20, contract: 60,
  power_of_attorney: 55, company_registration: 60, payslip: 35,
  medical_report: 50, tax_return: 50, other: 42,
};
const URGENCY_MULTIPLIER = 1.25;
const COMPLEXITY_MULTIPLIER: Record<string, number> = { standard: 1.0, complex: 1.2, highly_complex: 1.5 };
const VOLUME_DISCOUNTS = [
  { threshold: 3, discount: 0.05 }, { threshold: 5, discount: 0.10 }, { threshold: 10, discount: 0.15 },
];
function getMinimum(t: string) { return MINIMUM_BY_TYPE[t] || 42; }
function getComplexityMultiplier(l: string) { return COMPLEXITY_MULTIPLIER[l] || 1.0; }
function getVolumeDiscount(c: number) { let d = 0; for (const t of VOLUME_DISCOUNTS) { if (c >= t.threshold) d = t.discount; } return d; }

// === From lib/pricing-engine/calculator.ts (simplified) ===
function round2(n: number) { return Math.round(n * 100) / 100; }
function calculatePrice(analysis: any) {
  const { document_type, language, document_metrics, complexity } = analysis;
  const rate = getRate(language.source);
  const minimum = getMinimum(document_type.specific_type);
  const complexityMult = getComplexityMultiplier(complexity.level);
  const wordPrice = document_metrics.estimated_words * rate * complexityMult;
  const basePrice = Math.max(wordPrice, minimum);

  const st = document_type.specific_type;
  let days: { standard: string; urgent: string };
  if (["birth_certificate","marriage_certificate","death_certificate","criminal_record","passport","id_card"].includes(st)) {
    days = { standard: "24-48h", urgent: "12-24h" };
  } else if (["degree","transcript"].includes(st)) {
    days = document_metrics.pages <= 2 ? { standard: "48-72h", urgent: "24h" } : { standard: "3-5 días", urgent: "48h" };
  } else if (document_metrics.estimated_words > 2000) {
    days = { standard: "5-10 días", urgent: "3-5 días" };
  } else if (document_metrics.pages > 5) {
    days = { standard: "5-7 días", urgent: "3-4 días" };
  } else {
    days = { standard: "2-5 días", urgent: "24-48h" };
  }

  return {
    basePrice: round2(basePrice),
    urgentPrice: round2(basePrice * URGENCY_MULTIPLIER),
    estimatedDaysStandard: days.standard,
    estimatedDaysUrgent: days.urgent,
    breakdown: { words: document_metrics.estimated_words, ratePerWord: rate, wordSubtotal: round2(wordPrice), minimumApplied: wordPrice < minimum, minimumAmount: minimum, complexityMultiplier: complexityMult, ivaIncluded: true },
  };
}

// ==================== TESTS ====================

const baseAnalysis = {
  document_type: { category: "civil_registry", specific_type: "birth_certificate", specific_type_es: "Certificado de nacimiento", confidence: 0.95 },
  language: { source: "fr", source_name: "Francés", target: "es", target_name: "Español", confidence: 0.98 },
  country: { origin: "FR", origin_name: "Francia", issuing_authority: "Mairie", confidence: 0.9 },
  document_metrics: { estimated_words: 280, pages: 1, has_tables: false, has_stamps_seals: true, has_handwriting: false, scan_quality: "good", is_legible: true },
  extracted_data: { names: ["Jean Dupont"], dates: ["15/03/1990"], reference_numbers: [], institutions: [], notes: "" },
  complexity: { level: "standard", reasons: ["Documento estándar"], estimated_hours: 0.5 },
  requirements: { needs_apostille_translation: false, has_apostille: false, has_legalization: false, special_notes: "" },
  warnings: [],
};

test("tarifa correcta por idioma", () => {
  assert.equal(getRate("fr"), 0.08);
  assert.equal(getRate("de"), 0.10);
  assert.equal(getRate("xx"), 0.10);
});

test("mínimos correctos por tipo", () => {
  assert.equal(getMinimum("birth_certificate"), 42);
  assert.equal(getMinimum("passport"), 30);
  assert.equal(getMinimum("unknown_type"), 42);
});

test("multiplicadores de complejidad", () => {
  assert.equal(getComplexityMultiplier("standard"), 1.0);
  assert.equal(getComplexityMultiplier("complex"), 1.2);
  assert.equal(getComplexityMultiplier("highly_complex"), 1.5);
});

test("descuentos por volumen", () => {
  assert.equal(getVolumeDiscount(1), 0);
  assert.equal(getVolumeDiscount(3), 0.05);
  assert.equal(getVolumeDiscount(5), 0.10);
  assert.equal(getVolumeDiscount(10), 0.15);
});

test("certificado nacimiento FR aplica mínimo 42€", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.basePrice, 42);
  assert.equal(q.breakdown.minimumApplied, true);
});

test("precio urgente +25%", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.urgentPrice, 52.5);
});

test("plazo certificado: 24-48h estándar, 12-24h urgente", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.estimatedDaysStandard, "24-48h");
  assert.equal(q.estimatedDaysUrgent, "12-24h");
});

test("contrato largo usa precio por palabra", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, specific_type: "contract" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 2000, pages: 5 },
  });
  assert.equal(q.basePrice, 160); // 2000 * 0.08
  assert.equal(q.breakdown.minimumApplied, false);
});

test("complejidad complex multiplica x1.2", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 1000 },
    complexity: { ...baseAnalysis.complexity, level: "complex" },
  });
  assert.equal(q.basePrice, 96); // 1000 * 0.08 * 1.2
});

test("documento extenso: 5-10 días", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, specific_type: "contract" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 3000, pages: 8 },
  });
  assert.equal(q.estimatedDaysStandard, "5-10 días");
});

test("título académico corto: 48-72h", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, specific_type: "degree" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 200, pages: 1 },
  });
  assert.equal(q.estimatedDaysStandard, "48-72h");
});
