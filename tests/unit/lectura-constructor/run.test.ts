import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { startReading, STALE_RUNNING_MS, type StartDeps, type StartInput } from "../../../lib/lectura-constructor/run.ts";
import type { Reading } from "../../../lib/lectura/index.ts";
import { ap, doc, reading as modelReading } from "../lectura/fixtures.ts";
import { memoryStore, newId } from "./fakes.ts";

const bytes = new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3]);
const sha = createHash("sha256").update(bytes).digest("hex");
const refs = [{ name: "acta.pdf", url: "https://x.public.blob.vercel-storage.com/acta.pdf", mimeType: "application/pdf" }];
const input: StartInput = { source: { casoId: "c1", sessionKey: null, quoteId: null }, targetLang: "es", sourceLang: null, notes: null, reread: false, by: "juan@x" };

const meter = { attempts: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, usages: [], cost: null, ms: 5, servedBy: ["m"] };
const batch = { files: [{ index: 1, name: "acta.pdf", sha256: sha, pageCount: 2 }], duplicateFiles: [], skipped: [{ name: "roto.heic", reasonEs: "no se abre" }], pages: [], requestBytes: 8 };
function okReading(): Reading {
  const d = doc("D1", [[1, 1]], { apostille: ap([[1, 2]], { number: "55" }) });
  return {
    status: "ok", batch, reading: modelReading([d]), documents: [{ ...d, pageCount: 1, words: 180, wordsBasis: "exact" }],
    assessment: { clean: false, reasons: [{ code: "questions", detail: "1 pregunta" }, { code: "legibility", detail: "legibilidad medium", documentId: "D1" }] }, ...meter,
  } as never;
}
const busy = (attempt: number): Reading => ({ status: "busy", retryable: true, attempt, maxRetries: 2, reasonEs: "ocupado" });

function setup(script: ((attempt: number) => Reading)[], clock = () => new Date()) {
  const mem = memoryStore(clock);
  const seen: number[] = [];
  let i = 0;
  const deps: StartDeps = {
    store: mem.store,
    listFiles: async () => refs,
    download: async () => bytes,
    read: async (_files, _ctx, { attempt }) => {
      seen.push(attempt);
      return script[Math.min(i++, script.length - 1)](attempt);
    },
    now: clock,
    newId,
  };
  return { mem, deps, seen };
}

test("busy attempt is counted on the server per fingerprint and fed back, never taken from the request", async () => {
  const { mem, deps, seen } = setup([(a) => busy(a + 1), (a) => busy(a + 1), () => okReading()]);
  const r1 = await startReading(deps, input);
  assert.equal(r1.kind, "busy");
  const r2 = await startReading(deps, { ...input, ["attempt" as never]: 99 } as StartInput);
  assert.equal(r2.kind, "busy");
  const r3 = await startReading(deps, input);
  assert.equal(r3.kind, "done");
  assert.deepEqual(seen, [0, 1, 2]);
  assert.equal(mem.rows.size, 1, "the same lote is reused while busy");
  const only = [...mem.rows.values()][0];
  assert.equal(only.lote.busyAttempts, 2);
  assert.equal(only.lote.activeKey, null);
  assert.equal(only.lote.status, "ok");
});

test("ok reading persists documents with pages, words, apostille number, reasons and per-file state", async () => {
  const { mem, deps } = setup([() => okReading()]);
  const r = await startReading(deps, input);
  assert.equal(r.kind, "done");
  const e = [...mem.rows.values()][0];
  assert.equal(e.documents.length, 1);
  const d = e.documents[0];
  assert.equal(d.pageCount, 1);
  assert.equal(d.words, 180);
  assert.equal(d.apostille?.number, "55");
  assert.deepEqual(d.reasons.map((x) => x.code), ["legibility"]);
  assert.deepEqual(e.files.map((f) => [f.state, f.url]), [["ok", refs[0].url], ["skipped", null]]);
  assert.equal(e.lote.targetLang, "es");
});

test("an already read lote with the same files is reused without calling the model; reread reads again", async () => {
  const { mem, deps, seen } = setup([() => okReading()]);
  await startReading(deps, input);
  const again = await startReading(deps, input);
  assert.deepEqual(again.kind === "done" && again.reused, true);
  assert.equal(seen.length, 1);
  await startReading(deps, { ...input, reread: true });
  assert.equal(seen.length, 2);
  assert.equal(mem.rows.size, 2);
});

test("a running lote blocks a second start until it goes stale", async () => {
  let now = new Date("2026-11-19T10:00:00Z");
  const clock = () => now;
  const { mem, deps } = setup([() => okReading()], clock);
  const fp = (await import("../../../lib/lectura-constructor/run.ts")).fingerprintOf(refs, "es", null);
  await mem.store.createRunning({ casoId: "c1", sessionKey: null, quoteId: null, fingerprint: fp, targetLang: "es", promptVersion: "x", createdBy: "otro" });
  assert.equal((await startReading(deps, input)).kind, "in_progress");
  now = new Date(now.getTime() + STALE_RUNNING_MS + 1000);
  assert.equal((await startReading(deps, input)).kind, "done");
});

test("download or reader failure ends the lote as error and frees the fingerprint", async () => {
  const { mem, deps } = setup([() => okReading()]);
  const failing = { ...deps, download: async () => { throw new Error("HTTP 404"); } };
  const r = await startReading(failing, input);
  assert.deepEqual(r.kind === "done" && r.status, "error");
  const e = [...mem.rows.values()][0];
  assert.equal(e.lote.activeKey, null);
  assert.match(e.lote.detailEs ?? "", /HTTP 404/);
  const throwing = { ...deps, read: async () => { throw new Error("boom"); } };
  const r2 = await startReading(throwing, { ...input, reread: true });
  assert.deepEqual(r2.kind === "done" && r2.status, "error");
});

test("no files → nothing is created", async () => {
  const { mem, deps } = setup([() => okReading()]);
  assert.equal((await startReading({ ...deps, listFiles: async () => [] }, input)).kind, "no_files");
  assert.equal(mem.rows.size, 0);
});
