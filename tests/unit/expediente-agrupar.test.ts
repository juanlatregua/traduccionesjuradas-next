import test from "node:test";
import assert from "node:assert/strict";
import { applyGrouping, buildGroupingMapping, expedienteAgruparOn, type GroupableRow, type GroupingMapping } from "../../lib/expediente-agrupar.ts";
import { computeBase } from "../../lib/pricing-engine/calculator.ts";
import type { ModelReading, ReadDocumentRaw } from "../../lib/lectura/schema.ts";

type Row = GroupableRow & { sourceLang?: string };
let n = 0;
const newId = () => `new-${++n}`;

function row(p: Partial<Row> & { sourceAnalysisId: string }): Row {
  return {
    localId: `row-${p.sourceAnalysisId}-${p.pageStart ?? 1}`,
    fileName: `${p.sourceAnalysisId}.jpg`,
    status: "done",
    include: true,
    blobUrl: `https://blob/${p.sourceAnalysisId}`,
    pageStart: 1,
    pageEnd: 1,
    pages: 1,
    words: 100,
    documentType: "birth_certificate",
    sourceLang: "ar",
    unitPrice: 40,
    autoPriced: true,
    ...p,
  };
}

const part = (analysisId: string, pageStart = 1, pageEnd = pageStart) => ({ analysisId, pageStart, pageEnd });
const doc = (key: string, parts: ReturnType<typeof part>[], apostille: GroupingMapping["documents"][number]["apostille"] = null, words = 300) =>
  ({ key, labelEs: key, type: "birth_certificate", words, parts, apostille });
const mapping = (m: Partial<GroupingMapping>): GroupingMapping => ({ documents: [], duplicates: [], notToTranslate: [], questions: [], ...m });

test("interruptor: solo «on» activa la agrupación", () => {
  assert.equal(expedienteAgruparOn({ EXPEDIENTE_AGRUPAR: "on" }), true);
  assert.equal(expedienteAgruparOn({ EXPEDIENTE_AGRUPAR: " ON " }), true);
  assert.equal(expedienteAgruparOn({ EXPEDIENTE_AGRUPAR: "1" }), false);
  assert.equal(expedienteAgruparOn({}), false);
});

test("árabe 18-nov: 5 archivos son 3 documentos (páginas JPG juntas, una línea por documento)", () => {
  const rows = ["a1", "a2", "a3", "a4", "a5"].map((id) => row({ sourceAnalysisId: id }));
  const r = applyGrouping(rows, mapping({
    documents: [doc("D1", [part("a1"), part("a2")]), doc("D2", [part("a3")]), doc("D3", [part("a4"), part("a5")])],
  }), newId);
  assert.equal(r.applied, true);
  assert.equal(r.documents, 3);
  assert.equal(r.rows.length, 3);
  const [d1, d2, d3] = r.rows;
  assert.equal(d1.pages, 2);
  assert.equal(d1.words, 200);
  assert.equal(d1.unitPrice, 0, "el precio lo pone el motor del constructor, no la agrupación");
  assert.equal(d1.autoPriced, true);
  assert.deepEqual(d1.groupFiles?.map((f) => f.url), ["https://blob/a1", "https://blob/a2"]);
  assert.equal(d1.pageStart, 1);
  assert.equal(d1.pageEnd, 1);
  assert.equal(d2, rows[2], "un documento de un solo archivo se queda tal cual");
  assert.equal(d3.pages, 2);
  assert.equal(r.rows.filter((x) => x.include).length, 3);
});

test("registro civil + apostilla en archivo aparte: una línea apostillada y ninguna a 0 €", () => {
  const rows = [
    row({ sourceAnalysisId: "rc", fileName: "registro.pdf", documentType: "birth_certificate", sourceLang: "fr", words: 180 }),
    row({ sourceAnalysisId: "ap", fileName: "apostilla.pdf", documentType: "apostille", sourceLang: "fr", words: 60, unitPrice: 0, priceNote: "Apostilla suelta" }),
  ];
  const r = applyGrouping(rows, mapping({ documents: [doc("D1", [part("rc")], { parts: [part("ap")], onDocumentPage: false })] }), newId);
  assert.equal(r.applied, true);
  assert.equal(r.rows.length, 1);
  const [line] = r.rows;
  assert.equal(line.documentType, "birth_certificate");
  assert.equal(line.hasApostille, true);
  assert.equal(line.apostilleSeparatePage, true);
  assert.equal(line.pages, 2);
  assert.equal(line.words, 240);
  assert.equal(line.priceNote, undefined);
  assert.equal(line.blobUrl, "https://blob/rc");
  assert.ok(!r.rows.some((x) => x.documentType === "apostille"));
  // Mismo precio que hoy un acta de una hoja con su apostilla en el mismo PDF (+5 €, no una línea suelta a 0 €).
  const price = computeBase({ specificType: line.documentType!, foreignLang: "fr", words: line.words!, pages: line.pages!, hasApostille: line.hasApostille, apostilleSeparatePage: line.apostilleSeparatePage, inbound: true });
  const sameAsToday = computeBase({ specificType: "birth_certificate", foreignLang: "fr", words: 240, pages: 1, hasApostille: true, inbound: true });
  const withoutApostille = computeBase({ specificType: "birth_certificate", foreignLang: "fr", words: 180, pages: 1, inbound: true });
  assert.ok(price.basePrice > 0);
  assert.equal(price.basePrice, sameAsToday.basePrice);
  assert.ok(price.basePrice > withoutApostille.basePrice);
});

