import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { prepareBatch, DEFAULT_LIMITS } from "../../../lib/lectura/prepare.ts";
import { assembleDocumentPdf } from "../../../lib/lectura/assemble.ts";
import { ap, doc, makeImage, makePdf } from "./fixtures.ts";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

const zipOf = async (entries: Record<string, Uint8Array | string>) => {
  const z = new JSZip();
  for (const [n, v] of Object.entries(entries)) z.file(n, v, { compression: "DEFLATE" });
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
};

/** Overwrites the declared uncompressed size of every entry (local headers and central directory). */
function lieAboutSizes(zip: Uint8Array, size: number): Uint8Array {
  const b = new Uint8Array(zip);
  const v = new DataView(b.buffer);
  for (let i = 0; i + 4 <= b.length; i++) {
    const sig = v.getUint32(i, true);
    if (sig === 0x04034b50) v.setUint32(i + 22, size, true);
    if (sig === 0x02014b50) v.setUint32(i + 24, size, true);
  }
  return b;
}

test("ZIP bomb: anomalous compression ratio is refused before inflating, as too_large bytes", async () => {
  const bomb = await zipOf({ "ceros.pdf": new Uint8Array(40 * 1024 * 1024) });
  assert.ok(bomb.length < 200_000);
  const before = process.memoryUsage().rss;
  const r = await prepareBatch([{ name: "bomba.zip", bytes: bomb }]);
  assert.equal(r.status, "too_large");
  if (r.status === "too_large") assert.equal(r.limit, "bytes");
  assert.ok(process.memoryUsage().rss - before < 30 * 1024 * 1024);
});

test("ZIP whose header lies about the size: inflation is cut at the batch cap", async () => {
  const content = new Uint8Array(3 * 1024 * 1024).map((_, i) => (i * 7919) % 251);
  const liar = lieAboutSizes(await zipOf({ "a.pdf": content }), 1000);
  const r = await prepareBatch([{ name: "mentira.zip", bytes: liar }], { ...DEFAULT_LIMITS, maxZipExpandedBytes: 1024 * 1024 });
  assert.equal(r.status, "too_large");
  if (r.status === "too_large") assert.equal(r.limit, "bytes");
});

test("ZIP volume cap is per batch, not per ZIP; entry count is checked before reading", async () => {
  const part = new Uint8Array(700 * 1024).map((_, i) => (i * 31) % 251);
  const a = await zipOf({ "a.bin": part });
  const b = await zipOf({ "b.bin": part.map((x) => (x + 1) % 251) });
  const r = await prepareBatch([{ name: "a.zip", bytes: a }, { name: "b.zip", bytes: b }], { ...DEFAULT_LIMITS, maxZipExpandedBytes: 1024 * 1024 });
  assert.equal(r.status, "too_large");
  if (r.status === "too_large") assert.equal(r.limit, "bytes");
  const many = await zipOf({ "1.txt": "a", "2.txt": "b", "3.txt": "c", "4.txt": "d" });
  const m = await prepareBatch([{ name: "muchos.zip", bytes: many }], { ...DEFAULT_LIMITS, maxZipEntries: 3 });
  assert.equal(m.status, "too_large");
  if (m.status === "too_large") assert.deepEqual([m.limit, m.actual], ["files", 4]);
});

test("page cap applies before text extraction: a 3000-page PDF is refused quickly", async () => {
  const big = await PDFDocument.create();
  for (let i = 0; i < 3000; i++) big.addPage([200, 200]);
  const bytes = await big.save();
  const t0 = Date.now();
  const r = await prepareBatch([{ name: "enorme.pdf", bytes }]);
  assert.equal(r.status, "too_large");
  if (r.status === "too_large") assert.equal(r.limit, "pages");
  assert.ok(Date.now() - t0 < 1500, `tardó ${Date.now() - t0} ms`);
});

