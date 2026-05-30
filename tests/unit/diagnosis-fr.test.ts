import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnosis } from "../../lib/diagnosis.ts";

// Fixture mínimo: buildDiagnosis solo lee unos pocos campos del análisis.
function fixture(source: string, target: string, specificType = "criminal_record") {
  return {
    document_type: {
      specific_type: specificType,
      specific_type_es: "Antecedentes penales",
      category: "legal",
      confidence: 0.9,
    },
    language: { source, target, source_name: "Francés", target_name: "Español" },
    document_metrics: { pages: 1 },
  } as any;
}
const quote = { basePrice: 42, totalPrice: 50.82 } as any;

test("diagnóstico FR: contenido (no solo etiquetas) en francés", () => {
  const d = buildDiagnosis(fixture("fr", "es"), quote, "fr");
  assert.equal(d.type.label, "Casier judiciaire"); // tipo traducido, no specific_type_es
  assert.match(d.sworn.statement, /assermenté/);
  assert.match(d.validity.swornTranslation, /n'expire pas/);
  assert.match(d.validity.originalDocument || "", /casier judiciaire/);
  assert.equal(d.delivery.label, "24 heures"); // FR, 1 página → 24h
});

test("diagnóstico ES por defecto sigue en español", () => {
  const d = buildDiagnosis(fixture("fr", "es"), quote);
  assert.match(d.sworn.statement, /traductor jurado/);
  assert.match(d.validity.swornTranslation, /no caduca/);
  assert.equal(d.delivery.label, "24 horas");
});

test("dirección outbound (ES→extranjero) cambia la frase de validez", () => {
  const inbound = buildDiagnosis(fixture("fr", "es"), quote, "fr");
  const outbound = buildDiagnosis(fixture("es", "fr"), quote, "fr");
  assert.match(inbound.sworn.statement, /en Espagne/);
  assert.match(outbound.sworn.statement, /pays de destination/);
});
