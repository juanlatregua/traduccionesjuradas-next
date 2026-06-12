import test from "node:test";
import assert from "node:assert/strict";
import { assessAutoPriceRisk } from "../../lib/ai/price-risk.ts";

// Análisis mínimo válido para las pruebas (solo lo que mira assessAutoPriceRisk).
function fakeAnalysis(over: any = {}): any {
  return {
    document_type: { category: "other", specific_type: "other", specific_type_es: "", ...(over.document_type || {}) },
    document_metrics: { estimated_words: 100, pages: 1, ...(over.document_metrics || {}) },
    ...over,
  };
}

// Plantilla de ~30 palabras distintas que, repetida 8 veces, imita un formulario
// multi-copia (≥25 trigramas distintos reapareciendo).
const FORM_COPY =
  "rents royalties other income federal withheld fishing boat proceeds medical health care payments substitute " +
  "dividends interest gross crop insurance excess golden parachute nonqualified compensation payer recipient street address city ";

// ─── DEBE marcar de riesgo ───

test("1099-MISC (identificador de formulario + multi-copia) se marca de riesgo", () => {
  const text = "Form 1099-MISC " + FORM_COPY.repeat(8);
  const risk = assessAutoPriceRisk({ analysis: fakeAnalysis(), extractedText: text, fileName: "1099.pdf" });
  assert.equal(risk.risky, true);
  assert.ok(risk.reasons.includes("fiscal_financial"));
  assert.ok(risk.reasons.includes("repeated_copies"));
});

test("multi-copia sin marcador fiscal se marca por repeated_copies", () => {
  const risk = assessAutoPriceRisk({ analysis: fakeAnalysis(), extractedText: FORM_COPY.repeat(8) });
  assert.equal(risk.risky, true);
  assert.deepEqual(risk.reasons, ["repeated_copies"]);
});

test("categoría financial se marca de riesgo aunque el texto sea corto", () => {
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_type: { category: "financial", specific_type: "other" } }),
  });
  assert.deepEqual(risk.reasons, ["fiscal_financial"]);
});

test("nómina (payslip) por specific_type se marca de riesgo", () => {
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_type: { category: "labor", specific_type: "payslip" } }),
  });
  assert.equal(risk.risky, true);
});

test("modelo 303 (IVA) se marca de riesgo", () => {
  const risk = assessAutoPriceRisk({ analysis: fakeAnalysis(), extractedText: "Agencia Tributaria modelo 303 autoliquidación IVA" });
  assert.ok(risk.reasons.includes("fiscal_financial"));
});

test("texto pegado/concatenado (>15%) se marca de riesgo", () => {
  const glued = Array.from({ length: 50 }, (_, i) => `Token${i}ConcatenadoLargoSinEspaciosNiNada${i}`).join(" ");
  const risk = assessAutoPriceRisk({ analysis: fakeAnalysis(), extractedText: glued });
  assert.ok(risk.reasons.includes("suspicious_text"));
});

// ─── NO debe marcar de riesgo (falsos positivos que cuestan ventas) ───

test("certificado de nacimiento con NIF / 'a efectos fiscales' NO es de riesgo", () => {
  const text =
    "Certificado literal de nacimiento. Doña María García López, con NIF 12345678Z y domicilio fiscal en Málaga, " +
    "a efectos fiscales y tributarios. Inscrita en el Registro Civil de Málaga, tomo 1040, página 45.";
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_type: { category: "civil_registry", specific_type: "birth_certificate" } }),
    extractedText: text,
    fileName: "nacimiento-fiscal.pdf",
  });
  assert.equal(risk.risky, false);
});

test("expediente académico con asignaturas repetidas NO es de riesgo", () => {
  let text = "Universidad de Málaga expediente académico del alumno. ";
  for (let i = 0; i < 30; i++) text += `asignatura ${i} convocatoria ordinaria aprobado notable créditos ects superados materia troncal `;
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_type: { category: "academic", specific_type: "transcript" } }),
    extractedText: text,
  });
  assert.equal(risk.risky, false);
});

test("contrato con boilerplate jurídico repetido NO es de riesgo", () => {
  let text = "Contrato de arrendamiento. ";
  for (let i = 0; i < 15; i++) text += `las partes acuerdan que de conformidad con lo dispuesto a todos los efectos legales cláusula ${i}. `;
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_type: { category: "legal", specific_type: "contract" } }),
    extractedText: text,
  });
  assert.equal(risk.risky, false);
});

test("certificado plurilingüe (mismo texto en 3 idiomas) NO es de riesgo", () => {
  const acta = "certificado de nacimiento inscrito en el registro civil tomo página fecha lugar nombre apellidos ";
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_type: { category: "civil_registry", specific_type: "birth_certificate" } }),
    extractedText: "ES " + acta + " FR " + acta + " EN " + acta,
  });
  assert.equal(risk.risky, false);
});

test("'modelo 3 del vehículo' NO dispara el matcher fiscal", () => {
  const risk = assessAutoPriceRisk({ analysis: fakeAnalysis(), extractedText: "permiso de circulación modelo 3 del vehículo marca Tesla" });
  assert.equal(risk.risky, false);
});