test("pixel cap: «imagen demasiado grande», not «dañada»; per-file time cap", async () => {
  const r = await prepareBatch([{ name: "gigante.png", bytes: await makeImage("png", 400, 400) }, { name: "ok.jpg", bytes: await makeImage("jpeg", 50, 50) }], { ...DEFAULT_LIMITS, maxImagePixels: 100_000 });
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.batch.files.length, 1);
    assert.match(r.batch.skipped[0].reasonEs, /imagen demasiado grande/);
  }
  const slow = await prepareBatch([{ name: "lenta.tif", bytes: await makeImage("tiff", 2000, 2000) }], { ...DEFAULT_LIMITS, maxFileMs: 1 });
  assert.equal(slow.status, "empty");
  if (slow.status === "empty") assert.match(slow.skipped[0].reasonEs, /tiempo de lectura agotado/);
});

// Fixtures made with Ghostscript (RC4 128, R3) from a 2-page pdf-lib PDF of generated words:
//   gs -sDEVICE=pdfwrite -sOwnerPassword=propietario [-sUserPassword=apertura] -dEncryptionR=3 -dKeyLength=128 …
test("owner-password PDF is read with its pages and text; open-password PDF is skipped with the true reason", async () => {
  const r = await prepareBatch([{ name: "banco.pdf", bytes: fixture("cifrado-propietario.pdf") }, { name: "cerrado.pdf", bytes: fixture("cifrado-apertura.pdf") }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual([r.batch.files.length, r.batch.files[0].pageCount, r.batch.files[0].encrypted, r.batch.files[0].textLayer], [1, 2, true, true]);
  assert.equal(r.batch.skipped.length, 1);
  assert.match(r.batch.skipped[0].reasonEs, /contraseña de apertura: pide una copia sin proteger/);
});

test("assembling from an encrypted PDF is a typed cannot_assemble, never blank pages", async () => {
  const r = await prepareBatch([{ name: "banco.pdf", bytes: fixture("cifrado-propietario.pdf") }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const out = await assembleDocumentPdf(r.batch, doc("D1", [[1, 1], [1, 2]]), 1);
  assert.equal(out.ok, false);
  if (!out.ok) {
    assert.equal(out.kind, "cannot_assemble");
    assert.match(out.reasonEs, /cifrado/);
  }
});

test("assembly: body, then annexes in order, then apostille; page count checked; pages keep their content", async () => {
  const src = await PDFDocument.create();
  for (const w of [301, 302, 303, 304]) src.addPage([w, 500]).drawText(`p${w}`, { x: 10, y: 10, size: 10 });
  const r = await prepareBatch([{ name: "acta.pdf", bytes: await src.save() }, { name: "apostilla.jpg", bytes: await makeImage("jpeg", 800, 600) }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const d = doc("D1", [[1, 1]], {
    annexes: [{ labelEs: "Poder", parts: [{ fileIndex: 1, page: 3 }] }, { labelEs: "Certificado", parts: [{ fileIndex: 1, page: 2 }, { fileIndex: 1, page: 4 }] }],
    apostille: ap([[2, 1]]),
  });
  const out = await assembleDocumentPdf(r.batch, d, 1);
  assert.equal(out.ok, true);
  if (!out.ok) return;
  const pages = (await PDFDocument.load(out.bytes)).getPages();
  assert.deepEqual(pages.map((p) => Math.round(p.getWidth())), [301, 303, 302, 304, 842]);
  assert.equal(out.pageCount, 5);
});

test("a page outside the batch is cannot_assemble, not an exception or a short PDF", async () => {
  const r = await prepareBatch([{ name: "a.pdf", bytes: await makePdf(["", ""]) }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const out = await assembleDocumentPdf(r.batch, doc("D1", [[1, 3]]), 1);
  assert.equal(out.ok, false);
});

test("a real HEIC (synthetic 64×48 fixture) is converted to JPEG", async () => {
  const bytes = new Uint8Array(readFileSync(new URL("./fixtures/sintetica-64x48.heic", import.meta.url)));
  const r = await prepareBatch([{ name: "foto.heic", bytes }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.batch.files[0].mediaType, "image/jpeg");
  assert.match(r.batch.files[0].conversion ?? "", /HEIC → JPEG/);
});
