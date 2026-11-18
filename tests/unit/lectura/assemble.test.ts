import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { prepareBatch } from "../../../lib/lectura/prepare.ts";
import { assembleDocumentPdf, documentFileName } from "../../../lib/lectura/assemble.ts";
import { priceHint } from "../../../lib/lectura/price-hint.ts";
import { doc, makeImage, makePdf } from "./fixtures.ts";

async function pageSizes(bytes: Uint8Array) {
  const d = await PDFDocument.load(bytes);
  return d.getPages().map((p) => Math.round(p.getWidth()));
}

test("pages in reading order across files, apostille at the end, images as pages", async () => {
  // File 1: 3-page PDF with page widths 301/302/303 to tell them apart; file 2: a landscape photo (apostille).
  const src = await PDFDocument.create();
  for (const w of [301, 302, 303]) src.addPage([w, 500]);
  const r = await prepareBatch([
    { name: "acta.pdf", bytes: await src.save() },
    { name: "apostilla.jpg", bytes: await makeImage("jpeg", 800, 600) },
    { name: "pagina2.png", bytes: await makeImage("png", 300, 400) },
  ]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const d = doc("D1", [[1, 3], [3, 1], [1, 1]], { apostille: { parts: [{ fileIndex: 2, page: 1 }], onDocumentPage: false } });
  const out = await assembleDocumentPdf(r.batch, d);
  assert.equal(out.pageCount, 4);
  assert.deepEqual(await pageSizes(out.bytes), [303, 595, 301, 842]);
});

test("file names: NN_tipo, and the holder only when it was read", () => {
  assert.equal(documentFileName({ id: "D3", holder: null, typeLabelEs: "Certificado de nacimiento" }), "03_Certificado de nacimiento.pdf");
  assert.equal(documentFileName({ id: "D1", holder: "A. B. C.", typeLabelEs: "Título / diploma" }, 12), "12_A. B. C. - Título diploma.pdf");
});

test("a page outside the batch throws instead of producing a short PDF", async () => {
  const r = await prepareBatch([{ name: "a.pdf", bytes: await makePdf(["", ""]) }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  await assert.rejects(assembleDocumentPdf(r.batch, doc("D1", [[1, 3]])), /Página inexistente/);
});

test("priceHint: French tariff only for fr→es, apostille +5 €", () => {
  const birth = doc("D1", [[1, 1]], { apostille: { parts: [{ fileIndex: 2, page: 1 }], onDocumentPage: false } });
  const hint = priceHint(birth, "es");
  assert.equal(hint.kind, "fr_es");
  if (hint.kind === "fr_es" && hint.price.kind === "priced") {
    assert.equal(hint.price.cents, 3500);
    assert.equal(hint.price.rule, "perDocument");
  } else assert.fail("expected a priced hint");
  assert.deepEqual(priceHint({ ...birth, sourceLang: "de" }, "es"), { kind: "none", reasonEs: "sin tarifa automática" });
  assert.deepEqual(priceHint({ ...birth, sourceLang: "es" }, "fr"), { kind: "none", reasonEs: "sin tarifa automática" });
});
