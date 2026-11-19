import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDeflateRaw, deflateRawSync } from "node:zlib";
import { HeavyWorker, WorkerDied, WorkerTimeout, workerSource } from "../../../lib/lectura/heavy.ts";
import { prepareBatch, DEFAULT_LIMITS } from "../../../lib/lectura/prepare.ts";
import { readBatch } from "../../../lib/lectura/index.ts";
import { READING_MODEL } from "../../../lib/lectura/read.ts";
import { validateReading } from "../../../lib/lectura/validate.ts";
import { assessReading, pageFloorCents } from "../../../lib/lectura/assess.ts";
import { documentLabel } from "../../../lib/lectura/label.ts";
import { documentFileNames } from "../../../lib/lectura/assemble.ts";
import { toWire, type ModelReading } from "../../../lib/lectura/schema.ts";
import { ap, doc, files, lorem, makeImage, makePdf, reading } from "./fixtures.ts";

const P = (fileIndex: number, page: number) => ({ fileIndex, page });
const TEST_SOURCE = workerSource(`
  spin: async ({ ms }) => { const end = Date.now() + ms; while (Date.now() < end) {} return { done: true }; },
  allocate: async ({ mb }) => { const keep = []; for (let i = 0; i < mb; i++) keep.push(new Array(131072).fill(i)); return { n: keep.length }; },
`);
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

type Entry = { name: string; data: Uint8Array; method?: number; declaredSize?: number; flags?: number };
/** Hand-made ZIP (JSZip merges repeated names and cannot write other methods or lying sizes). */
function buildZip(entries: Entry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(6, e.flags ?? 0x800, true);
    lv.setUint16(8, e.method ?? 8, true);
    lv.setUint32(18, e.data.length, true);
    lv.setUint32(22, e.declaredSize ?? e.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(8, e.flags ?? 0x800, true);
    cv.setUint16(10, e.method ?? 8, true);
    cv.setUint32(20, e.data.length, true);
    cv.setUint32(24, e.declaredSize ?? e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    chunks.push(local, e.data);
    central.push(cd);
    offset += local.length + e.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...chunks, ...central, eocd];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/** ~190 MB that starts with %PDF-, deflated in a stream (the test itself never holds the 190 MB). */
async function pdfBomb(): Promise<Uint8Array> {
  const z = createDeflateRaw({ level: 9 });
  const parts: Buffer[] = [];
  z.on("data", (c: Buffer) => parts.push(c));
  const done = new Promise((r) => z.on("end", r));
  z.write(Buffer.from("%PDF-1.7\n"));
  const block = Buffer.alloc(1024 * 1024, 0x20);
  for (let i = 0; i < 190; i++) if (!z.write(block)) await new Promise((r) => z.once("drain", r));
  z.end();
  await done;
  return new Uint8Array(Buffer.concat(parts));
}

async function peakRss<T>(fn: () => Promise<T>): Promise<{ result: T; peakMb: number }> {
  const base = process.memoryUsage().rss;
  let peak = base;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 5);
  try {
    const result = await fn();
    peak = Math.max(peak, process.memoryUsage().rss);
    return { result, peakMb: (peak - base) / 1024 / 1024 };
  } finally {
    clearInterval(timer);
  }
}

test("worker: a long synchronous task is really cut at the deadline; running out of memory kills only the worker", async () => {
  const w = new HeavyWorker({ memoryMb: 128, rssCeilingMb: 16_384, timeoutMs: 5000 }, TEST_SOURCE);
  try {
    const t0 = Date.now();
    await assert.rejects(w.run("spin", { ms: 20_000 }, 300), WorkerTimeout);
    assert.ok(Date.now() - t0 < 1500, `tardó ${Date.now() - t0} ms`);
    await assert.rejects(w.run("allocate", { mb: 4000 }), WorkerDied);
    assert.deepEqual(await w.run("spin", { ms: 1 }), { done: true });
  } finally {
    await w.close();
  }
});

test("189 KB ZIP that inflates to ~190 MB of «%PDF-»: honest header → too_large, lying header → skipped; memory stays bounded", async () => {
  const data = await pdfBomb();
  assert.ok(data.length < 400_000, `${data.length}`);
  const honest = buildZip([{ name: "a.pdf", data, declaredSize: 190 * 1024 * 1024 + 9 }]);
  const h = await peakRss(() => prepareBatch([{ name: "bomba.zip", bytes: honest }]));
  assert.equal(h.result.status, "too_large");
  if (h.result.status === "too_large") assert.equal(h.result.limit, "bytes");
  const liar = buildZip([{ name: "a.pdf", data, declaredSize: 10_000 }]);
  const l = await peakRss(() => prepareBatch([{ name: "mentira.zip", bytes: liar }]));
  assert.equal(l.result.status, "empty");
  if (l.result.status === "empty") assert.match(l.result.skipped[0].reasonEs, /más de 32\.0 MB descomprimida/);
  assert.ok(l.peakMb < 300, `pico de ${l.peakMb.toFixed(0)} MB`);
});

test("HEIC whose header declares 12000×12000 is refused before decoding", async () => {
  const bytes = fixture("sintetica-64x48.heic");
  const big = new Uint8Array(bytes);
  const v = new DataView(big.buffer);
  let patched = 0;
  for (let i = 4; i + 16 <= big.length; i++) {
    if (String.fromCharCode(...big.subarray(i, i + 4)) === "ispe") {
      v.setUint32(i + 8, 12000);
      v.setUint32(i + 12, 12000);
      patched++;
    }
  }
  assert.ok(patched > 0);
  const t0 = Date.now();
  const r = await prepareBatch([{ name: "enorme.heic", bytes: big }]);
  assert.equal(r.status, "empty");
  if (r.status === "empty") assert.match(r.skipped[0].reasonEs, /imagen demasiado grande/);
  assert.ok(Date.now() - t0 < 1000);
});

test("ZIP: empty and Icon\\r entries do not sink the ZIP; repeated names are all kept; bzip2 and encrypted entries are skipped alone", async () => {
  const img = await makeImage("jpeg", 60, 60, "#123456");
  const img2 = await makeImage("jpeg", 60, 60, "#654321");
  const zip = buildZip([
    { name: "vacio.txt", data: new Uint8Array(0), method: 0 },
    { name: "Icon\r", data: new Uint8Array(0), method: 0 },
    { name: "foto.jpg", data: deflateRawSync(img), declaredSize: img.length },
    { name: "foto.jpg", data: deflateRawSync(img2), declaredSize: img2.length },
    { name: "raro.pdf", data: new Uint8Array(100), method: 12, declaredSize: 200 },
    { name: "cerrado.pdf", data: new Uint8Array(100), flags: 0x801, declaredSize: 100 },
  ]);
  const r = await prepareBatch([{ name: "lote.zip", bytes: zip }]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual(r.batch.files.map((f) => f.name), ["lote.zip › foto.jpg", "lote.zip › foto.jpg"]);
  assert.deepEqual(r.batch.skipped.map((s) => s.reasonEs).sort(), [
    "archivo vacío",
    "entrada del ZIP cifrada con contraseña",
    "entrada del ZIP con un método de compresión no admitido (12)",
  ]);
});

test("broken images are decoded for real and skipped: truncated JPEG, PNG with a fake header", async () => {
  const jpg = await makeImage("jpeg", 800, 800, "#808080");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Uint8Array(200).fill(7)]);
  const r = await prepareBatch([
    { name: "cortada.jpg", bytes: jpg.subarray(0, Math.floor(jpg.length / 2)) },
    { name: "falsa.png", bytes: png },
    { name: "buena.jpg", bytes: await makeImage("jpeg") },
  ]);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual(r.batch.files.map((f) => f.name), ["buena.jpg"]);
  assert.equal(r.batch.skipped.length, 2);
  for (const s of r.batch.skipped) assert.match(s.reasonEs, /dañad/);
});

