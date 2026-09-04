import test from "node:test";
import assert from "node:assert/strict";
import { applyDeclaredLanguages, isDeclaredPairValid, normalizeDeclaredLang } from "../../lib/puerta-languages.ts";

const ai = () => ({
  language: { source: "es", source_name: "Español", target: "unknown", target_name: "", confidence: 0.9 },
  other: 1,
});

test("el par declarado pisa lo detectado y conserva lo detectado", () => {
  const r = applyDeclaredLanguages(ai(), { source: "es", target: "en" });
  assert.equal(r.language.source, "es");
  assert.equal(r.language.target, "en");
  assert.equal(r.language.target_name, "Inglés");
  assert.equal(r.language.declared, true);
  assert.deepEqual(r.language.detected, { source: "es", target: "unknown" });
  assert.equal(r.other, 1);
});

test("sin declaración no toca nada; 'other' no pisa el origen detectado", () => {
  assert.deepEqual(applyDeclaredLanguages(ai(), {}), ai());
  const r = applyDeclaredLanguages({ language: { source: "he", source_name: "Hebreo", target: "es", target_name: "Español", confidence: 1 } }, { source: "other", target: "es" });
  assert.equal(r.language.source, "he", "la IA sabe más que un 'otro'");
  assert.equal(r.language.target, "es");
});

test("validación del par: códigos de la lista y origen ≠ destino", () => {
  assert.equal(isDeclaredPairValid("fr", "es"), true);
  assert.equal(isDeclaredPairValid("es", "es"), false);
  assert.equal(isDeclaredPairValid("xx", "es"), false);
  assert.equal(isDeclaredPairValid("", "es"), false);
  assert.equal(normalizeDeclaredLang(" FR "), "fr");
  assert.equal(normalizeDeclaredLang("unknown"), null);
});
