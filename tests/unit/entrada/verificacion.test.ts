import test from "node:test";
import assert from "node:assert/strict";
import { abrirEntrada, confirmarEntrada, enviarCodigo, leerEntrada, registrarArchivo, verificarCodigo, type FlowDeps } from "../../../lib/entrada/flow.ts";
import { handleOpen, handleRead, handleSendCode, handleVerify, READS_GLOBAL_DAY, type EntradaApiDeps } from "../../../lib/entrada/api.ts";
import { CODE_TTL_MS } from "../../../lib/entrada/codigo.ts";
import { entradaFunnel } from "../../../lib/entrada/leads.ts";
import type { Reading, SourceFile } from "../../../lib/lectura/index.ts";
import { doc, reading as modelReading } from "../lectura/fixtures.ts";
import { AHORA, bytesOf, flowDeps, sha, world, type World } from "./fakes.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com";
const blobs = { [`${BLOB}/a.pdf`]: bytesOf("%PDF-a"), [`${BLOB}/b.pdf`]: bytesOf("%PDF-b") };
const meter = { attempts: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, usages: [], cost: null, ms: 5, servedBy: ["m"] };
const okReading = (fs: SourceFile[], sourceLang = "fr"): Reading => {
  const docs = fs.map((_, i) => doc(`D${i + 1}`, [[i + 1, 1]], { sourceLang }));
  return {
    status: "ok", batch: { files: fs.map((f, i) => ({ index: i + 1, name: f.name, sha256: sha(f.bytes), pageCount: 1 })), duplicateFiles: [], skipped: [], pages: [], requestBytes: 1 },
    reading: modelReading(docs), documents: docs.map((d) => ({ ...d, pageCount: 1, words: 100, wordsBasis: "exact" })), assessment: { clean: false, reasons: [] }, ...meter,
  } as never;
};

const victim = (w: World, o: Partial<World["casos"][number]> = {}) => {
  w.casos.push({ id: "victima", ref: "CASO-V", estado: "ABIERTO", email: "victima@x.com", phone9: null, nombre: "Víctima", esAgencia: false, lastActivityAt: new Date(AHORA.getTime() - 864e5), hashes: [], conPedido: false, origen: "puerta", dudoso: false, ...o });
  return w.casos[w.casos.length - 1];
};

async function webEntrada(deps: FlowDeps, email: string, urls: string[], langs: { s?: string } = {}) {
  const { entrada } = await abrirEntrada(deps, { canal: "web", email, phone9: "699000111", nombre: null, sourceLang: langs.s ?? null, targetLang: "es", ipHash: null, marketing: true });
  for (const url of urls) await registrarArchivo(deps, (await deps.store.get(entrada.id))!, { url, name: url.split("/").pop()!, size: 1, mimeType: "application/pdf" });
  return entrada.id;
}
async function verify(deps: FlowDeps, w: World, id: string) {
  await enviarCodigo(deps, (await deps.store.get(id))!);
  return verificarCodigo(deps, (await deps.store.get(id))!, w.codes[w.codes.length - 1].code);
}

test("code: 6 digits, only its hash is stored, 10 minutes, 5 attempts", async () => {
  const w = world(blobs);
  let now = AHORA.getTime();
  const deps = { ...flowDeps(w), now: () => new Date(now) };
  const id = await webEntrada(deps, "ana@x.com", []);
  await enviarCodigo(deps, (await deps.store.get(id))!);
  const { code, to } = w.codes[0];
  assert.match(code, /^\d{6}$/);
  assert.equal(to, "ana@x.com");
  const row = (await deps.store.get(id))!;
  assert.notEqual(row.codeHash, code);
  assert.ok(!JSON.stringify(row).includes(`"${code}"`));
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await verificarCodigo(deps, (await deps.store.get(id))!, wrong)).ok, false);
  const locked = await verificarCodigo(deps, (await deps.store.get(id))!, code);
  assert.equal(!locked.ok && locked.status, 429, "the 6th try fails even with the right code");
  await enviarCodigo(deps, (await deps.store.get(id))!);
  now += CODE_TTL_MS + 1;
  const late = await verificarCodigo(deps, (await deps.store.get(id))!, w.codes[1].code);
  assert.equal(!late.ok && late.status, 410);
  now = AHORA.getTime();
  await enviarCodigo(deps, (await deps.store.get(id))!);
  assert.equal((await verificarCodigo(deps, (await deps.store.get(id))!, w.codes[2].code)).ok, true);
  assert.ok((await deps.store.get(id))!.emailVerifiedAt);
});