test("PDF text layer works end to end: exact word count from a generated PDF", async () => {
  const pdf = await makePdf([lorem(120), lorem(90)]);
  const r1 = await prepareBatch([{ name: "digital.pdf", bytes: pdf }]);
  assert.equal(r1.status, "ok");
  if (r1.status !== "ok") return;
  assert.equal(r1.batch.files[0].textLayer, true);
  const reply = reading([doc("D1", [[1, 1], [1, 2]], { estimatedWords: 10 })]);
  const fake = async () => ({
    id: "m", type: "message", role: "assistant", model: READING_MODEL, stop_reason: "end_turn", stop_details: null, stop_sequence: null,
    content: [{ type: "text", text: JSON.stringify(toWire(reply)) }],
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: null },
  }) as never;
  const r = await readBatch([{ name: "digital.pdf", bytes: pdf }], {}, { callModel: fake });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual([r.documents[0].words, r.documents[0].wordsBasis], [210, "exact"]);
});

test("document names: unique by position, long holder cut without losing the apostille number, no lone surrogates or separators", () => {
  const same = { typeLabelEs: "Certificado de nacimiento", holder: null, apostille: null };
  const names = documentFileNames([same, same]);
  assert.deepEqual(names, ["01_Certificado de nacimiento.pdf", "02_Certificado de nacimiento.pdf"]);
  const long = documentLabel({ typeLabelEs: "Certificado de nacimiento", holder: "Nombre ".repeat(40), apostille: ap([[2, 1]], { number: "23457765" }) });
  assert.ok(Array.from(long).length <= 120);
  assert.ok(long.endsWith("— apostilla n.º 23457765"));
  const odd = documentLabel({ typeLabelEs: "Acta de boda \uD800", holder: "A\uDC00B", apostille: null });
  assert.equal(odd, "Acta de boda A B");
});

