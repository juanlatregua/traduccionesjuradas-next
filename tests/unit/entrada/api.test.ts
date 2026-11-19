import test from "node:test";
import assert from "node:assert/strict";
import { handleAddFile, handleConfirm, handleEdit, handleGet, handleOpen, handleRead, handleRemoveFile, type EntradaApiDeps } from "../../../lib/entrada/api.ts";
import { puertaV2On } from "../../../lib/entrada/flag.ts";
import { flowDeps, world } from "./fakes.ts";

function api(opts: { on?: boolean; limit?: number } = {}) {
  const w = world({ "https://abc.public.blob.vercel-storage.com/a.pdf": new TextEncoder().encode("%PDF-a") });
  const hits = new Map<string, number>();
  const deps: EntradaApiDeps = {
    ...flowDeps(w),
    enabled: () => opts.on ?? true,
    rateLimit: async (key, limit) => {
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return { ok: n <= Math.min(limit, opts.limit ?? Infinity), retryAfterSec: 60 };
    },
    alertStaff: async () => {},
    conserje: async () => null, budget: async () => true,
    clientIp: () => "1.2.3.4",
    ipHash: () => "iph",
    isOwnBlobUrl: (u) => u.startsWith("https://abc.public.blob.vercel-storage.com/"),
  };
  return { w, deps };
}
const post = (b: unknown) => new Request("http://x/api/entrada", { method: "POST", body: JSON.stringify(b) });
const OPEN = { email: "Ana@X.com", gdprConsent: true, marketingConsent: true };

test("PUERTA_V2 is off unless set to «on»", () => {
  assert.equal(puertaV2On({}), false);
  assert.equal(puertaV2On({ PUERTA_V2: "true" }), false);
  assert.equal(puertaV2On({ PUERTA_V2: " ON " }), true);
});

test("switch off: every endpoint answers 404 and nothing is written", async () => {
  const { w, deps } = api({ on: false });
  const token = "a".repeat(32);
  const responses = await Promise.all([
    handleOpen(post(OPEN), deps), handleGet(post({}), token, deps), handleAddFile(post({}), token, deps), handleRemoveFile(post({}), token, "x", deps),
    handleRead(post({}), token, deps), handleEdit(post({}), token, deps), handleConfirm(post({}), token, deps),
  ]);
  assert.deepEqual(responses.map((r) => r.status), [404, 404, 404, 404, 404, 404, 404]);
  assert.equal(w.entradas.length + w.casos.length + w.docs.length, 0);
});

test("open requires both consents (LSSI/RGPD) and a real email; no caso is created yet", async () => {
  const { w, deps } = api();
  assert.equal((await handleOpen(post({ ...OPEN, marketingConsent: false }), deps)).status, 400);
  assert.equal((await handleOpen(post({ ...OPEN, gdprConsent: undefined }), deps)).status, 400);
  assert.equal((await handleOpen(post({ ...OPEN, email: "nope" }), deps)).status, 400);
  const ok = await handleOpen(post({ ...OPEN, telefono: "+34 600 111 222" }), deps);
  assert.equal(ok.status, 200);
  assert.equal(w.entradas[0].email, "ana@x.com");
  assert.equal(w.entradas[0].phone9, "600111222");
  assert.equal(w.casos.length, 0);
});

test("files must be ours and of an allowed type; unknown tokens are 404", async () => {
  const { deps } = api();
  const { token } = (await handleOpen(post(OPEN), deps)).body as { token: string };
  assert.equal((await handleAddFile(post({ url: "https://evil.com/a.pdf", name: "a.pdf", size: 10, mimeType: "application/pdf" }), token, deps)).status, 400);
  assert.equal((await handleAddFile(post({ url: "https://abc.public.blob.vercel-storage.com/a.pdf", name: "a.exe", size: 10, mimeType: "application/x-msdownload" }), token, deps)).status, 400);
  assert.equal((await handleAddFile(post({ url: "https://abc.public.blob.vercel-storage.com/a.pdf", name: "a.pdf", size: 10, mimeType: "application/pdf" }), token, deps)).status, 200);
  assert.equal((await handleGet(post({}), "b".repeat(32), deps)).status, 404);
  assert.equal((await handleGet(post({}), "../../etc", deps)).status, 404);
});

test("rate limit answers 429 with Retry-After", async () => {
  const { deps } = api({ limit: 1 });
  assert.equal((await handleOpen(post(OPEN), deps)).status, 200);
  const r = await handleOpen(post(OPEN), deps);
  assert.equal(r.status, 429);
  assert.equal(r.headers?.["Retry-After"], "60");
});

test("confirm always asks for the deadline", async () => {
  const { deps } = api();
  const { token } = (await handleOpen(post(OPEN), deps)).body as { token: string };
  assert.equal((await handleConfirm(post({}), token, deps)).status, 400);
  assert.equal((await handleConfirm(post({ urgency: "DATE", neededBy: "2020-01-01" }), token, deps)).status, 400);
  assert.equal((await handleConfirm(post({ urgency: "ASAP" }), token, deps)).status, 409, "nothing read yet");
});
