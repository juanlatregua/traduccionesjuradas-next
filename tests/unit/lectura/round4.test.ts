import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDeflate } from "node:zlib";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { HeavyWorker, WorkerOutOfMemory, WorkerTaskError, workerSource, HEAVY_SLOTS } from "../../../lib/lectura/heavy.ts";
import { prepareBatch, heifPixels, DEFAULT_LIMITS } from "../../../lib/lectura/prepare.ts";
import { assembleDocumentPdfs } from "../../../lib/lectura/assemble.ts";
import { assessReading } from "../../../lib/lectura/assess.ts";
import { cleanTypeLabel, documentLabel } from "../../../lib/lectura/label.ts";
import { ap, doc, lorem, makePdf, reading } from "./fixtures.ts";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

/** ~1 MB PDF whose object stream inflates to `mb` MB: pdf-lib holds it in a Uint8Array, outside the V8 cap. */
async function objStmBomb(mb: number): Promise<Uint8Array> {
  const z = createDeflate({ level: 9 });
  const parts: Buffer[] = [];
  z.on("data", (c: Buffer) => parts.push(c));
  const done = new Promise((r) => z.on("end", r));
  z.write(Buffer.from("5 0 "));
  const block = Buffer.alloc(1024 * 1024, 0x20);
  for (let i = 0; i < mb; i++) if (!z.write(block)) await new Promise((r) => z.once("drain", r));
  z.end();
  await done;
  const data = Buffer.concat(parts);
  const head =
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>\nendobj\n" +
    `4 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`;
  return new Uint8Array(Buffer.concat([Buffer.from(head), data, Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 6 >>\n%%EOF\n")]));
}

test("PDF bomb (1 MB → 2 GB object stream): the RSS watch kills the worker, the file is skipped and memory stays bounded", async () => {
  const bytes = await objStmBomb(2048);
  assert.ok(bytes.length < 3 * 1024 * 1024, `${bytes.length}`);
  const base = process.memoryUsage.rss();
  let peak = base;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage.rss()); }, 5);
  const t0 = Date.now();
  try {
    const r = await prepareBatch([{ name: "bomba.pdf", bytes }], { ...DEFAULT_LIMITS, workerMemoryMb: 128, workerRssMb: 256 });
    assert.equal(r.status, "empty");
    if (r.status === "empty") assert.match(r.skipped[0].reasonEs, /sin memoria/);
  } finally {
    clearInterval(timer);
  }
  const grown = (peak - base) / 1024 / 1024;
  assert.ok(grown < 700, `pico de ${grown.toFixed(0)} MB`);
  assert.ok(Date.now() - t0 < 20_000, `${Date.now() - t0} ms`);
});

test("worker: memory outside V8 is cut by the RSS watch; the production worker has no test tasks", async () => {
  const w = new HeavyWorker({ memoryMb: 64, rssMb: 128, timeoutMs: 10_000 }, workerSource(`
    buffers: async () => { const keep = []; for (let i = 0; i < 4000; i++) keep.push(new Uint8Array(1024 * 1024).fill(1)); return { n: keep.length }; },
  `));
  const prod = new HeavyWorker();
  try {
    await assert.rejects(w.run("buffers", {}), WorkerOutOfMemory);
    await assert.rejects(prod.run("spin", { ms: 1 }), WorkerTaskError);
    await assert.rejects(prod.run("allocate", { mb: 1 }), WorkerTaskError);
  } finally {
    await w.close();
    await prod.close();
  }
});

test(`worker semaphore: at most ${HEAVY_SLOTS} heavy tasks run at once in the process`, async () => {
  const src = workerSource(`spin: async ({ ms }) => { const end = Date.now() + ms; while (Date.now() < end) {} return { done: true }; },`);
  const workers = Array.from({ length: HEAVY_SLOTS + 1 }, () => new HeavyWorker(undefined, src));
  try {
    await Promise.all(workers.map((w) => w.run("spin", { ms: 1 })));
    const t0 = Date.now();
    await Promise.all(workers.map((w) => w.run("spin", { ms: 300 })));
    assert.ok(Date.now() - t0 >= 590, `${Date.now() - t0} ms`);
  } finally {
    await Promise.all(workers.map((w) => w.close()));
  }
});

const patchIspe = (bytes: Uint8Array, w: number, h: number) => {
  const out = new Uint8Array(bytes);
  const v = new DataView(out.buffer);
  for (let i = 4; i + 16 <= out.length; i++) {
    if (String.fromCharCode(...out.subarray(i, i + 4)) === "ispe") {
      v.setUint32(i + 8, w);
      v.setUint32(i + 12, h);
    }
  }
  return out;
};

