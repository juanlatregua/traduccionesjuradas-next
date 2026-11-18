import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import sharp from "sharp";
import { prepareBatch, sniffType, DEFAULT_LIMITS } from "../../../lib/lectura/prepare.ts";
import { makeImage, makePdf, lorem } from "./fixtures.ts";

test("sniffType reads magic bytes, not the extension", async () => {
  assert.equal(sniffType(await makePdf(["hola"])), "pdf");
  assert.equal(sniffType(await makeImage("png")), "png");
  assert.equal(sniffType(await makeImage("jpeg")), "jpeg");
  assert.equal(sniffType(await makeImage("tiff")), "tiff");
  assert.equal(sniffType(await makeImage("webp")), "webp");
  const heic = new Uint8Array(32);
  heic.set([0, 0, 0, 0x18], 0);
  heic.set(new TextEncoder().encode("ftypheic\0\0\0\0mif1heic"), 4);
  assert.equal(sniffType(heic), "heic");
  const avif = new Uint8Array(32);
  avif.set([0, 0, 0, 0x1c], 0);
  avif.set(new TextEncoder().encode("ftypavif\0\0\0\0avifmif1miaf"), 4);
  assert.equal(sniffType(avif), "avif");
  assert.equal(sniffType(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3, 4])), "office");
  assert.equal(sniffType(new TextEncoder().encode("solo texto plano")), "unknown");
});

test("a PNG named .pdf is still an image", async () => {
  const r = await prepareBatch([{ name: "escaneo.pdf", mimeType: "application/pdf", bytes: await makeImage("png") }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.batch.files[0].kind, "image");
  assert.equal(r.batch.files[0].mediaType, "image/png");
  assert.equal(r.batch.files[0].pageCount, 1);
});

test("ZIP: opened, macOS junk ignored, nested ZIP not opened", async () => {
  const inner = new JSZip();
  inner.file("x.pdf", await makePdf(["a"]));
  const zip = new JSZip();
  zip.file("docs/acta.pdf", await makePdf([lorem(60), lorem(60)]));
  zip.file("docs/foto.jpg", await makeImage("jpeg"));
  zip.file("__MACOSX/docs/._acta.pdf", "basura");
  zip.file(".DS_Store", "basura");
  zip.file("otro.zip", await inner.generateAsync({ type: "uint8array" }));
  const r = await prepareBatch([{ name: "lote.zip", bytes: await zip.generateAsync({ type: "uint8array" }) }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual(r.batch.files.map((f) => f.name), ["lote.zip › docs/acta.pdf", "lote.zip › docs/foto.jpg"]);
  assert.equal(r.batch.skipped.length, 1);
  assert.match(r.batch.skipped[0].reasonEs, /ZIP dentro de otro ZIP/);
  assert.deepEqual(r.batch.pages, [{ fileIndex: 1, page: 1 }, { fileIndex: 1, page: 2 }, { fileIndex: 2, page: 1 }]);
});

test("exact duplicates are dropped before the AI and kept as exactDuplicateOf", async () => {
  const img = await makeImage("jpeg");
  const pdf = await makePdf(["uno"]);
  const r = await prepareBatch([
    { name: "a.jpg", bytes: img },
    { name: "b.pdf", bytes: pdf },
    { name: "a (1).jpg", bytes: img },
    { name: "b-copia.pdf", bytes: pdf },
  ]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.batch.files.length, 2);
  assert.deepEqual(
    r.batch.duplicateFiles.map((d) => [d.name, d.exactDuplicateOf]),
    [["a (1).jpg", 1], ["b-copia.pdf", 2]],
  );
});

// The text-layer reader (pdf.js 1.10 inside pdf-parse) misreads pdf-lib-generated files when the process runs
// as ESM (this test runner); real PDFs are read fine. Exact counting is covered in read-batch.test.ts via pageTexts.
test("PDF: page count; a scan without text has no text layer", async () => {
  const scan = await prepareBatch([{ name: "s.pdf", bytes: await makePdf(["", "", ""]) }]);
  assert.equal(scan.status, "ok");
  if (scan.status !== "ok") return;
  assert.equal(scan.batch.files[0].pageCount, 3);
  assert.equal(scan.batch.files[0].textLayer, false);
});

test("TIFF is converted to JPEG and big images are reduced under the limits", async () => {
  const r = await prepareBatch([
    { name: "fax.tif", bytes: await makeImage("tiff") },
    { name: "movil.png", bytes: await makeImage("png", 4000, 3000) },
  ]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const [tiff, big] = r.batch.files;
  assert.equal(tiff.mediaType, "image/jpeg");
  assert.match(tiff.conversion ?? "", /TIFF → JPEG/);
  const meta = await sharp(big.bytes).metadata();
  assert.equal(Math.max(meta.width!, meta.height!), DEFAULT_LIMITS.maxImageEdge);
  assert.ok(big.bytes.length <= DEFAULT_LIMITS.maxImageBytes);
  assert.match(big.conversion ?? "", /reducida/);
});

test("limits: too many files, pages or bytes give too_large with the reason, never a truncated batch", async () => {
  const img = (c: string) => makeImage("jpeg", 50, 50, c);
  const three = [await img("#111111"), await img("#222222"), await img("#333333")].map((bytes, i) => ({ name: `${i}.jpg`, bytes }));
  const files = await prepareBatch(three, { ...DEFAULT_LIMITS, maxFiles: 2 });
  assert.equal(files.status, "too_large");
  if (files.status === "too_large") assert.deepEqual([files.limit, files.max, files.actual], ["files", 2, 3]);

  const pages = await prepareBatch([{ name: "p.pdf", bytes: await makePdf(["a", "b", "c", "d"]) }], { ...DEFAULT_LIMITS, maxPages: 3 });
  assert.equal(pages.status, "too_large");
  if (pages.status === "too_large") {
    assert.equal(pages.limit, "pages");
    assert.match(pages.reasonEs, /4 páginas/);
  }

  const bytes = await prepareBatch(three, { ...DEFAULT_LIMITS, maxRequestBytes: 100 });
  assert.equal(bytes.status, "too_large");
  if (bytes.status === "too_large") assert.equal(bytes.limit, "bytes");
});

test("unsupported and broken files are reported, an empty batch says so", async () => {
  const r = await prepareBatch([
    { name: "carta.doc", bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0, 0]) },
    { name: "roto.pdf", bytes: new TextEncoder().encode("%PDF-1.4 esto no es un pdf") },
  ]);
  assert.equal(r.status, "empty");
  if (r.status === "empty") assert.equal(r.skipped.length, 2);
});
