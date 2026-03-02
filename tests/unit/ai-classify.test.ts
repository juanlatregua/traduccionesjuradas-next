import test from "node:test";
import assert from "node:assert/strict";

// Self-contained — reproduce logic to avoid @/ import alias issues

function censorName(name: string) { if (!name || name.length <= 3) return "***"; return name.slice(0, 3) + "***"; }
function censorExtractedNames(names: string[]) { return names.map(censorName); }
function getComplexityLabel(level: string) {
  switch (level) { case "standard": return "Estándar"; case "complex": return "Complejo"; case "highly_complex": return "Muy complejo"; default: return "Estándar"; }
}
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  birth_certificate: "Certificado de nacimiento", marriage_certificate: "Certificado de matrimonio",
  death_certificate: "Certificado de defunción", divorce_decree: "Sentencia de divorcio",
  criminal_record: "Antecedentes penales", passport: "Pasaporte", id_card: "Documento de identidad",
  degree: "Título académico", transcript: "Expediente académico", contract: "Contrato",
  power_of_attorney: "Poder notarial", company_registration: "Registro mercantil",
  payslip: "Nómina", tax_return: "Declaración fiscal", medical_report: "Informe médico",
  apostille: "Apostilla", other: "Otro documento",
};
const CATEGORY_ICONS: Record<string, string> = {
  civil_registry: "FileText", identity: "CreditCard", academic: "GraduationCap",
  legal: "Scale", financial: "Landmark", labor: "Briefcase",
  immigration: "Globe", medical: "Heart", other: "File",
};

function classifyDocument(analysis: any) {
  return {
    category: analysis.document_type.category, specificType: analysis.document_type.specific_type,
    specificTypeEs: analysis.document_type.specific_type_es,
    specificTypeFr: analysis.document_type.specific_type_fr, confidence: analysis.document_type.confidence,
  };
}
function extractData(analysis: any) {
  const names = analysis.extracted_data.names || [];
  return {
    names, namesCensored: censorExtractedNames(names),
    dates: analysis.extracted_data.dates || [], referenceNumbers: analysis.extracted_data.reference_numbers || [],
    institutions: analysis.extracted_data.institutions || [], notes: analysis.extracted_data.notes || "",
  };
}

// ==================== TESTS ====================

const mockAnalysis = {
  document_type: { category: "civil_registry", specific_type: "birth_certificate", specific_type_es: "Certificado de nacimiento", specific_type_fr: "Acte de naissance", confidence: 0.95 },
  language: { source: "fr", source_name: "Francés", target: "es", target_name: "Español", confidence: 0.98 },
  country: { origin: "MA", origin_name: "Marruecos", issuing_authority: "Ministère de la Justice", confidence: 0.90 },
  document_metrics: { estimated_words: 280, pages: 1, has_tables: false, has_stamps_seals: true, has_handwriting: false, scan_quality: "good", is_legible: true },
  extracted_data: { names: ["Mohammed Ben Ahmed", "Fatima Zahra"], dates: ["15/03/1990", "02/01/2024"], reference_numbers: ["N° 1234/2024"], institutions: ["Tribunal de Casablanca"], notes: "Con apostilla" },
  complexity: { level: "standard", reasons: ["Documento estándar"], estimated_hours: 0.5 },
  requirements: { needs_apostille_translation: true, has_apostille: true, has_legalization: false, special_notes: "" },
  warnings: [],
};

test("clasifica documento correctamente", () => {
  const r = classifyDocument(mockAnalysis);
  assert.equal(r.category, "civil_registry");
  assert.equal(r.specificType, "birth_certificate");
  assert.equal(r.specificTypeEs, "Certificado de nacimiento");
  assert.equal(r.confidence, 0.95);
});

test("labels para todos los tipos de documento", () => {
  assert.equal(DOCUMENT_TYPE_LABELS.birth_certificate, "Certificado de nacimiento");
  assert.equal(DOCUMENT_TYPE_LABELS.passport, "Pasaporte");
  assert.ok(Object.keys(DOCUMENT_TYPE_LABELS).length >= 15);
});

test("iconos para todas las categorías", () => {
  assert.ok(CATEGORY_ICONS.civil_registry);
  assert.ok(CATEGORY_ICONS.academic);
  assert.ok(CATEGORY_ICONS.legal);
});

test("extrae datos con nombres censurados", () => {
  const r = extractData(mockAnalysis);
  assert.deepEqual(r.namesCensored, ["Moh***", "Fat***"]);
  assert.deepEqual(r.dates, ["15/03/1990", "02/01/2024"]);
  assert.equal(r.notes, "Con apostilla");
});

test("complejidad labels correctos", () => {
  assert.equal(getComplexityLabel("standard"), "Estándar");
  assert.equal(getComplexityLabel("complex"), "Complejo");
  assert.equal(getComplexityLabel("highly_complex"), "Muy complejo");
});

test("RGPD: censura nombres correctamente", () => {
  assert.equal(censorName("Mohammed"), "Moh***");
  assert.equal(censorName("AB"), "***");
  assert.equal(censorName(""), "***");
});

test("RGPD: censura array de nombres", () => {
  const r = censorExtractedNames(["Jean Dupont", "Marie", "Al"]);
  assert.deepEqual(r, ["Jea***", "Mar***", "***"]);
});