test("HEIC/AVIF: a lying ispe does not hide the coded size (HEVC SPS, AV1 sequence header)", async () => {
  const heic = fixture("sintetica-64x48.heic");
  assert.ok(heifPixels(patchIspe(heic, 1, 1)) >= 64 * 48);
  const avif = new Uint8Array(await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#345" } }).avif().toBuffer());
  const liar = patchIspe(avif, 10, 10);
  assert.equal(heifPixels(liar), 3000 * 2000);
  const r = await prepareBatch([{ name: "mentira.avif", bytes: liar }], { ...DEFAULT_LIMITS, maxImagePixels: 1_000_000 });
  assert.equal(r.status, "empty");
  if (r.status === "empty") assert.match(r.skipped[0].reasonEs, /demasiado grande/);
});

test("PDF whose page count differs between pdf-lib and pdf.js is skipped", async () => {
  const d = await PDFDocument.load(await makePdf([lorem(80)]));
  d.catalog.Pages().set(PDFName.of("Count"), PDFNumber.of(3));
  const bytes = await d.save({ useObjectStreams: false });
  const r = await prepareBatch([{ name: "raro.pdf", bytes }]);
  assert.equal(r.status, "empty");
  if (r.status === "empty") assert.match(r.skipped[0].reasonEs, /recuento de páginas dudoso/);
});

test("assembly: the whole batch in one worker task; a bad document fails alone", async () => {
  const pdf = await makePdf([lorem(50), lorem(60), lorem(70)]);
  const r = await prepareBatch([{ name: "lote.pdf", bytes: pdf }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const out = await assembleDocumentPdfs(r.batch, [doc("D1", [[1, 1]]), doc("D2", [[1, 9]]), doc("D3", [[1, 2], [1, 3]], { typeLabelEs: "Acta" })]);
  assert.deepEqual(out.map((o) => o.ok), [true, false, true]);
  if (out[2].ok) {
    assert.equal(out[2].fileName, "03_Acta.pdf");
    assert.equal((await PDFDocument.load(out[2].bytes)).getPageCount(), 2);
  }
});

const exact = (d: ReturnType<typeof doc>, words: number) => ({ ...d, words, wordsBasis: "exact" as const });
const codes = (docs: any[]) => assessReading({ skipped: [] }, reading(docs, { targetLangBasis: "stated_by_client" })).reasons.map((r) => r.code);

test("Juan's rule and the stricter clean: per-word, > 2 pages, words off the estimate, bilingual, split file, out of order", () => {
  assert.deepEqual(codes([exact(doc("D1", [[1, 1]]), 210)]), []);
  assert.ok(codes([exact(doc("D1", [[1, 1], [1, 2], [1, 3]], { type: "degree", category: "academic", estimatedWords: 600 }), 600)]).includes("long_document"));
  assert.ok(codes([exact(doc("D1", [[1, 1]], { type: "contract", category: "legal", declaredPages: 1, estimatedWords: 1200 }), 1200)]).includes("per_word_price"));
  const off = codes([exact(doc("D1", [[1, 1]], { estimatedWords: 200 }), 400)]);
  assert.ok(off.includes("words_mismatch"));
  assert.ok(codes([exact(doc("D1", [[1, 1]], { isBilingualDuplicate: true }), 200)]).includes("bilingual_duplicate"));
  assert.ok(codes([exact(doc("D1", [[1, 1]]), 200), exact(doc("D2", [[1, 2]], { type: "marriage_certificate" }), 200)]).includes("file_split"));
  assert.ok(codes([exact(doc("D1", [[1, 2], [1, 1]]), 200)]).includes("pages_out_of_order"));
  assert.ok(codes([exact(doc("D1", [[2, 1], [1, 1]]), 200)]).includes("pages_out_of_order"));
});

test("labels: the type never carries the apostille or numbers; the number only with an apostille sheet", () => {
  assert.equal(cleanTypeLabel("Certificado de nacimiento con apostilla"), "Certificado de nacimiento");
  assert.equal(cleanTypeLabel("Acta de matrimonio + Apostilla de La Haya"), "Acta de matrimonio");
  assert.equal(cleanTypeLabel("Certificado n.º 12345/2024"), "Certificado");
  assert.equal(documentLabel({ typeLabelEs: "Apostilla 778", holder: null, apostille: null }), "Documento");
  assert.equal(documentLabel({ typeLabelEs: "Título", holder: null, apostille: ap([], { number: "999" }) }), "Título — apostilla");
  assert.equal(documentLabel({ typeLabelEs: "Título", holder: null, apostille: ap([[2, 1]], { number: "999" }) }), "Título — apostilla n.º 999");
});