test("unverified: thumbnails yes, but no reading, no caso and nothing touched", async () => {
  const w = world(blobs);
  victim(w);
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const id = await webEntrada(deps, "victima@x.com", [`${BLOB}/a.pdf`]);
  const r = await leerEntrada(deps, (await deps.store.get(id))!);
  assert.equal(!r.ok && r.status, 403);
  assert.equal(w.reads.length, 0);
  assert.equal(w.casos.length, 1);
  assert.equal(w.eventos.length, 0);
  assert.equal((await deps.store.get(id))!.casoId, null);
  assert.equal(w.docs.find((d) => d.session === `entrada:${id}`)!.casoId, null);
});

test("WhatsApp, inbox email and constructor arrive verified", async () => {
  const w = world(blobs);
  const deps = flowDeps(w);
  for (const canal of ["whatsapp", "email", "constructor"] as const) {
    const { entrada } = await abrirEntrada(deps, { canal, email: null, phone9: "600111222", nombre: null, sourceLang: null, targetLang: null, ipHash: null, marketing: false });
    assert.ok(entrada.emailVerifiedAt, canal);
  }
  const { entrada } = await abrirEntrada(deps, { canal: "web", email: "a@x.com", phone9: null, nombre: null, sourceLang: null, targetLang: null, ipHash: null, marketing: true });
  assert.equal(entrada.emailVerifiedAt, null);
});

test("A3 repro: someone typing another's email cannot reach their caso; the real owner only ADDS (deadline and contact untouched)", async () => {
  const w = world(blobs);
  const v = victim(w);
  const plazos: string[] = [];
  const deps = { ...flowDeps(w, { read: (fs) => okReading(fs) }) };
  deps.caso = { ...deps.caso, plazo: async (casoId) => void plazos.push(casoId) };
  const intruso = await webEntrada(deps, "victima@x.com", [`${BLOB}/a.pdf`]);
  assert.equal((await leerEntrada(deps, (await deps.store.get(intruso))!)).ok, false);
  assert.deepEqual([v.email, v.phone9, v.estado], ["victima@x.com", null, "ABIERTO"]);

  const owner = await webEntrada(deps, "victima@x.com", [`${BLOB}/b.pdf`]);
  assert.equal((await verify(deps, w, owner)).ok, true);
  const read = await leerEntrada(deps, (await deps.store.get(owner))!);
  assert.equal(read.ok, true);
  const e = (await deps.store.get(owner))!;
  assert.deepEqual([e.casoId, e.regla], ["victima", "contacto"]);
  assert.equal(v.phone9, null, "the typed phone is not written on the existing caso");
  const c = await confirmarEntrada(deps, e, { urgency: "ASAP", neededBy: null, organismo: null, notas: null, loteUpdatedAt: null });
  assert.equal(c.ok, true);
  assert.deepEqual(plazos, [], "the existing caso's deadline is not overwritten");
  assert.ok(w.eventos.some((x) => x.casoId === "victima" && x.tipo === "entrada_confirmada" && x.payload.urgency === "ASAP"), "kept as an event");
  assert.ok(w.eventos.some((x) => x.casoId === "victima" && x.tipo === "adjuntado" && (x.payload.contacto as { phone9: string }).phone9 === "699000111"));
});

