import test from "node:test";
import assert from "node:assert/strict";
import { HeavyWorker, WorkerOutOfMemory, workerSource } from "../../../lib/lectura/heavy.ts";
import { heifPixels, sniffType } from "../../../lib/lectura/prepare.ts";
import { assessReading } from "../../../lib/lectura/assess.ts";
import { doc, reading } from "./fixtures.ts";

const MB = 1024 * 1024;

test("killed workers do not stack the budget: three bombs in a row keep the process under one budget", async () => {
  const src = workerSource(`hog: async ({ mb }) => { const keep = []; for (let i = 0; i < mb; i++) { const b = new Uint8Array(1024 * 1024); b.fill(1); keep.push(b); await new Promise((r) => setTimeout(r, 1)); } return {}; },`);
  const h = new HeavyWorker({ memoryMb: 2048, rssMb: 300, timeoutMs: 20_000 }, src);
  const base = process.memoryUsage.rss();
  let peak = base;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage.rss()); }, 2);
  try {
    for (let k = 0; k < 3; k++) await assert.rejects(h.run("hog", { mb: 2000 }), WorkerOutOfMemory);
  } finally {
    clearInterval(timer);
    await h.close();
  }
  const grown = (peak - base) / MB;
  assert.ok(grown < 400, `pico de ${grown.toFixed(0)} MB`);
});

/** HEIC whose iloc has zero-size fields and 65535 extents per item (the reviewer's repro). */
function ilocBomb(items: number, inMeta: boolean): Uint8Array {
  const ftyp = Buffer.from([0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0, ...Buffer.from("mif1heic")]);
  const iloc = Buffer.alloc(16 + items * 6);
  iloc.writeUInt32BE(iloc.length, 0);
  iloc.write("iloc", 4);
  iloc.writeUInt16BE(items, 14);
  for (let k = 0; k < items; k++) {
    const p = 16 + k * 6;
    iloc.writeUInt16BE(k + 1, p);
    iloc.writeUInt16BE(0xffff, p + 4);
  }
  const meta = Buffer.alloc(12);
  meta.writeUInt32BE(12 + iloc.length, 0);
  meta.write("meta", 4);
  return new Uint8Array(Buffer.concat(inMeta ? [ftyp, meta, iloc] : [ftyp, iloc]));
}

test("HEIF parsing is linear: an iloc with empty fields and 65535 extents is read in < 50 ms", () => {
  for (const [n, inMeta] of [[5000, false], [65_535, false], [5000, true], [65_535, true]] as const) {
    const b = ilocBomb(n, inMeta);
    assert.equal(sniffType(b), "heic");
    const t0 = performance.now();
    assert.equal(heifPixels(b), 0);
    const ms = performance.now() - t0;
    assert.ok(ms < 50, `${b.length} bytes: ${ms.toFixed(1)} ms`);
  }
});

const codes = (docs: any[], extra = {}) => assessReading({ skipped: [] }, reading(docs, { targetLangBasis: "stated_by_client", ...extra })).reasons.map((r) => r.code);
const exact = (d: ReturnType<typeof doc>, words: number) => ({ ...d, words, wordsBasis: "exact" as const });

test("only French → Spanish with a tariff can be clean", () => {
  assert.deepEqual(codes([exact(doc("D1", [[1, 1]]), 200)]), []);
  assert.ok(codes([exact(doc("D1", [[1, 1]], { sourceLang: "de" }), 200)]).includes("pair_without_tariff"));
  assert.ok(codes([exact(doc("D1", [[1, 1]]), 200)], { targetLang: "en" }).includes("pair_without_tariff"));
  assert.ok(codes([exact(doc("D1", [[1, 1]], { type: "contract", category: "legal", declaredPages: 1 }), 0)]).includes("no_tariff"));
});
