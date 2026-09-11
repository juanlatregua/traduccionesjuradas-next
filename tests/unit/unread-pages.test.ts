import test from "node:test";
import assert from "node:assert/strict";
import { absorbUnreadPages, UNREAD_PAGES_TYPE_ES } from "../../lib/ai/unread-pages.ts";

type Doc = {
  analysis: {
    document_type: { specific_type_es: string };
    document_metrics: { pages: number; estimated_words?: number };
  };
  pageStart: number;
  pageEnd: number;
  absorbedPages?: number[];
};

const doc = (type: string, pageStart: number, pageEnd: number, words = 0): Doc => ({
  analysis: {
    document_type: { specific_type_es: type },
    document_metrics: { pages: pageEnd - pageStart + 1, estimated_words: words },
  },
  pageStart,
  pageEnd,
});
const ranges = (docs: Doc[]) => docs.map((d) => [d.pageStart, d.pageEnd]);

test("Fortuny: la página de firmas sin texto se une a la carta", () => {
  const out = absorbUnreadPages([doc("Carta de Suscripción", 1, 3, 469), doc(UNREAD_PAGES_TYPE_ES, 4, 4)]);
  assert.deepEqual(ranges(out), [[1, 4]]);
  assert.equal(out[0].analysis.document_metrics.pages, 4);
  assert.equal(out[0].analysis.document_metrics.estimated_words, 469);
  assert.deepEqual(out[0].absorbedPages, [4]);
});

test("página suelta CON texto (el modelo la saltó) no se une: sus palabras no se pierden", () => {
  const out = absorbUnreadPages([doc("Sentencia", 1, 3, 735), doc(UNREAD_PAGES_TYPE_ES, 4, 4, 477)]);
  assert.deepEqual(ranges(out), [[1, 3], [4, 4]]);
  assert.equal(out[0].absorbedPages, undefined);
});

test("página 1 sin texto se une al documento que la sigue", () => {
  const out = absorbUnreadPages([doc(UNREAD_PAGES_TYPE_ES, 1, 1), doc("Certificado", 2, 3)]);
  assert.deepEqual(ranges(out), [[1, 3]]);
  assert.deepEqual(out[0].absorbedPages, [1]);
});

test("página sin texto entre dos documentos va con el anterior", () => {
  const out = absorbUnreadPages([doc("A", 1, 2), doc(UNREAD_PAGES_TYPE_ES, 3, 3), doc("B", 4, 5)]);
  assert.deepEqual(ranges(out), [[1, 3], [4, 5]]);
});

test("dos o más páginas sin texto siguen como documento aparte", () => {
  const out = absorbUnreadPages([doc("A", 1, 2), doc(UNREAD_PAGES_TYPE_ES, 3, 4)]);
  assert.deepEqual(ranges(out), [[1, 2], [3, 4]]);
  assert.equal(out[0].absorbedPages, undefined);
});

test("sin documento contiguo no se une a nada", () => {
  const out = absorbUnreadPages([doc(UNREAD_PAGES_TYPE_ES, 3, 3), doc(UNREAD_PAGES_TYPE_ES, 5, 6)]);
  assert.deepEqual(ranges(out), [[3, 3], [5, 6]]);
});

test("ordena por página aunque lleguen desordenados", () => {
  const out = absorbUnreadPages([doc("B", 3, 4), doc(UNREAD_PAGES_TYPE_ES, 2, 2), doc("A", 1, 1)]);
  assert.deepEqual(ranges(out), [[1, 2], [3, 4]]);
});
