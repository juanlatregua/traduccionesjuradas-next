import test from "node:test";
import assert from "node:assert/strict";
import { handleAddFile, handleConfirmLink, handleEmail, handleOpen, handleRead, ANON_FILES_PER_IP_DAY, type EntradaApiDeps } from "../../../lib/entrada/api.ts";
import { CODE_TTL_MS, codeEmail } from "../../../lib/entrada/codigo.ts";
import { caducarEntradas, ENTRADA_ANON_DIAS } from "../../../lib/entrada/caducar.ts";
import { AHORA, bytesOf, flowDeps, world, type World } from "./fakes.ts";

const B = "https://abc.public.blob.vercel-storage.com/";
const p = (b?: unknown) => new Request("http://x/", { method: "POST", body: b === undefined ? undefined : JSON.stringify(b) });

function api(w: World, o: { budget?: boolean; now?: () => Date } = {}) {
  const hits = new Map<string, number>();
  const deps: EntradaApiDeps = {
    ...flowDeps(w), ...(o.now ? { now: o.now } : {}), enabled: () => true,
    rateLimit: async (key, limit) => { const n = (hits.get(key) ?? 0) + 1; hits.set(key, n); return { ok: n <= limit, retryAfterSec: 60, remaining: limit - n }; },
    alertStaff: async () => {}, conserje: async () => null, budget: async () => o.budget ?? true,
    clientIp: () => "1.2.3.4", ipHash: () => "iph", isOwnBlobUrl: (u) => u.startsWith(B),
  };
  return { deps, hits };
}

async function anon(deps: EntradaApiDeps) {
  const r = await handleOpen(p({ gdprConsent: true, sourceLang: "fr", targetLangs: ["es"] }), deps);
  assert.equal(r.status, 200);
  return (r.body as { token: string }).token;
}

test("anonymous entrada: files and languages without email; no code, no reading, no caso", async () => {
  const w = world({ [`${B}a.pdf`]: bytesOf("%PDF-a") });
  const { deps } = api(w);
  const tok = await anon(deps);
  assert.deepEqual([w.entradas[0].email, w.entradas[0].targetLangs, w.codes.length], [null, ["es"], 0]);
  assert.equal((await handleAddFile(p({ url: `${B}a.pdf`, name: "a.pdf", size: 10, mimeType: "application/pdf" }), tok, deps)).status, 200);
  assert.equal((await handleRead(p(), tok, deps)).status, 403);
  assert.equal(w.casos.length + w.reads.length, 0);
  assert.equal((await handleOpen(p({ gdprConsent: false }), deps)).status, 400, "privacy consent is still needed to upload");
});

test("anonymous caps per IP: number of files and MB per day", async () => {
  const w = world({ [`${B}a.pdf`]: bytesOf("%PDF-a") });
  const { deps, hits } = api(w);
  const tok = await anon(deps);
  hits.set("entrada:anon-files:ip:1.2.3.4", ANON_FILES_PER_IP_DAY);
  assert.equal((await handleAddFile(p({ url: `${B}a.pdf`, name: "a.pdf", size: 10, mimeType: "application/pdf" }), tok, deps)).status, 429);
  const w2 = world({ [`${B}a.pdf`]: bytesOf("%PDF-a") });
  const tight = api(w2, { budget: false });
  const tok2 = await anon(tight.deps);
  assert.equal((await handleAddFile(p({ url: `${B}a.pdf`, name: "a.pdf", size: 10, mimeType: "application/pdf" }), tok2, tight.deps)).status, 429);
});

test("magic link: one use, bound to its entrada, expires in 10 minutes, says nothing else", async () => {
  const w = world();
  let now = AHORA.getTime();
  const { deps } = api(w, { now: () => new Date(now) });
  const tok = await anon(deps);
  const sent = await handleEmail(p({ email: "Ana@X.com", marketingConsent: true }), tok, deps);
  assert.equal(sent.status, 200);
  const { link, code, to } = w.codes[0];
  assert.equal(to, "ana@x.com");
  assert.ok(!w.entradas[0].linkHash?.includes(link), "only the hash is stored");
  const other = await anon(deps);
  await handleEmail(p({ email: "otro@x.com", marketingConsent: true }), other, deps);
  const ok = await handleConfirmLink(p({ k: link }), deps);
  assert.deepEqual([ok.status, ok.body], [200, { ok: true }]);
  assert.ok(w.entradas[0].emailVerifiedAt);
  assert.equal(w.entradas[1].emailVerifiedAt, null, "the link verifies only its own entrada");
  assert.equal((await handleConfirmLink(p({ k: link }), deps)).status, 410, "single use");
  assert.match(codeEmail("es", code, "https://x/entrada/confirmar?k=1").subject, new RegExp(`^Tu código: ${code}`));
  const late = w.codes[1].link;
  now += CODE_TTL_MS + 1;
  assert.equal((await handleConfirmLink(p({ k: late }), deps)).status, 410, "expired");
  assert.equal((await handleConfirmLink(p({ k: "x" }), deps)).status, 400);
});

test("email can be corrected until verified (a new code each time, the old link dies); email sends are capped", async () => {
  const w = world();
  const { deps } = api(w);
  const tok = await anon(deps);
  await handleEmail(p({ email: "mal@x.com", marketingConsent: true }), tok, deps);
  const old = w.codes[0].link;
  await handleEmail(p({ email: "bien@x.com", marketingConsent: true }), tok, deps);
  assert.equal(w.entradas[0].email, "bien@x.com");
  assert.equal((await handleConfirmLink(p({ k: old }), deps)).status, 410);
  assert.equal((await handleEmail(p({ email: "bien@x.com" }), tok, deps)).status, 400, "LSSI consent is required with the email");
  for (let i = 0; i < 4; i++) await handleEmail(p({ email: "bien@x.com", marketingConsent: true }), tok, deps);
  assert.equal((await handleEmail(p({ email: "bien@x.com", marketingConsent: true }), tok, deps)).status, 429);
});

test(`unverified entradas expire after ${ENTRADA_ANON_DIAS} days with their blobs; verified ones are never touched`, async () => {
  const deleted: string[] = [];
  const borradas: string[] = [];
  const r = await caducarEntradas(
    {
      expiradas: async (before) => {
        assert.equal(before.getTime(), AHORA.getTime() - ENTRADA_ANON_DIAS * 864e5);
        return [{ id: "anon", files: [{ id: "f1", url: "u1" }, { id: "f2", url: "u2" }] }, { id: "verificada-entretanto", files: [{ id: "f3", url: "u3" }] }];
      },
      deleteBlob: async (u) => void deleted.push(u),
      borrar: async (id) => (id === "anon" ? (borradas.push(id), true) : false),
    },
    AHORA,
  );
  assert.deepEqual([r, deleted, borradas], [{ entradas: 1, archivos: 2 }, ["u1", "u2"], ["anon"]]);
});
