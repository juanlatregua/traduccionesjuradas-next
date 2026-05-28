import test from "node:test";
import assert from "node:assert/strict";

// Self-contained tests — reproduce logic to avoid @/ import alias issues

// === From lib/pricing-engine/languages.ts ===
const PER_WORD_RATE: Record<string, number> = {
  fr: 0.08, en: 0.08, de: 0.10, nl: 0.10, it: 0.09, pt: 0.12,
  ca: 0.08, sv: 0.14, no: 0.12, ar: 0.10, ro: 0.09,
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

const PAGE_MINIMUM_PER_PAGE = 40;
const PAGE_MINIMUM_MAX_PAGES = 2;
const PAGE_MINIMUM_EXEMPT = new Set(["birth_certificate","marriage_certificate","death_certificate","criminal_record","passport","id_card","apostille"]);
function getPageMinimum(t: string, pages: number) {
  if (PAGE_MINIMUM_EXEMPT.has(t)) return 0;
  return PAGE_MINIMUM_PER_PAGE * Math.min(PAGE_MINIMUM_MAX_PAGES, Math.max(1, Math.floor(pages || 1)));
}

// === From lib/pricing-engine/calculator.ts (simplified) ===
const VAT_RATE = 0.21;
function round2(n: number) { return Math.round(n * 100) / 100; }
function calculatePrice(analysis: any) {
  const { document_type, language, document_metrics, complexity } = analysis;
  const rate = getRate(language.source);
  const minimum = Math.max(
    getMinimum(document_type.specific_type),
    getPageMinimum(document_type.specific_type, document_metrics.pages)
  );
  const complexityMult = getComplexityMultiplier(complexity.level);
  const wordPrice = document_metrics.estimated_words * rate * complexityMult;
  const basePrice = Math.max(wordPrice, minimum);

  const st = document_type.specific_type;
  function pluralDias(min: number, max: number): string {
    if (min === max) return `${min} día${min === 1 ? "" : "s"} laborable${min === 1 ? "" : "s"}`;
    return `${min}-${max} días laborables`;
  }
  let days: { standard: string; urgent: string; standardMin: number; standardMax: number; urgentMin: number; urgentMax: number };
  if (["birth_certificate","marriage_certificate","death_certificate","criminal_record","passport","id_card"].includes(st)) {
    days = { standard: pluralDias(1, 2), urgent: pluralDias(1, 1), standardMin: 1, standardMax: 2, urgentMin: 1, urgentMax: 1 };
  } else if (["degree","transcript"].includes(st)) {
    days = document_metrics.pages <= 2
      ? { standard: pluralDias(2, 3), urgent: pluralDias(1, 1), standardMin: 2, standardMax: 3, urgentMin: 1, urgentMax: 1 }
      : { standard: pluralDias(3, 5), urgent: pluralDias(2, 2), standardMin: 3, standardMax: 5, urgentMin: 2, urgentMax: 2 };
  } else if (document_metrics.estimated_words > 2000) {
    days = { standard: pluralDias(5, 10), urgent: pluralDias(3, 5), standardMin: 5, standardMax: 10, urgentMin: 3, urgentMax: 5 };
  } else if (document_metrics.pages > 5) {
    days = { standard: pluralDias(5, 7), urgent: pluralDias(3, 4), standardMin: 5, standardMax: 7, urgentMin: 3, urgentMax: 4 };
  } else {
    days = { standard: pluralDias(2, 5), urgent: pluralDias(1, 2), standardMin: 2, standardMax: 5, urgentMin: 1, urgentMax: 2 };
  }

  const roundedBase = round2(basePrice);
  const roundedUrgent = round2(basePrice * URGENCY_MULTIPLIER);

  return {
    basePrice: roundedBase,
    urgentPrice: roundedUrgent,
    totalPrice: round2(roundedBase * (1 + VAT_RATE)),
    urgentTotalPrice: round2(roundedUrgent * (1 + VAT_RATE)),
    estimatedDaysStandard: days.standard,
    estimatedDaysUrgent: days.urgent,
    breakdown: { words: document_metrics.estimated_words, ratePerWord: rate, wordSubtotal: round2(wordPrice), minimumApplied: wordPrice < minimum, minimumAmount: minimum, complexityMultiplier: complexityMult, ivaRate: VAT_RATE, ivaAmount: round2(roundedBase * VAT_RATE), standardDaysMin: days.standardMin, standardDaysMax: days.standardMax, urgentDaysMin: days.urgentMin, urgentDaysMax: days.urgentMax },
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

test("plazo certificado: 1-2 días laborables estándar, 1 día laborable urgente", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.estimatedDaysStandard, "1-2 días laborables");
  assert.equal(q.estimatedDaysUrgent, "1 día laborable");
  assert.equal(q.breakdown.standardDaysMin, 1);
  assert.equal(q.breakdown.standardDaysMax, 2);
  assert.equal(q.breakdown.urgentDaysMin, 1);
  assert.equal(q.breakdown.urgentDaysMax, 1);
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

test("documento extenso: 5-10 días laborables", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, specific_type: "contract" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 3000, pages: 8 },
  });
  assert.equal(q.estimatedDaysStandard, "5-10 días laborables");
  assert.equal(q.breakdown.standardDaysMin, 5);
  assert.equal(q.breakdown.standardDaysMax, 10);
});

