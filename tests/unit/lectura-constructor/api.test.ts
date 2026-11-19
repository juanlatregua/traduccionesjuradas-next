import test from "node:test";
import assert from "node:assert/strict";
import { handleConfirm, handleEdit, handleGet, handleStart, type ApiDeps } from "../../../lib/lectura-constructor/api.ts";
import { startReading, type StartInput } from "../../../lib/lectura-constructor/run.ts";
import { explicitRssCeilingMb, lecturaConstructorOn } from "../../../lib/lectura-constructor/flag.ts";
import type { Reading } from "../../../lib/lectura/index.ts";
import { ap, doc, reading as modelReading } from "../lectura/fixtures.ts";
import { memoryStore, newId } from "./fakes.ts";

const req = (body?: unknown) => new Request("http://local/x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const source = { kind: "caso", casoId: "c1" };

function okReading(docs = [doc("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: "A-1" }) })]): Reading {
  return {
    status: "ok",
    batch: { files: [{ index: 1, name: "a.pdf", sha256: "s1", pageCount: 1 }, { index: 2, name: "b.jpg", sha256: "s2", pageCount: 1 }], duplicateFiles: [], skipped: [], pages: [], requestBytes: 1 },
    reading: modelReading(docs),
    documents: docs.map((d) => ({ ...d, pageCount: d.parts.length, words: 150, wordsBasis: "exact" })),
    assessment: { clean: false, reasons: [] },
    attempts: 1, usage: {}, usages: [], cost: null, ms: 1, servedBy: [],
  } as never;
}

const QUOTES: Record<string, { id: string; casoId: string | null; sourceLang: string; targetLang: string }> = {
  q1: { id: "q1", casoId: "c1", sourceLang: "fr", targetLang: "es" },
  q2: { id: "q2", casoId: "otro", sourceLang: "fr", targetLang: "es" },
  q3: { id: "q3", casoId: "c1", sourceLang: "fr", targetLang: "de" },
};
const seen = async (d: ApiDeps, id: string) => ({ expectedUpdatedAt: (await d.store.get(id))!.lote.updatedAt.toISOString() });

function deps(over: Partial<ApiDeps> = {}, reads: Reading[] = [okReading()]) {
  const mem = memoryStore();
  const starts: StartInput[] = [];
  let i = 0;
  const d: ApiDeps = {
    enabled: () => true,
    auth: async () => ({ ok: true, email: "juan@x" }),
    rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
    store: mem.store,
    start: (input) => {
      starts.push(input);
      return startReading(
        { store: mem.store, listFiles: async () => [{ name: "a.pdf", url: "https://x/a", mimeType: null }], download: async () => new Uint8Array([1]), read: async () => reads[Math.min(i++, reads.length - 1)], now: () => new Date(), newId },
        input,
      );
    },
    readyToRead: () => null,
    findQuote: async (id) => QUOTES[id] ?? null,
    newId,
    ...over,
  };
  return { d, mem, starts };
}

test("flag: off unless LECTURA_CONSTRUCTOR=on; RSS ceiling only when explicit", () => {
  assert.equal(lecturaConstructorOn({}), false);
  assert.equal(lecturaConstructorOn({ LECTURA_CONSTRUCTOR: "true" }), false);
  assert.equal(lecturaConstructorOn({ LECTURA_CONSTRUCTOR: "on" }), true);
  assert.equal(explicitRssCeilingMb({}), null);
  assert.equal(explicitRssCeilingMb({ LECTURA_RSS_CEILING_MB: "100" }), null);
  assert.equal(explicitRssCeilingMb({ LECTURA_RSS_CEILING_MB: "1700" }), 1700);
});

test("gate: flag off → 404 before anything; no staff → 403; rate limit → 429 with Retry-After; no ceiling → 503", async () => {
  let authed = false;
  const off = deps({ enabled: () => false, auth: async () => ((authed = true), { ok: true, email: "j" }) });
  assert.equal((await handleStart(req({ source }), off.d)).status, 404);
  assert.equal(authed, false);
  assert.equal((await handleGet(req(), "L1", off.d)).status, 404);
  assert.equal((await handleStart(req({ source }), deps({ auth: async () => ({ ok: false, error: "Acceso denegado." }) }).d)).status, 403);
  const limited = await handleStart(req({ source }), deps({ rateLimit: async () => ({ ok: false, retryAfterSec: 42 }) }).d);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers?.["Retry-After"], "42");
  const noCeiling = deps({ readyToRead: () => "falta LECTURA_RSS_CEILING_MB" });
  assert.equal((await handleStart(req({ source }), noCeiling.d)).status, 503);
  assert.equal(noCeiling.starts.length, 0);
});

test("start body is strict: an `attempt` from the client is rejected, never used", async () => {
  const { d, starts } = deps();
  const r = await handleStart(req({ source, attempt: 5 }), d);
  assert.equal(r.status, 400);
  assert.equal(starts.length, 0);
  assert.equal((await handleStart(req({ source: { kind: "caso", casoId: "" } }), d)).status, 400);
  assert.equal((await handleStart(req({ source, targetLang: "español" }), d)).status, 400);
});

test("busy → 503 with Retry-After and the server's count", async () => {
  const { d, mem } = deps({}, [{ status: "busy", retryable: true, attempt: 1, maxRetries: 2, reasonEs: "ocupado" }]);
  const r = await handleStart(req({ source, targetLang: "es" }), d);
  assert.equal(r.status, 503);
  assert.equal(r.headers?.["Retry-After"], "60");
  assert.equal((r.body as { attempt: number }).attempt, 1);
  assert.equal([...mem.rows.values()][0].lote.busyAttempts, 1);
});

test("full flow: read → correct → confirm → frozen; lines only from lib/dinero", async () => {
  const docs = [doc("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: "A-1" }) }), doc("D2", [[1, 2]], { typeLabelEs: "DNI" })];
  const { d } = deps({}, [okReading(docs)]);
  const started = await handleStart(req({ source, targetLang: "es" }), d);
  assert.equal(started.status, 200);
  const view = (started.body as { view: { lote: { id: string }; documents: { id: string; label: string }[]; ready: boolean } }).view;
  const id = view.lote.id;
  assert.equal(view.documents[0].label, "Certificado de nacimiento — apostilla n.º A-1");

  const bad = await handleEdit(req({ op: "exclude", id: view.documents[1].id, reason: "x" }), id, d);
  assert.equal(bad.status, 400);
  const ex = await handleEdit(req({ op: "exclude", id: view.documents[1].id, reason: "DNI para identificarse" }), id, d);
  assert.equal(ex.status, 200);
  const price = await handleEdit(req({ op: "setPrice", id: view.documents[0].id, price: "40,50", cost: null }), id, d);
  assert.equal(price.status, 200);
  const pv = (price.body as { view: { lines: { lines: { unitPriceCents: number; priceSource: string; tariff: string }[] } } }).view;
  assert.equal(pv.lines.lines[0].unitPriceCents, 4050);
  assert.equal(pv.lines.lines[0].priceSource, "manual");
  assert.equal(pv.lines.lines[0].tariff, "35,00 €");
  assert.equal((await handleEdit(req({ op: "setPrice", id: view.documents[0].id, price: "40.555", cost: null }), id, d)).status, 400);

  const c = await handleConfirm(req(await seen(d, id)), id, d);
  assert.equal(c.status, 200);
  const cv = (c.body as { view: { lote: { status: string; confirmedBy: string }; payload: { lines: { unitPrice: string }[]; vatRate: number } } }).view;
  assert.equal(cv.lote.status, "confirmed");
  assert.equal(cv.lote.confirmedBy, "juan@x");
  assert.deepEqual(cv.payload.lines.map((l) => l.unitPrice), ["40.50"]);
  assert.equal(cv.payload.vatRate, 0.21);

  assert.equal((await handleEdit(req({ op: "include", id: view.documents[1].id }), id, d)).status, 409);
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "nope" }), id, d)).status, 404);
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "q2" }), id, d)).status, 409, "otro caso");
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "q3" }), id, d)).status, 409, "otro par");
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "q1" }), id, d)).status, 200);
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "q1" }), id, d)).status, 200, "idempotente");
  const other = { ...QUOTES.q1, id: "q9" };
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "q9" }), id, { ...d, findQuote: async () => other })).status, 409, "no sobrescribe");
  assert.equal((await d.store.get(id))!.lote.quoteId, "q1");
  assert.equal((await handleConfirm(req(await seen(d, id)), id, d)).status, 200);
});

