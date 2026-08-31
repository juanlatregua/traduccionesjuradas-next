import test from "node:test";
import assert from "node:assert/strict";
import { assessAutoPriceRisk, matchesFiscalForm } from "../../lib/ai/price-risk.ts";

// matchesFiscalForm: gate por título (estimador legado + server /api/orders).
test("matchesFiscalForm reconoce formularios fiscales por título y no falsos positivos", () => {
  assert.equal(matchesFiscalForm("1099-MISC Valentina"), true);
  assert.equal(matchesFiscalForm("Modelo 303 IVA"), true);
  assert.equal(matchesFiscalForm("W-2 wage statement"), true);
  assert.equal(matchesFiscalForm("Certificado de nacimiento"), false);
  assert.equal(matchesFiscalForm("modelo 3 del vehículo"), false);
  assert.equal(matchesFiscalForm(""), false);
});

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

test("bilingüe co-oficial (is_bilingual_duplicate) se marca de riesgo → no autotarifica", () => {
  // El conteo /2 depende de una señal NO determinista del modelo: un humano
  // confirma el precio antes de cobrar (red de seguridad #149).
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_metrics: { estimated_words: 700, pages: 2, is_bilingual_duplicate: true } }),
  });
  assert.equal(risk.risky, true);
  assert.ok(risk.reasons.includes("bilingual_duplicate"));
});

test("documento normal (is_bilingual_duplicate false) NO añade riesgo bilingüe", () => {
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_metrics: { estimated_words: 700, pages: 2, is_bilingual_duplicate: false } }),
  });
  assert.equal(risk.reasons.includes("bilingual_duplicate"), false);
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

// ─── Documento extenso: el conteo es extrapolado, no contado ───
// Incidente real (26-ago-2026): un PDF de 291 páginas se autotarificó en
// 24.552 € con el semáforo en verde, pese a que el propio modelo pedía
// cotización manual. Y medido el 27-ago: la MISMA sentencia de 4 páginas dio
// entre 950 y 1.350 palabras en 19 pasadas idénticas.

test("documento de muchas páginas NO autotarifica (conteo extrapolado)", () => {
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_metrics: { estimated_words: 800, pages: 291 } }),
  });
  assert.equal(risk.risky, true);
  assert.ok(risk.reasons.includes("oversized_estimate"));
});

test("documento con muchas palabras NO autotarifica aunque tenga pocas páginas", () => {
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_metrics: { estimated_words: 12000, pages: 3 } }),
  });
  assert.equal(risk.risky, true);
  assert.ok(risk.reasons.includes("oversized_estimate"));
});

test("justo en el límite (5 págs, 3000 palabras) SIGUE autotarificando", () => {
  const risk = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_metrics: { estimated_words: 3000, pages: 5 } }),
  });
  assert.equal(risk.reasons.includes("oversized_estimate"), false);
});

test("el certificado normal de 1-2 páginas no se ve afectado", () => {
  for (const [pages, words] of [[1, 280], [2, 620], [4, 1500]] as const) {
    const risk = assessAutoPriceRisk({
      analysis: fakeAnalysis({ document_metrics: { estimated_words: words, pages } }),
    });
    assert.equal(risk.risky, false, `${pages} págs / ${words} palabras no debería ser de riesgo`);
  }
});

// --- Apostilla SOLA (caso Bernardo, 31-ago-2026) ----------------------------

test("apostilla suelta clasificada como el documento ausente: FRENA (caso Bernardo)", () => {
  // El clasificador leyo "Tipo de Documento: Antecedentes Criminais" DE la
  // apostilla y tarifico 97,81 € por un documento que no estaba.
  const r = assessAutoPriceRisk({
    analysis: fakeAnalysis({
      document_type: { category: "legal", specific_type: "criminal_record", specific_type_es: "antecedentes penales" },
      document_metrics: { estimated_words: 502, pages: 1 },
    }),
    extractedText: "BRASIL APOSTILLE (Convention de La Haye du 5 octobre 1961) 1. Pais ... Tipo de Documento: Declaracao/Antecedentes Criminais",
  });
  assert.equal(r.risky, true);
  assert.ok(r.reasons.includes("apostille_only"));
});

test("el flag del modelo frena aunque el texto no llegue", () => {
  const r = assessAutoPriceRisk({
    analysis: fakeAnalysis({ document_metrics: { estimated_words: 400, pages: 1, is_apostille_only: true } }),
  });
  assert.ok(r.reasons.includes("apostille_only"));
});

test("documento CON su apostilla adjunta NO frena (personbevis sueco, 3 pags)", () => {
  const r = assessAutoPriceRisk({
    analysis: fakeAnalysis({
      document_type: { category: "civil", specific_type: "population_register", specific_type_es: "padron" },
      document_metrics: { estimated_words: 420, pages: 3 },
    }),
    extractedText: "Swedish Tax Agency EXTRACT OF THE POPULATION REGISTER ... APOSTILLE (Convention de La Haye du 5 octobre 1961) Certified",
  });
  assert.equal(r.reasons.includes("apostille_only"), false);
});

test("apostilla bien clasificada como apostilla (analisis viejo, 1 pag): la heuristica no la re-frena", () => {
  const r = assessAutoPriceRisk({
    analysis: fakeAnalysis({
      document_type: { category: "legal", specific_type: "apostille", specific_type_es: "apostilla" },
      document_metrics: { estimated_words: 489, pages: 1 },
    }),
    extractedText: "APOSTILLE (Convention de La Haye du 5 octobre 1961) ...",
  });
  assert.equal(r.reasons.includes("apostille_only"), false);
});
