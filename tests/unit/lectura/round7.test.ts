import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { HeavyBusy, HeavyWorker, WorkerOutOfMemory, workerSource } from "../../../lib/lectura/heavy.ts";
import { prepareBatch, DEFAULT_LIMITS, MAX_BUSY_RETRIES } from "../../../lib/lectura/prepare.ts";
import { countWords, isReliableTextLayer } from "../../../lib/lectura/words.ts";
import { ceilingAbove, lorem, makeImage, makePdf } from "./fixtures.ts";

const MB = 1024 * 1024;

/** The reviewer's PDF: one compressed content stream of `n` × "ab " shared by every page. */
function textBomb(n: number, pages: number): Uint8Array {
  const z = deflateSync(Buffer.from("BT /F1 12 Tf 10 700 Td (" + "ab ".repeat(n) + ") Tj ET"), { level: 9 });
  const objs: (string | null)[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${5 + i} 0 R`).join(" ")}] /Count ${pages} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[4] = null;
  for (let i = 0; i < pages; i++) objs[5 + i] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>";
  const parts = [Buffer.from("%PDF-1.4\n")];
  let off = parts[0].length;
  const xref: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    xref[i] = off;
    const b = i === 4
      ? Buffer.concat([Buffer.from(`4 0 obj\n<< /Length ${z.length} /Filter /FlateDecode >>\nstream\n`), z, Buffer.from("\nendstream\nendobj\n")])
      : Buffer.from(`${i} 0 obj\n${objs[i]}\nendobj\n`);
    parts.push(b);
    off += b.length;
  }
  let x = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) x += String(xref[i]).padStart(10, "0") + " 00000 n \n";
  parts.push(Buffer.from(x + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${off}\n%%EOF\n`));
  return new Uint8Array(Buffer.concat(parts));
}

test("text bomb (12 KB → 240 M characters): no event-loop stall, text layer refused with a reason", async () => {
  const bytes = textBomb(2_000_000, 40);
  assert.ok(bytes.length < 64 * 1024, `${bytes.length}`);
  let lag = 0;
  let last = Date.now();
  const iv = setInterval(() => {
    const now = Date.now();
    lag = Math.max(lag, now - last - 20);
    last = now;
  }, 20);
  const r = await prepareBatch([{ name: "x.pdf", bytes }]);
  clearInterval(iv);
  assert.ok(lag < 200, `event loop parado ${lag} ms`);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const f = r.batch.files[0];
  assert.deepEqual([f.textLayer, f.pageTexts, f.pageWords], [false, null, null]);
  assert.match(f.textNote ?? "", /más de 20000 caracteres/);
});

test("text kept per batch is capped: past the batch budget a PDF's text is not used", async () => {
  const pdf = await makePdf([lorem(120), lorem(120)]);
  const other = await makePdf([lorem(120, "otra"), lorem(120, "otra")]);
  const r = await prepareBatch([{ name: "a.pdf", bytes: pdf }, { name: "b.pdf", bytes: other }], { ...DEFAULT_LIMITS, maxTextChars: 3000 });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.batch.files[0].textLayer, true);
  assert.deepEqual(r.batch.files[0].pageWords, [120, 120]);
  assert.equal(r.batch.files[1].textLayer, false);
  assert.match(r.batch.files[1].textNote ?? "", /texto del lote/);
});

test("worker word rules are the same as words.ts", async () => {
  const w = new HeavyWorker(undefined, workerSource(`parity: async ({ texts, lists }) => ({ words: texts.map(countWords), reliable: lists.map(isReliableTextLayer) }),`));
  const texts = ["Acte de naissance n° 12/2024 — 1.210 € … «Dou fé»", "شهادة ميلاد 2024", "", " - • — ", lorem(57)];
  const lists = [[0, 0, 0, 0, 540], [120, 80], [9, 60], [40], []];
  try {
    const r = await w.run<{ words: number[]; reliable: boolean[] }>("parity", { texts, lists });
    assert.deepEqual(r.words, texts.map(countWords));
    assert.deepEqual(r.reliable, lists.map(isReliableTextLayer));
  } finally {
    await w.close();
  }
});

test("over the ceiling: a neighbour's memory makes the task busy (retryable), the worker's own makes it out of memory", async () => {
  const src = workerSource(`
    wait: async ({ ms }) => { await new Promise((r) => setTimeout(r, ms)); return {}; },
    buffers: async () => { const keep = []; for (let i = 0; i < 4000; i++) { keep.push(new Uint8Array(1024 * 1024).fill(1)); await new Promise((r) => setImmediate(r)); } return {}; },
  `);
  const ceiling = ceilingAbove(200);
  const w = new HeavyWorker({ memoryMb: 2048, rssCeilingMb: ceiling, timeoutMs: 20_000, settleMs: 100 }, src);
  const hold: Buffer[] = [];
  try {
    await w.run("wait", { ms: 1 });
    const pending = w.run("wait", { ms: 3000 });
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 0; i < 60; i++) hold.push(Buffer.alloc(10 * MB, 1));
    await assert.rejects(pending, (e) => e instanceof HeavyBusy && !(e instanceof WorkerOutOfMemory));
    hold.length = 0;
    await new Promise((r) => setTimeout(r, 300));
    const own = new HeavyWorker({ memoryMb: 2048, rssCeilingMb: ceilingAbove(200), timeoutMs: 20_000 }, src);
    await assert.rejects(own.run("buffers", {}), WorkerOutOfMemory);
    await own.close();
  } finally {
    hold.length = 0;
    await w.close();
  }
});

test("busy carries its attempt; after the last retry the file is skipped with a reason instead of busy again", async () => {
  const full = { ...DEFAULT_LIMITS, rssCeilingMb: 1 };
  const files = [{ name: "a.jpg", bytes: await makeImage("jpeg") }];
  const first = await prepareBatch(files, full);
  assert.equal(first.status, "busy");
  if (first.status !== "busy") return;
  assert.deepEqual([first.attempt, first.maxRetries], [1, MAX_BUSY_RETRIES]);
  const last = await prepareBatch(files, full, MAX_BUSY_RETRIES);
  assert.equal(last.status, "empty");
  if (last.status === "empty") assert.match(last.skipped[0].reasonEs, /no tuvo memoria libre para abrirlo tras 3 intentos/);
});