test("confirm with unresolved lines → 422 and nothing stored", async () => {
  const { d, mem } = deps({}, [okReading([doc("D1", [[1, 1]], { sourceLang: "de" })])]);
  const started = await handleStart(req({ source, targetLang: "es" }), d);
  const id = (started.body as { view: { lote: { id: string } } }).view.lote.id;
  assert.equal((await handleConfirm(req({}), id, d)).status, 400);
  const r = await handleConfirm(req(await seen(d, id)), id, d);
  assert.equal(r.status, 422);
  assert.equal(mem.rows.get(id)!.lote.status, "ok");
  assert.equal((await handleConfirm(req({ ...(await seen(d, id)), by: "otro" }), id, d)).status, 400);
  assert.equal((await handleEdit(req({ op: "linkQuote", quoteId: "q1" }), id, d)).status, 409);
});

test("confirm vs edit race: a lote edited after it was seen is never confirmed", async () => {
  const docs = [doc("D1", [[1, 1]]), doc("D2", [[1, 2]], { typeLabelEs: "Certificado de matrimonio", type: "marriage_certificate" })];
  const { d, mem } = deps({}, [okReading(docs)]);
  const started = await handleStart(req({ source, targetLang: "es" }), d);
  const view = (started.body as { view: { lote: { id: string }; documents: { id: string }[] } }).view;
  const id = view.lote.id;
  const before = await seen(d, id);
  await handleEdit(req({ op: "exclude", id: view.documents[1].id, reason: "no lo pide" }), id, d);
  const stale = await handleConfirm(req(before), id, d);
  assert.equal(stale.status, 409);
  assert.match((stale.body as { error: string }).error, /cambió/);
  assert.equal(mem.rows.get(id)!.lote.status, "ok");

  const racing: ApiDeps = {
    ...d,
    store: {
      ...d.store,
      get: async (x) => {
        const snap = await d.store.get(x);
        await d.store.replaceDocuments(x, snap!.documents.slice(0, 1));
        return snap;
      },
    },
  };
  const raced = await handleConfirm(req(await seen(d, id)), id, racing);
  assert.equal(raced.status, 409);
  assert.equal(mem.rows.get(id)!.lote.status, "ok");
  assert.equal((await handleConfirm(req(await seen(d, id)), id, d)).status, 200);
});