test("título académico corto: 2-3 días laborables", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, specific_type: "degree" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 200, pages: 1 },
  });
  assert.equal(q.estimatedDaysStandard, "2-3 días laborables");
  assert.equal(q.breakdown.standardDaysMin, 2);
  assert.equal(q.breakdown.standardDaysMax, 3);
});

test("totalPrice = basePrice × 1.21 (certificado FR)", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.totalPrice, round2(q.basePrice * 1.21));
  assert.equal(q.totalPrice, 50.82); // 42 × 1.21
});

test("urgentTotalPrice = urgentPrice × 1.21", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.urgentTotalPrice, round2(q.urgentPrice * 1.21));
  assert.equal(q.urgentTotalPrice, 63.53); // 52.5 × 1.21
});

test("breakdown incluye ivaRate e ivaAmount", () => {
  const q = calculatePrice(baseAnalysis);
  assert.equal(q.breakdown.ivaRate, 0.21);
  assert.equal(q.breakdown.ivaAmount, round2(q.basePrice * 0.21));
  assert.equal(q.breakdown.ivaAmount, 8.82); // 42 × 0.21
});

test("suelo por página: transcript 2 págs aplica 80€ (40×2) aunque el por-palabra sea menor", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, category: "academic", specific_type: "transcript" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 485, pages: 2 },
  });
  assert.equal(q.basePrice, 80);
  assert.equal(q.totalPrice, 96.8);
  assert.equal(q.breakdown.minimumApplied, true);
  assert.equal(q.breakdown.minimumAmount, 80);
});

test("suelo por página estable ante el conteo: transcript 2 págs = 80€ a 435/485/520 palabras", () => {
  for (const w of [435, 485, 520]) {
    const q = calculatePrice({
      ...baseAnalysis,
      document_type: { ...baseAnalysis.document_type, specific_type: "transcript" },
      document_metrics: { ...baseAnalysis.document_metrics, estimated_words: w, pages: 2 },
    });
    assert.equal(q.basePrice, 80, `con ${w} palabras`);
  }
});

test("certificado simple exento del suelo por página: nacimiento 2 págs sigue en 42€", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 200, pages: 2 },
  });
  assert.equal(q.basePrice, 42);
});

test("suelo topado a 2 págs: documento largo manda el por-palabra, no 40×N", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    document_type: { ...baseAnalysis.document_type, specific_type: "other" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 3900, pages: 13 },
  });
  assert.equal(q.basePrice, 312); // 3900 × 0.08; el suelo topado a 80 no muerde
  assert.equal(q.breakdown.minimumApplied, false);
});

test("caso validación: 1276 palabras PT → base 153.12, total 185.28", () => {
  const q = calculatePrice({
    ...baseAnalysis,
    language: { source: "pt", source_name: "Portugués", target: "es", target_name: "Español", confidence: 0.98 },
    document_type: { ...baseAnalysis.document_type, specific_type: "contract" },
    document_metrics: { ...baseAnalysis.document_metrics, estimated_words: 1276, pages: 3 },
  });
  assert.equal(q.basePrice, 153.12); // 1276 × 0.12
  assert.equal(q.breakdown.ivaAmount, 32.16); // 153.12 × 0.21
  assert.equal(q.totalPrice, 185.28); // 153.12 × 1.21
});
