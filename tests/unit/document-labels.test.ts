import test from "node:test";
import assert from "node:assert/strict";
import { documentTypeLabel } from "../../lib/document-labels.ts";

test("código conocido sale en español", () => {
  assert.equal(documentTypeLabel("criminal_record"), "Antecedentes penales");
});
test("código desconocido sin guiones bajos", () => {
  assert.equal(documentTypeLabel("foo_bar"), "foo bar");
});
test("texto libre sale tal cual", () => {
  assert.equal(documentTypeLabel("Certificado de Notas 2024"), "Certificado de Notas 2024");
});
test("vacío", () => {
  assert.equal(documentTypeLabel(null), undefined);
  assert.equal(documentTypeLabel("  "), undefined);
});
