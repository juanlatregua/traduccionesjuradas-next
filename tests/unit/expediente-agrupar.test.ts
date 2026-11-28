import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { applyGrouping, buildGroupingMapping, expedienteAgruparOn, MERGED_PRICE_NOTE, needsMerge, undoGrouping, type GroupableRow, type GroupedDocument, type GroupingMapping } from "../../lib/expediente-agrupar.ts";
import { createHash } from "node:crypto";
import { MAX_MERGE_BYTES, mergedAnalysisJson, mergeIntoPdf, mergeTooLarge } from "../../lib/expediente-unir.ts";
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
const doc = (key: string, parts: ReturnType<typeof part>[], apostille: GroupedDocument["apostille"] = null, words = 300): GroupedDocument => {
  const d: GroupedDocument = { key, labelEs: key, type: "birth_certificate", words, parts, apostille };
  return needsMerge(d) ? { ...d, merged: { analysisId: `m-${key}`, url: `https://blob/m-${key}`, fileName: `${key}.pdf`, pageCount: parts.length + (apostille?.parts.length ?? 0) } } : d;
};
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
  assert.equal(d1.words, 300, "PDF unido: palabras de la lectura, las que guarda su análisis");
  assert.equal(d1.unitPrice, 0, "el precio lo pone el motor del constructor, no la agrupación");
  assert.equal(d1.autoPriced, true);
  assert.equal(d1.blobUrl, "https://blob/m-D1", "la línea apunta al PDF unido");
  assert.equal(d1.sourceAnalysisId, "m-D1");
  assert.deepEqual([d1.pageStart, d1.pageEnd], [1, 2]);
  assert.equal(d1.priceNote, MERGED_PRICE_NOTE, "sin precio aún, marcada a mano hasta que el motor la precie");
  assert.equal(d2, rows[2], "un documento de un solo archivo se queda tal cual");
  assert.equal(d3.pages, 2);
  assert.equal(r.rows.filter((x) => x.include).length, 3);
});