test("duplicado: fuera del presupuesto con nota visible; el original se queda", () => {
  const rows = [row({ sourceAnalysisId: "p1" }), row({ sourceAnalysisId: "p1copia" })];
  const r = applyGrouping(rows, mapping({
    documents: [doc("D1", [part("p1")])],
    duplicates: [{ parts: [part("p1copia")], ofDocument: "D1", reasonEs: "Duplicado de «D1»" }],
  }), newId);
  assert.equal(r.applied, true);
  assert.equal(r.excluded, 1);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].include, true);
  assert.equal(r.rows[1].include, false);
  assert.equal(r.rows[1].unitPrice, 0);
  assert.equal(r.rows[1].autoPriced, false);
  assert.match(r.rows[1].groupNote || "", /Duplicado de «D1»/);
});

test("lo que la lectura no reconoce se queda como estaba", () => {
  const manual: Row = { localId: "m", fileName: "Concepto", status: "manual", include: true, unitPrice: 25 };
  const failed = row({ sourceAnalysisId: "x", status: "error", unitPrice: 0 });
  const unknown = row({ sourceAnalysisId: "otro", words: 77, unitPrice: 33 });
  const rows = [row({ sourceAnalysisId: "a" }), manual, row({ sourceAnalysisId: "b" }), failed, unknown];
  const r = applyGrouping(rows, mapping({ documents: [doc("D1", [part("a"), part("b")])] }), newId);
  assert.equal(r.applied, true);
  assert.equal(r.rows.length, 4);
  assert.equal(r.rows[1], manual);
  assert.equal(r.rows[2], failed);
  assert.equal(r.rows[3], unknown);
});

test("una fila que la lectura cubre a medias no se agrupa (ni página cobrada dos veces ni perdida)", () => {
  const rows = [row({ sourceAnalysisId: "pdf", pageStart: 1, pageEnd: 3, pages: 3 }), row({ sourceAnalysisId: "jpg" })];
  const r = applyGrouping(rows, mapping({ documents: [doc("D1", [part("pdf", 1, 2), part("jpg")])] }), newId);
  assert.equal(r.applied, false);
  assert.deepEqual(r.rows, rows);
});

test("un PDF partido en dos por la lectura: cada documento conserva pageStart/pageEnd", () => {
  const rows = [row({ sourceAnalysisId: "pdf", pageStart: 1, pageEnd: 4, pages: 4, words: 400 })];
  const r = applyGrouping(rows, mapping({ documents: [doc("D1", [part("pdf", 1, 2)], null, 150), doc("D2", [part("pdf", 3, 4)], null, 250)] }), newId);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows.map((x) => [x.pageStart, x.pageEnd, x.pages, x.words]), [[1, 2, 2, 150], [3, 4, 2, 250]]);
});

test("buildGroupingMapping: archivo N.p de la lectura → páginas de cada DocumentAnalysis, copias exactas incluidas", () => {
  const d = (id: string, parts: { fileIndex: number; page: number }[], apostille: ReadDocumentRaw["apostille"] = null) =>
    ({ id, type: "birth_certificate", category: "civil_registry", typeLabelEs: "Acta", holder: null, issuingCountry: null, sourceLang: "fr", parts, annexes: [], apostille, declaredPages: null, missingPages: [], legibility: "good", estimatedWords: 120, hasTables: false, hasHandwriting: false, isBilingualDuplicate: false, confidence: 0.9, groupingReason: "" }) as ReadDocumentRaw;
  const reading: ModelReading = {
    documents: [d("D1", [{ fileIndex: 1, page: 1 }, { fileIndex: 1, page: 2 }], { parts: [{ fileIndex: 2, page: 1 }], onDocumentPage: false, number: null, matchedBy: "weak" })],
    notToTranslate: [], duplicates: [], instructions: null, targetLang: "es", targetLangBasis: "unknown", deadline: null, clientLang: null,
    questions: [{ kind: "apostille_owner", aboutParts: [], aboutDocumentId: "D1", textEs: "¿La apostilla es de esta acta?" }],
  };
  const files = [
    { position: 1, url: "u-acta", sha256: "s1", pageCount: 2, state: "ok", name: "acta.pdf" },
    { position: 2, url: "u-apo", sha256: "s2", pageCount: 1, state: "ok", name: "apo.jpg" },
    { position: null, url: "u-copia", sha256: "s1", pageCount: null, state: "duplicate", name: "acta (1).pdf" },
  ];
  const analyses = [
    { id: "A", fileUrl: "u-acta", fileName: "acta.pdf", pageCount: 2 },
    { id: "B", fileUrl: "u-apo", fileName: "apo.jpg", pageCount: 1 },
    { id: "C", fileUrl: "u-copia", fileName: "acta (1).pdf", pageCount: 2 },
  ];
  const m = buildGroupingMapping(reading, files, analyses, new Map([["D1", { labelEs: "Acta de nacimiento", words: 200 }]]));
  assert.deepEqual(m.documents[0].parts, [{ analysisId: "A", pageStart: 1, pageEnd: 2 }]);
  assert.deepEqual(m.documents[0].apostille, { parts: [{ analysisId: "B", pageStart: 1, pageEnd: 1 }], onDocumentPage: false });
  assert.equal(m.documents[0].words, 200);
  assert.deepEqual(m.duplicates, [{ parts: [{ analysisId: "C", pageStart: 1, pageEnd: 2 }], ofDocument: "D1", reasonEs: "Copia exacta de «acta.pdf»" }]);
  assert.deepEqual(m.questions, [{ textEs: "¿La apostilla es de esta acta?", aboutDocument: "Acta de nacimiento" }]);
});
