import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { prepareBatch } from "../../../lib/lectura/prepare.ts";
import { assembleDocumentPdfs, documentFileName } from "../../../lib/lectura/assemble.ts";
import { documentLabel } from "../../../lib/lectura/label.ts";
import { priceHint } from "../../../lib/lectura/price-hint.ts";
import { assessReading } from "../../../lib/lectura/assess.ts";
import { ap, doc, makeImage, reading } from "./fixtures.ts";

async function pageSizes(bytes: Uint8Array) {
  const d = await PDFDocument.load(bytes);
  return d.getPages().map((p) => Math.round(p.getWidth()));
}

test("pages in reading order across files, apostille at the end, images as pages", async () => {
  const src = await PDFDocument.create();
  for (const w of [301, 302, 303]) src.addPage([w, 500]).drawText(`p${w}`, { x: 10, y: 10, size: 10 });
  const r = await prepareBatch([
    { name: "acta.pdf", bytes: await src.save() },
    { name: "apostilla.jpg", bytes: await makeImage("jpeg", 800, 600) },
    { name: "pagina2.png", bytes: await makeImage("png", 300, 400) },
  ]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const out = (await assembleDocumentPdfs(r.batch, [doc("D1", [[1, 3], [3, 1], [1, 1]], { apostille: ap([[2, 1]]) })]))[0];
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.pageCount, 4);
  assert.deepEqual(await pageSizes(out.bytes), [303, 595, 301, 842]);
});

test("documentLabel: type, holder, apostille number; the PDF name uses the same text", () => {
  const base = { typeLabelEs: "Certificado de nacimiento", holder: "Adam", apostille: ap([[2, 1]], { number: "23457765" }) };
  assert.equal(documentLabel(base), "Certificado de nacimiento Adam — apostilla n.º 23457765");
  assert.equal(documentLabel({ ...base, holder: null }), "Certificado de nacimiento — apostilla n.º 23457765");
  assert.equal(documentLabel({ ...base, apostille: ap([[2, 1]], { number: null }) }), "Certificado de nacimiento Adam — apostilla (n.º no legible)");
  assert.equal(documentLabel({ ...base, apostille: null }), "Certificado de nacimiento Adam");
  assert.equal(documentLabel({ typeLabelEs: " Título\n/ diploma​ ", holder: "A.\tB.", apostille: ap([[2, 1]], { number: " 12\u0000-3 " }) }), "Título / diploma A. B. — apostilla n.º 12 -3");
  assert.equal(documentFileName(base, 3), "03_Certificado de nacimiento Adam — apostilla n.º 23457765.pdf");
  assert.equal(documentFileName({ typeLabelEs: "Título / diploma", holder: null, apostille: null }, 12), "12_Título diploma.pdf");
});

test("priceHint: French tariff only for fr→es (codes trimmed, any case), apostille +5 €, needsReview carried", () => {
  const birth = { ...doc("D1", [[1, 1]], { apostille: ap([[2, 1]]) }), words: 200, wordsBasis: "exact" as const };
  const assessment = assessReading({ skipped: [] }, reading([birth], { targetLangBasis: "stated_by_client" }));
  const hint = priceHint({ ...birth, sourceLang: " FR " }, "ES ", assessment);
  assert.equal(hint.kind, "fr_es");
  if (hint.kind === "fr_es" && hint.price.kind === "priced") {
    assert.equal(hint.price.cents, 3500);
    assert.equal(hint.price.rule, "perDocument");
  } else assert.fail("expected a priced hint");
  assert.deepEqual(hint.needsReview, []);
  assert.equal(priceHint({ ...birth, sourceLang: "de" }, "es", assessment).kind, "none");
  assert.deepEqual(priceHint(birth, "es").needsReview.map((r) => r.code), ["not_assessed"]);
});
