import test from "node:test";
import assert from "node:assert/strict";
import { validateReading } from "../../../lib/lectura/validate.ts";
import { doc, reading, files } from "./fixtures.ts";

test("full, exact coverage validates", () => {
  const r = reading(
    [doc("D1", [[1, 1], [1, 2]], { apostille: { parts: [{ fileIndex: 2, page: 1 }], onDocumentPage: false } }), doc("D2", [[3, 1]])],
    { notToTranslate: [{ parts: [{ fileIndex: 4, page: 1 }], kind: "identity_doc", reason: "DNI para identificarse" }] },
  );
  assert.deepEqual(validateReading(files([2, 1, 1, 1]), r), []);
});

test("a page left out is reported", () => {
  const errors = validateReading(files([3]), reading([doc("D1", [[1, 1], [1, 3]])]));
  assert.deepEqual(errors, ["archivo 1 pág. 2 no está asignada a nada."]);
});

test("a page used twice is reported with both places", () => {
  const r = reading([doc("D1", [[1, 1]]), doc("D2", [[1, 1], [1, 2]])]);
  const errors = validateReading(files([2]), r);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /archivo 1 pág. 1 está asignada varias veces: el documento D1, el documento D2/);
});

test("a shared apostille is named as such", () => {
  const ap = { parts: [{ fileIndex: 2, page: 1 }], onDocumentPage: false };
  const errors = validateReading(files([1, 1, 1]), reading([doc("D1", [[1, 1]], { apostille: ap }), doc("D2", [[3, 1]], { apostille: ap })]));
  assert.ok(errors.some((e) => /apostilla compartida/.test(e)));
});

test("references out of range and duplicate ids", () => {
  const r = reading([doc("D1", [[1, 1], [1, 4], [9, 1]]), doc("D1", [[2, 1]])], {
    duplicates: [{ parts: [{ fileIndex: 3, page: 1 }], duplicateOf: { documentId: "D7", parts: [] } }],
  });
  const errors = validateReading(files([1, 1, 1]), r);
  assert.ok(errors.includes("el documento D1 cita archivo 1 pág. 4, que no existe."));
  assert.ok(errors.includes("el documento D1 cita archivo 9 pág. 1, que no existe."));
  assert.ok(errors.includes("El id D1 está repetido."));
  assert.ok(errors.includes("duplicates[0] apunta al documento D7, que no existe."));
});

test("unknown target language needs a target_lang question", () => {
  const r = reading([doc("D1", [[1, 1]], { sourceLang: "es" })], { targetLang: "unknown", targetLangBasis: "unknown" });
  assert.deepEqual(validateReading(files([1]), r), ["El idioma de destino es desconocido y no hay ninguna pregunta de tipo target_lang."]);
  r.questions.push({ kind: "target_lang", aboutParts: [], aboutDocumentId: "D1", textEs: "¿A qué idioma lo traducimos?" });
  assert.deepEqual(validateReading(files([1]), r), []);
});

test("missing pages need a missing_pages question; an apostille must be somewhere", () => {
  const r = reading([
    doc("D1", [[1, 1], [1, 2], [1, 3]], { declaredPages: 7, missingPages: [3, 4, 6, 7] }),
    doc("D2", [[2, 1]], { apostille: { parts: [], onDocumentPage: false } }),
  ]);
  const errors = validateReading(files([3, 1]), r);
  assert.ok(errors.some((e) => /missing_pages/.test(e)));
  assert.ok(errors.some((e) => /La apostilla de D2 no tiene hojas propias/.test(e)));
});

test("instruction pages count for coverage", () => {
  const r = reading([doc("D1", [[1, 1]])], { instructions: { parts: [{ fileIndex: 2, page: 1 }], authority: "Consulado", country: "FR", procedure: "visado", requirements: [] } });
  assert.deepEqual(validateReading(files([1, 1]), r), []);
});
