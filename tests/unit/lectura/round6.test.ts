import test from "node:test";
import assert from "node:assert/strict";
import { HeavyWorker, rssCeilingMb, workerSource } from "../../../lib/lectura/heavy.ts";
import { prepareBatch, sniffType, DEFAULT_LIMITS } from "../../../lib/lectura/prepare.ts";
import { assembleDocumentPdfs } from "../../../lib/lectura/assemble.ts";
import { ceilingAbove, doc, makeImage } from "./fixtures.ts";

const MB = 1024 * 1024;

function box(type: string, ...parts: Buffer[]) {
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(8 + body.length);
  h.write(type, 4);
  return Buffer.concat([h, body]);
}

/** The reviewer's AVIF: n av01 items, all pointing at one offset with len = 0, over MBs of 2-byte padding OBUs. */
function av1Bomb(n: number, padMb: number): Uint8Array {
  const ftyp = box("ftyp", Buffer.from("avif"), Buffer.alloc(4), Buffer.from("mif1avif"));
  const infes = [];
  for (let k = 1; k <= n; k++) {
    const e = Buffer.alloc(13);
    e[0] = 2;
    e.writeUInt16BE(k, 4);
    e.write("av01", 8);
    infes.push(box("infe", e));
  }
  const iinfHead = Buffer.alloc(6);
  iinfHead.writeUInt16BE(n, 4);
  const iinf = box("iinf", iinfHead, ...infes);
  const il = Buffer.alloc(8 + n * 14);
  il[4] = 0x44;
  il.writeUInt16BE(n, 6);
  const pad = Buffer.alloc(padMb * MB);
  for (let i = 0; i < pad.length; i += 2) pad[i] = 0x02;
  const off = ftyp.length + box("meta", Buffer.alloc(4), iinf, box("iloc", il)).length + 8;
  for (let k = 1, p = 8; k <= n; k++, p += 14) {
    il.writeUInt16BE(k, p);
    il.writeUInt16BE(1, p + 4);
    il.writeUInt32BE(off, p + 6);
  }
  return new Uint8Array(Buffer.concat([ftyp, box("meta", Buffer.alloc(4), iinf, box("iloc", il)), box("mdat", pad)]));
}

test("AVIF with thousands of len=0 items over padding: parsed in the worker, < 1 s, event loop alive", async () => {
  const b = av1Bomb(5000, 8);
  assert.equal(sniffType(b), "avif");
  let ticks = 0;
  const iv = setInterval(() => ticks++, 10);
  const t0 = performance.now();
  const r = await prepareBatch([{ name: "x.avif", bytes: b }]);
  const ms = performance.now() - t0;
  clearInterval(iv);
  assert.equal(r.status, "empty");
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
  assert.ok(ticks >= Math.floor(ms / 10) / 3, `${ticks} ticks en ${ms.toFixed(0)} ms`);
});

test("ceiling is absolute: memory held elsewhere in the process does not drift into the budget of a good batch", async () => {
  const src = workerSource(`alloc: async ({ mb }) => { let s = 0; for (let i = 0; i < mb; i++) { const b = new Uint8Array(1024 * 1024); b.fill(1); s += b[0]; } return { s }; }, noop: async () => ({}),`);
  const ceiling = ceilingAbove(800);
  const a = new HeavyWorker({ memoryMb: 2048, rssCeilingMb: ceiling, timeoutMs: 20_000 }, src);
  const other = new HeavyWorker({ memoryMb: 2048, rssCeilingMb: ceiling, timeoutMs: 20_000 }, src);
  const hold: Buffer[] = [];
  try {
    await a.run("noop", {});
    await a.run("alloc", { mb: 250 });
    await a.run("alloc", { mb: 100 });
    for (let i = 0; i < 32; i++) hold.push(Buffer.alloc(10 * MB, 1));
    await other.run("noop", {});
  } finally {
    hold.length = 0;
    await a.close();
    await other.close();
  }
});

test("instance full: the batch fails once as retryable busy, and assembly reports busy instead of failing documents", async () => {
  const full = { ...DEFAULT_LIMITS, rssCeilingMb: 1 };
  const t0 = Date.now();
  const r = await prepareBatch([{ name: "a.jpg", bytes: await makeImage("jpeg") }, { name: "b.jpg", bytes: await makeImage("jpeg") }], full);
  assert.equal(r.status, "busy");
  if (r.status === "busy") assert.equal(r.retryable, true);
  assert.ok(Date.now() - t0 < 8000);
  const ok = await prepareBatch([{ name: "a.jpg", bytes: await makeImage("jpeg") }]);
  assert.equal(ok.status, "ok");
  if (ok.status !== "ok") return;
  const out = await assembleDocumentPdfs(ok.batch, [doc("D1", [[1, 1]]), doc("D2", [[1, 5]])], new HeavyWorker({ memoryMb: 256, rssCeilingMb: 1, timeoutMs: 5000, settleMs: 100 }));
  assert.deepEqual(out.map((o) => (o.ok ? "ok" : o.kind)), ["busy", "cannot_assemble"]);
});

test("rssCeilingMb: from the function memory with a margin for Next, overridable", () => {
  assert.equal(rssCeilingMb({ AWS_LAMBDA_FUNCTION_MEMORY_SIZE: "2048" }), 1740);
  assert.equal(rssCeilingMb({ AWS_LAMBDA_FUNCTION_MEMORY_SIZE: "1024" }), 768);
  assert.equal(rssCeilingMb({ LECTURA_RSS_CEILING_MB: "900", AWS_LAMBDA_FUNCTION_MEMORY_SIZE: "2048" }), 900);
  assert.equal(rssCeilingMb({}), 1536);
});
