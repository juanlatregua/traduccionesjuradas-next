import test from "node:test";
import assert from "node:assert/strict";
import { applyEdit, apostilleCount, labelOf, workingFromReading } from "../../../lib/lectura-constructor/documents.ts";
import { buildLines } from "../../../lib/lectura-constructor/lines.ts";
import { FR_APOSTILLE_EXTRA_CENTS, priceFrToEs } from "../../../lib/dinero/tariff-fr.ts";
import { ap, doc } from "../lectura/fixtures.ts";
import { newId, working } from "./fakes.ts";

test("reading → working documents keep their own review reasons only", () => {
  const docs = [doc("D1", [[1, 1]]), doc("D2", [[2, 1]])].map((d) => ({ ...d, pageCount: 1, words: 100, wordsBasis: "exact" as const }));
  const w = workingFromReading(docs, [{ code: "legibility", detail: "legibilidad medium", documentId: "D2" }, { code: "questions", detail: "1 pregunta" }], newId);
  assert.equal(w[0].reasons.length, 0);
  assert.equal(w[1].reasons[0].code, "legibility");
  assert.equal(w[1].position, 1);
});

test("merge: four photos of a will are one document; the apostille stays with it", () => {
  const docs = [1, 2, 3, 4].map((i) => working(`D${i}`, [[i, 1]], { typeLabelEs: "Testamento", apostille: i === 4 ? ap([], { number: "9" }) : null }, { position: i - 1, words: 100 }));
  const r = applyEdit(docs, { op: "merge", ids: docs.map((d) => d.id) }, "juan@x", newId);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.documents.length, 1);
  const m = r.documents[0];
  assert.deepEqual(m.parts.map((p) => p.fileIndex), [1, 2, 3, 4]);
  assert.equal(m.pageCount, 4);
  assert.equal(m.words, 400);
  assert.equal(m.docKey, "D1+D2+D3+D4");
  assert.equal(labelOf(m), "Testamento — apostilla");
  assert.ok(m.reasons.some((x) => x.code === "person_edit"));
  assert.equal(m.manualPriceCents, null);
});

test("merge needs two existing documents", () => {
  const docs = [working("D1", [[1, 1]])];
  assert.equal(applyEdit(docs, { op: "merge", ids: [docs[0].id] }, "j", newId).ok, false);
  assert.equal(applyEdit(docs, { op: "merge", ids: [docs[0].id, "nope"] }, "j", newId).ok, false);
});

test("split: body pages divided, apostille stays with the first part, words become estimated", () => {
  const d = working("D1", [[1, 1], [1, 2], [1, 3]], { apostille: ap([[2, 1]]) }, { words: 300 });
  const r = applyEdit([d], { op: "split", id: d.id, at: 1 }, "j", newId);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const [a, b] = r.documents;
  assert.equal(a.parts.length, 1);
  assert.equal(b.parts.length, 2);
  assert.notEqual(a.apostille, null);
  assert.equal(b.apostille, null);
  assert.equal(a.words + b.words, 300);
  assert.equal(a.wordsBasis, "estimated");
  assert.deepEqual(r.documents.map((x) => x.position), [0, 1]);
  assert.equal(applyEdit([d], { op: "split", id: d.id, at: 3 }, "j", newId).ok, false);
});

test("exclude needs a reason; include clears it; setType renames", () => {
  const d = working("D1", [[1, 1]]);
  assert.equal(applyEdit([d], { op: "exclude", id: d.id, reason: " " }, "j", newId).ok, false);
  const ex = applyEdit([d], { op: "exclude", id: d.id, reason: "pasaporte para identificarse" }, "j", newId);
  assert.ok(ex.ok && !ex.documents[0].included && ex.documents[0].excludedReason === "pasaporte para identificarse");
  const back = ex.ok ? applyEdit(ex.documents, { op: "include", id: d.id }, "j", newId) : ex;
  assert.ok(back.ok && back.documents[0].included && back.documents[0].excludedReason === null);
  const t = applyEdit([d], { op: "setType", id: d.id, type: "marriage_certificate", typeLabelEs: "Certificado de matrimonio" }, "j", newId);
  assert.ok(t.ok && t.documents[0].type === "marriage_certificate" && labelOf(t.documents[0]) === "Certificado de matrimonio");
});

test("setType can also fix the source language the reading got wrong", () => {
  const d = working("D1", [[1, 1]], { sourceLang: "unknown" });
  const r = applyEdit([d], { op: "setType", id: d.id, type: "birth_certificate", typeLabelEs: "Certificado de nacimiento", sourceLang: "fr" }, "j", newId);
  assert.ok(r.ok && r.documents[0].sourceLang === "fr");
});

test("merge of an included deed with an excluded annex stays included; all excluded keeps the reasons", () => {
  const acta = working("D1", [[1, 1], [1, 2]], { type: "other", typeLabelEs: "Acta notarial" }, { position: 0 });
  const anexo = working("D2", [[1, 3]], { typeLabelEs: "Certificado de defunción" }, { position: 1, included: false, excludedReason: "parecía repetido" });
  const r = applyEdit([acta, anexo], { op: "merge", ids: [acta.id, anexo.id] }, "j", newId);
  assert.ok(r.ok && r.documents.length === 1 && r.documents[0].included && r.documents[0].excludedReason === null);
  const a = { ...acta, included: false, excludedReason: "duplicado" };
  const both = applyEdit([a, anexo], { op: "merge", ids: [a.id, anexo.id] }, "j", newId);
  assert.ok(both.ok && !both.documents[0].included && both.documents[0].excludedReason === "duplicado · parecía repetido");
});

test("merging documents with apostilles counts every apostille and names every number read", () => {
  const d1 = working("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: "A-1" }) }, { position: 0 });
  const d2 = working("D2", [[3, 1]], { apostille: ap([[4, 1]], { number: "B-2" }) }, { position: 1 });
  const d3 = working("D3", [[5, 1]], { apostille: ap([[6, 1]], { number: null }) }, { position: 2 });
  const r = applyEdit([d1, d2, d3], { op: "merge", ids: [d1.id, d2.id, d3.id] }, "j", newId);
  assert.ok(r.ok);
  if (!r.ok) return;
  const m = r.documents[0];
  assert.equal(apostilleCount(m.apostille), 3);
  assert.equal(labelOf(m), "Certificado de nacimiento — 3 apostillas n.º A-1, B-2 (1 n.º no legible)");
  const again = applyEdit([m, working("D4", [[7, 1]], { apostille: ap([[8, 1]], { number: "C-3" }) }, { position: 1 })], { op: "merge", ids: [m.id, "w-D4"] }, "j", newId);
  assert.ok(again.ok && apostilleCount(again.documents[0].apostille) === 4);
  const lines = buildLines([m], [], "es");
  const expected = priceFrToEs({ docType: "birth_certificate", category: "civil_registry", pages: 3, words: m.words, apostille: true, apostilles: 3, apostilleOnSeparatePage: false });
  const base = priceFrToEs({ docType: "birth_certificate", category: "civil_registry", pages: 3, words: m.words, apostille: false, apostilleOnSeparatePage: false });
  assert.ok(expected.kind === "priced" && base.kind === "priced");
  if (expected.kind !== "priced" || base.kind !== "priced") return;
  assert.equal(expected.cents - base.cents, 3 * FR_APOSTILLE_EXTRA_CENTS);
  assert.equal(lines.lines[0].unitPriceCents, expected.cents);
});