test("registro civil + apostilla en archivo aparte: una línea apostillada y ninguna a 0 €", () => {
  const rows = [
    row({ sourceAnalysisId: "rc", fileName: "registro.pdf", documentType: "birth_certificate", sourceLang: "fr", words: 180 }),
    row({ sourceAnalysisId: "ap", fileName: "apostilla.pdf", documentType: "apostille", sourceLang: "fr", words: 60, unitPrice: 0, priceNote: "Apostilla suelta" }),
  ];
  const r = applyGrouping(rows, mapping({ documents: [doc("D1", [part("rc")], { parts: [part("ap")], onDocumentPage: false }, 240)] }), newId);
  assert.equal(r.applied, true);
  assert.equal(r.rows.length, 1);
  const [line] = r.rows;
  assert.equal(line.documentType, "birth_certificate");
  assert.equal(line.hasApostille, true);
  assert.equal(line.apostilleSeparatePage, true);
  assert.equal(line.pages, 2);
  assert.equal(line.words, 240);
  assert.equal(line.blobUrl, "https://blob/m-D1");
  assert.deepEqual([line.pageStart, line.pageEnd], [1, 2]);
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

test("sin PDF unido (formato que no se puede unir): ese documento se queda por archivo con aviso; el resto se agrupa", () => {
  const rows = ["h1", "h2", "a", "b"].map((id) => row({ sourceAnalysisId: id }));
  const heic: GroupedDocument = { key: "D1", labelEs: "Pasaporte", type: "passport", words: 50, parts: [part("h1"), part("h2")], apostille: null, mergeError: "«h1.heic» no es PDF, JPG ni PNG" };
  const r = applyGrouping(rows, mapping({ documents: [heic, doc("D2", [part("a"), part("b")])] }), newId);
  assert.equal(r.applied, true);
  assert.deepEqual(r.rows.slice(0, 2), rows.slice(0, 2));
  assert.equal(r.rows.length, 3);
  assert.match(r.warnings[0], /Pasaporte.*no se pudieron unir/);
});

test("cifra del jurado o precio a mano: esa fila nunca se agrupa y conserva su precio", () => {
  const jurado = row({ sourceAnalysisId: "j1", autoPriced: false, unitPrice: 55, clientPrice: 70 });
  const prior = row({ sourceAnalysisId: "p1", priorFrom: "2026-00100", unitPrice: 30 });
  const rows = [jurado, row({ sourceAnalysisId: "j2" }), prior, row({ sourceAnalysisId: "p2" })];
  const r = applyGrouping(rows, mapping({ documents: [doc("D1", [part("j1"), part("j2")]), doc("D2", [part("p1"), part("p2")])] }), newId);
  assert.equal(r.applied, false);
  assert.deepEqual(r.rows, rows);
  assert.equal(r.warnings.length, 2);
  const dup = applyGrouping([row({ sourceAnalysisId: "x" }), jurado], mapping({ documents: [doc("D1", [part("x")])], duplicates: [{ parts: [part("j1")], ofDocument: "D1", reasonEs: "Duplicado" }] }), newId);
  assert.equal(dup.rows.find((x) => x.localId === jurado.localId)?.include, true, "un duplicado con cifra no sale del presupuesto en silencio");
});

test("deshacer: vuelve la lista por archivo, conserva las filas añadidas y cuenta lo que se pierde", () => {
  const before = [row({ sourceAnalysisId: "a" }), row({ sourceAnalysisId: "b" })];
  const after = applyGrouping(before, mapping({ documents: [doc("D1", [part("a"), part("b")])] }), newId).rows;
  const sig = (r: Row) => JSON.stringify({ ...r, unitPrice: r.autoPriced === false ? r.unitPrice : 0, priceNote: undefined });
  const added = row({ sourceAnalysisId: "c", localId: "nueva" });
  const repriced = [{ ...after[0], unitPrice: 35, priceNote: undefined }, added];
  const u1 = undoGrouping(before, after, repriced, sig);
  assert.deepEqual(u1.rows.map((r) => r.localId), [before[0].localId, before[1].localId, "nueva"]);
  assert.equal(u1.lost, 0, "el precio que pone el motor no cuenta como edición");
  const edited = [{ ...after[0], autoPriced: false, unitPrice: 80 }];
  assert.equal(undoGrouping(before, after, edited, sig).lost, 1);
  assert.equal(undoGrouping(before, after, [], sig).lost, 1);
});

test("unir en un PDF: rango de un PDF + JPG/PNG en orden; HEIC, PDF dañado o página que no existe fallan", async () => {
  const src = await PDFDocument.create();
  src.addPage([200, 200]);
  src.addPage([300, 300]);
  src.addPage([400, 400]);
  const pdf = await src.save();
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const ok = await mergeIntoPdf([{ bytes: pdf, pageStart: 2, pageEnd: 3, name: "acta.pdf" }, { bytes: png, pageStart: 1, pageEnd: 1, name: "apostilla.png" }]);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    const out = await PDFDocument.load(ok.bytes);
    assert.equal(out.getPageCount(), 3);
    assert.equal(out.getPage(0).getWidth(), 300);
  }
  const heic = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  assert.equal((await mergeIntoPdf([{ bytes: heic, pageStart: 1, pageEnd: 1, name: "foto.heic" }])).ok, false);
  assert.equal((await mergeIntoPdf([{ bytes: pdf, pageStart: 3, pageEnd: 4, name: "acta.pdf" }])).ok, false);
  assert.equal((await mergeIntoPdf([{ bytes: Uint8Array.from(Buffer.from("%PDF-roto")), pageStart: 1, pageEnd: 1, name: "roto.pdf" }])).ok, false);
});

test("needsMerge: varios archivos o páginas salteadas del mismo PDF", () => {
  assert.equal(needsMerge({ parts: [part("a", 1, 2)], apostille: { parts: [part("a", 3)], onDocumentPage: false } }), false);
  assert.equal(needsMerge({ parts: [part("a", 1)], apostille: { parts: [part("a", 3)], onDocumentPage: false } }), true);
  assert.equal(needsMerge({ parts: [part("a")], apostille: { parts: [part("b")], onDocumentPage: false } }), true);
});

test("tope de 60 MB por documento: se pasa → no se une, queda por archivo con aviso", async () => {
  assert.equal(mergeTooLarge([30 * 1024 * 1024, 30 * 1024 * 1024]), null);
  assert.match(mergeTooLarge([40 * 1024 * 1024, 25 * 1024 * 1024]) || "", /65 MB.*60 MB/);
  const big = new Uint8Array(MAX_MERGE_BYTES + 1);
  big.set([0x25, 0x50, 0x44, 0x46]);
  const r = await mergeIntoPdf([{ bytes: big, pageStart: 1, pageEnd: 1, name: "enorme.pdf" }]);
  assert.equal(r.ok, false);
  const rows = [row({ sourceAnalysisId: "a" }), row({ sourceAnalysisId: "b" })];
  const tooBig: GroupedDocument = { key: "D1", labelEs: "Expediente", type: "other", words: 900, parts: [part("a"), part("b")], apostille: null, mergeError: mergeTooLarge([70 * 1024 * 1024])! };
  const g = applyGrouping(rows, mapping({ documents: [tooBig] }), newId);
  assert.equal(g.applied, false);
  assert.deepEqual(g.rows, rows);
  assert.match(g.warnings[0], /Expediente.*70 MB/);
});

test("análisis del PDF unido: palabras de la lectura (las de la línea) y páginas del unido", () => {
  const host = { builderRun: { mode: "vision" }, document_type: { specific_type: "birth_certificate" }, document_metrics: { pages: 1, estimated_words: 120 }, requirements: { has_apostille: false } };
  const d = doc("D1", [part("rc")], { parts: [part("ap")], onDocumentPage: false }, 240);
  const json = mergedAnalysisJson(d, host, 2) as any;
  assert.equal(json.document_metrics.estimated_words, 240);
  assert.equal(json.document_metrics.pages, 2);
  assert.equal(json.requirements.has_apostille, true);
  assert.equal(json.requirements.apostille_separate_page, true);
  assert.deepEqual(json.builderRun, { mode: "vision" });
  const line = applyGrouping([row({ sourceAnalysisId: "rc", words: 120 }), row({ sourceAnalysisId: "ap", words: 30 })], mapping({ documents: [d] }), newId).rows[0];
  assert.equal(line.words, json.document_metrics.estimated_words);
  const seg = { segmented: true, builderRun: { mode: "text" }, documents: [{ pageStart: 1, pageEnd: 2, analysis: { document_metrics: { pages: 2, estimated_words: 10 } } }, { pageStart: 3, pageEnd: 4, analysis: { document_metrics: { pages: 2, estimated_words: 99 } } }] };
  assert.equal((mergedAnalysisJson(doc("D2", [part("x", 3, 4), part("y")]), seg, 3) as any).document_metrics.estimated_words, 300);
  assert.equal(mergedAnalysisJson(d, { document_metrics: {} }, 2), null, "sin marca del constructor no se inventa un análisis guardado");
});

test("unir es determinista: los mismos archivos dan el mismo sha256 (lo ve el guarda anti-duplicados)", async () => {
  const src = await PDFDocument.create();
  src.addPage([200, 200]);
  src.addPage([300, 300]);
  const pdf = await src.save();
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const sources = [{ bytes: pdf, pageStart: 1, pageEnd: 2, name: "acta.pdf" }, { bytes: png, pageStart: 1, pageEnd: 1, name: "apostilla.png" }];
  const a = await mergeIntoPdf(sources);
  await new Promise((r) => setTimeout(r, 1100));
  const b = await mergeIntoPdf(sources.map((s) => ({ ...s, bytes: Uint8Array.from(s.bytes) })));
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    const sha = (x: Uint8Array) => createHash("sha256").update(x).digest("hex");
    assert.equal(sha(a.bytes), sha(b.bytes));
    assert.ok(!Buffer.from(a.bytes).toString("latin1").includes("/Producer"));
  }
});