test("validation: confidence out of [0,1], empty annex label, apostille number with a line separator, form target not followed", () => {
  const e1 = validateReading(files([1]), reading([doc("D1", [[1, 1]], { confidence: 7 })]));
  assert.ok(e1.some((e) => /entre 0 y 1/.test(e)));
  const e2 = validateReading(files([2]), reading([doc("D1", [[1, 1]], { annexes: [{ labelEs: " ", parts: [P(1, 2)] }] })]));
  assert.ok(e2.some((e) => /no dice qué es/.test(e)));
  const e3 = validateReading(files([1, 1]), reading([doc("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: "12 3" }) })]));
  assert.ok(e3.some((e) => /forma de número de apostilla/.test(e)));
});

// ---- Manipulations from the review: none may come out clean.
const assess = (r: ModelReading & { documents: any[] }) => assessReading({ skipped: [] }, r);
const exact = (d: ReturnType<typeof doc>, words: number) => ({ ...d, words, wordsBasis: "exact" as const });
const clientSaid = { targetLangBasis: "stated_by_client" as const };

test("control: an honest single document with counted words is clean", () => {
  const a = assess(reading([exact(doc("D1", [[1, 1]], { apostille: ap([[2, 1]]) }), 250)], clientSaid));
  assert.deepEqual(a, { clean: true, reasons: [] });
});

test("manipulation 1: 4-page deed with 2 pages passed off as apostille (120 € → 40 €) is not clean", () => {
  const a = assess(reading([exact(doc("D1", [[1, 1], [1, 2]], { type: "power_of_attorney", category: "legal", declaredPages: 2, apostille: ap([[1, 3], [1, 4]]) }), 500)], clientSaid));
  assert.equal(a.clean, false);
  assert.ok(a.reasons.some((r) => r.code === "apostille_sheets"));
});

test("manipulation 2: 5-page degree read as 3 pages + 2 apostille sheets (150 € → 95 €) is not clean", () => {
  const a = assess(reading([exact(doc("D1", [[1, 1], [1, 2], [1, 3]], { type: "degree", category: "academic", apostille: ap([[1, 4], [1, 5]]) }), 400)], clientSaid));
  assert.equal(a.clean, false);
  assert.ok(a.reasons.some((r) => r.code === "apostille_sheets"));
});

test("manipulation 3: 3000-word contract declared as 300 words (240 € → 55 €) is not clean while words are estimated", () => {
  const a = assess(reading([doc("D1", [[1, 1], [1, 2], [1, 3]], { type: "contract", category: "legal", declaredPages: 3, estimatedWords: 300 })], clientSaid));
  assert.equal(a.clean, false);
  assert.ok(a.reasons.some((r) => r.code === "words_estimated_price"));
});

test("manipulation 4: two one-page certificates merged into one 2-page document (60 € → 35 €) is not clean", () => {
  const acrossFiles = assess(reading([exact(doc("D1", [[1, 1], [2, 1]]), 400)], clientSaid));
  assert.ok(acrossFiles.reasons.some((r) => r.code === "multi_file_document"));
  const samePdfScanned = assess(reading([doc("D1", [[1, 1], [1, 2]], { estimatedWords: 400 })], clientSaid));
  assert.ok(samePdfScanned.reasons.some((r) => r.code === "words_estimated_price"));
});

test("manipulation 5: target inferred when the client asked for English is a validation error, and the batch ends invalid", async () => {
  const r = reading([doc("D1", [[1, 1]], { sourceLang: "es" })], { targetLang: "es", targetLangBasis: "inferred_from_documents" });
  assert.ok(validateReading(files([1]), r, { declaredTargetLang: "en" }).some((e) => /declara el idioma de destino «en»/.test(e)));
  const fake = async () => ({
    id: "m", type: "message", role: "assistant", model: READING_MODEL, stop_reason: "end_turn", stop_details: null, stop_sequence: null,
    content: [{ type: "text", text: JSON.stringify(toWire(r)) }],
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: null },
  }) as never;
  const out = await readBatch([{ name: "a.jpg", bytes: await makeImage("jpeg") }], { declaredTargetLang: "en" }, { callModel: fake });
  assert.equal(out.status, "invalid");
});

test("set-aside pages and conservative signals always need a person", () => {
  const ins = assess(reading([exact(doc("D1", [[1, 1]]), 250)], { ...clientSaid, instructions: { parts: [P(1, 2)], authority: null, country: null, procedure: null, requirements: [] } }));
  assert.ok(ins.reasons.some((r) => r.code === "instructions_pages"));
  const none = assess(reading([], { ...clientSaid, instructions: { parts: [P(1, 1)], authority: null, country: null, procedure: null, requirements: [] } }));
  assert.equal(none.clean, false);
  assert.ok(none.reasons.some((r) => r.code === "nothing_to_translate"));
  const one = (d: any) => assess(reading([d], clientSaid)).reasons.map((r) => r.code);
  assert.ok(one(exact(doc("D1", [[1, 1]], { type: "contract", category: "legal" }), 300)).includes("pages_unverified"));
  assert.ok(one(exact(doc("D1", [[1, 1], [1, 2], [1, 3]], { type: "criminal_record" }), 600)).includes("price_below_floor"));
  assert.equal(pageFloorCents(1), 3000);
  assert.equal(pageFloorCents(2), 3500);
  assert.equal(pageFloorCents(3), 9000);
  const twins = assess(reading([exact(doc("D1", [[1, 1]]), 250), exact(doc("D2", [[2, 1]]), 250)], clientSaid));
  assert.ok(twins.reasons.some((r) => r.code === "same_type_repeated"));
});