test("A2 repro: a language without sworn translator never closes a caso that had something else alive", async () => {
  const w = world(blobs);
  const v = victim(w);
  w.docs.push({ id: "vieja", casoId: "victima", session: "puerta-vieja", url: `${BLOB}/x.pdf`, name: "x.pdf", size: 9, hash: "zz", mimeType: "application/pdf" });
  const deps = flowDeps(w, { read: (fs) => okReading(fs, "el"), jurado: () => "no" });
  const id = await webEntrada(deps, "victima@x.com", [`${BLOB}/a.pdf`]);
  await verify(deps, w, id);
  await leerEntrada(deps, (await deps.store.get(id))!);
  assert.equal((await deps.store.get(id))!.estado, "sin_jurado", "SIN_JURADO applies to the new part");
  assert.equal(v.estado, "ABIERTO");

  const w2 = world(blobs);
  const fresh = flowDeps(w2, { read: (fs) => okReading(fs, "el"), jurado: () => "no" });
  const id2 = await webEntrada(fresh, "nuevo@x.com", [`${BLOB}/a.pdf`]);
  await verify(fresh, w2, id2);
  await leerEntrada(fresh, (await fresh.store.get(id2))!);
  assert.equal(w2.casos[0].estado, "SIN_JURADO", "a caso made only of this entrada does close");
});

function api(w: World) {
  const hits = new Map<string, number>();
  const alerts: string[] = [];
  const deps: EntradaApiDeps = {
    ...flowDeps(w, { read: (fs) => okReading(fs) }),
    enabled: () => true,
    rateLimit: async (key, limit) => {
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return { ok: n <= limit, retryAfterSec: 60, remaining: Math.max(0, limit - n) };
    },
    alertStaff: async (s) => void alerts.push(s),
    clientIp: () => "1.2.3.4",
    ipHash: () => "iph",
    isOwnBlobUrl: (u) => u.startsWith(BLOB),
  };
  return { deps, hits, alerts };
}
const post = (b: unknown = {}) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });

test("cost: unverified calls spend nothing; 3 readings a day per verified email; code sends are limited", async () => {
  const w = world(blobs);
  const { deps, hits } = api(w);
  const open = await handleOpen(post({ email: "ana@x.com", gdprConsent: true, marketingConsent: true }), deps);
  const token = (open.body as { token: string; codeSent: boolean }).token;
  assert.equal((open.body as { codeSent: boolean }).codeSent, true);
  assert.equal((await handleRead(post(), token, deps)).status, 403);
  assert.equal(hits.get("entrada:read:email:ana@x.com"), undefined, "a refused unverified call does not burn the cap");
  for (let i = 0; i < 4; i++) await handleSendCode(post(), token, deps);
  assert.equal((await handleSendCode(post(), token, deps)).status, 429, "5 codes per hour per email");
  assert.equal((await handleVerify(post({ code: w.codes[w.codes.length - 1].code }), token, deps)).status, 200);
  hits.set("entrada:read:email:ana@x.com", 3);
  const fourth = await handleRead(post(), token, deps);
  assert.equal(fourth.status, 429);
});

test("cost: the global ceiling warns staff once at 50 %", async () => {
  const w = world(blobs);
  const { deps, hits, alerts } = api(w);
  const token = ((await handleOpen(post({ email: "ana@x.com", gdprConsent: true, marketingConsent: true }), deps)).body as { token: string }).token;
  await handleVerify(post({ code: w.codes[0].code }), token, deps);
  hits.set("entrada:read:global", READS_GLOBAL_DAY / 2);
  await handleRead(post(), token, deps);
  await handleRead(post(), token, deps);
  assert.equal(alerts.length, 1);
});

test("funnel: one entrada counts once, however many files", () => {
  assert.deepEqual(entradaFunnel([{ loteId: "l", email: "a@x.com", phone9: null, files: 7 }, { loteId: null, email: "b@x.com", phone9: null, files: 2 }, { loteId: null, email: "c@x.com", phone9: null, files: 0 }]), { analizado: 1, lead: 2 });
});