test("orden de la lectura: páginas intercaladas o al revés se respetan y obligan a unir", () => {
  const d = (id: string, parts: { fileIndex: number; page: number }[], apostille: ReadDocumentRaw["apostille"] = null) =>
    ({ id, type: "other", category: "other", typeLabelEs: "Doc", holder: null, issuingCountry: null, sourceLang: "fr", parts, annexes: [], apostille, declaredPages: null, missingPages: [], legibility: "good", estimatedWords: 100, hasTables: false, hasHandwriting: false, isBilingualDuplicate: false, confidence: 0.9, groupingReason: "" }) as ReadDocumentRaw;
  const reading: ModelReading = {
    documents: [
      d("D1", [{ fileIndex: 1, page: 3 }, { fileIndex: 1, page: 2 }, { fileIndex: 1, page: 1 }]),
      d("D2", [{ fileIndex: 2, page: 1 }, { fileIndex: 3, page: 1 }, { fileIndex: 2, page: 2 }], { parts: [{ fileIndex: 3, page: 2 }], onDocumentPage: false, number: null, matchedBy: "weak" }),
    ],
    notToTranslate: [], duplicates: [], instructions: null, targetLang: "es", targetLangBasis: "unknown", deadline: null, clientLang: null, questions: [],
  };
  const files = [1, 2, 3].map((position) => ({ position, url: `u${position}`, sha256: `s${position}`, pageCount: 3, state: "ok", name: `f${position}.pdf` }));
  const analyses = [1, 2, 3].map((i) => ({ id: `A${i}`, fileUrl: `u${i}`, fileName: `f${i}.pdf`, pageCount: 3 }));
  const m = buildGroupingMapping(reading, files, analyses, new Map());
  assert.deepEqual(m.documents[0].parts, [part("A1", 3), part("A1", 2), part("A1", 1)]);
  assert.equal(needsMerge(m.documents[0]), true, "al revés: hay que unir para que el PDF salga en el orden de la lectura");
  assert.deepEqual(m.documents[1].parts, [part("A2", 1), part("A3", 1), part("A2", 2)]);
  assert.deepEqual(m.documents[1].apostille?.parts, [part("A3", 2)]);
  const ascending = buildGroupingMapping({ ...reading, documents: [d("D1", [{ fileIndex: 1, page: 1 }, { fileIndex: 1, page: 2 }, { fileIndex: 1, page: 3 }])] }, files, analyses, new Map());
  assert.deepEqual(ascending.documents[0].parts, [part("A1", 1, 3)]);
  assert.equal(needsMerge(ascending.documents[0]), false);
});
