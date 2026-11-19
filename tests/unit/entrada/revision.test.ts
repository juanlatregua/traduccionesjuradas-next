import test from "node:test";
import assert from "node:assert/strict";
import { handleAddFile, handleOpen, handleRead, type EntradaApiDeps } from "../../../lib/entrada/api.ts";
import { abrirEntrada, editarEntrada, enviarCodigo, leerEntrada, registrarArchivo, verificarCodigo, vistaEntrada, type FlowDeps } from "../../../lib/entrada/flow.ts";
import { codeEmail } from "../../../lib/entrada/codigo.ts";
import type { Reading, SourceFile } from "../../../lib/lectura/index.ts";
import { doc, reading as modelReading } from "../lectura/fixtures.ts";
import { bytesOf, flowDeps, sha, world, type World } from "./fakes.ts";

const B = "https://abc.public.blob.vercel-storage.com/";
const meter = { attempts: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, usages: [], cost: null, ms: 5, servedBy: ["m"] };
const okReading = (fs: SourceFile[]): Reading => {
  const docs = fs.map((_, i) => doc(`D${i + 1}`, [[i + 1, 1]]));
  return {
    status: "ok", batch: { files: fs.map((f, i) => ({ index: i + 1, name: f.name, sha256: sha(f.bytes), pageCount: 1 })), duplicateFiles: [], skipped: [], pages: [], requestBytes: 1 },
    reading: modelReading(docs), documents: docs.map((d) => ({ ...d, pageCount: 1, words: 100, wordsBasis: "exact" })), assessment: { clean: false, reasons: [] }, ...meter,
  } as never;
};
const busy = (attempt: number) => ({ status: "busy", retryable: true, attempt: attempt + 1, maxRetries: 99, reasonEs: "x" }) as Reading;

function apiDeps(w: World, read: (fs: SourceFile[], attempt: number) => Reading) {
  const hits = new Map<string, number>();
  const deps: EntradaApiDeps = {
    ...flowDeps(w, { read }), enabled: () => true,
    rateLimit: async (key, limit) => {
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return { ok: n <= limit, retryAfterSec: 60, remaining: limit - n };
    },
    alertStaff: async () => {}, clientIp: () => "1.2.3.4", ipHash: () => "iph", isOwnBlobUrl: (u) => u.startsWith(B),
  };
  return { deps, hits };
}
const p = (b?: unknown) => new Request("http://x/", { method: "POST", body: b ? JSON.stringify(b) : undefined });

test("reviewer repro: add → read while a reading is busy can no longer launch uncounted readings", async () => {
  const blobs: Record<string, Uint8Array> = {};
  for (let i = 0; i < 30; i++) blobs[`${B}f${i}.pdf`] = bytesOf(`%PDF-${i}`);
  const w = world(blobs);
  const fingerprints = new Set<string>();
  const { deps, hits } = apiDeps(w, (_fs, attempt) => busy(attempt));
  const tok = ((await handleOpen(p({ email: "a@x.com", gdprConsent: true, marketingConsent: true }), deps)).body as { token: string }).token;
  w.entradas[0].emailVerifiedAt = new Date();
  const adds: number[] = [];
  for (let i = 0; i < 20; i++) {
    adds.push((await handleAddFile(p({ url: `${B}f${i}.pdf`, name: "f.pdf", size: 10, mimeType: "application/pdf" }), tok, deps)).status);
    await handleRead(p(), tok, deps);
    for (const e of w.lectura.rows.values()) fingerprints.add(e.lote.fingerprint);
  }
  assert.equal(adds[0], 200);
  assert.ok(adds.slice(1).every((s) => s === 409), "no files are added while the reading is in progress");
  assert.equal(w.docs.length, 1);
  assert.equal(fingerprints.size, 1, "only one set of files was ever read");
  assert.equal(hits.get("entrada:read:email:a@x.com"), 1);
});

test("a running lote whose files differ from the current set is not a continuation: caps apply", async () => {
  const blobs = { [`${B}a.pdf`]: bytesOf("%PDF-a"), [`${B}b.pdf`]: bytesOf("%PDF-b") };
  const w = world(blobs);
  const { deps, hits } = apiDeps(w, (_fs, attempt) => busy(attempt));
  const tok = ((await handleOpen(p({ email: "a@x.com", gdprConsent: true, marketingConsent: true }), deps)).body as { token: string }).token;
  w.entradas[0].emailVerifiedAt = new Date();
  await handleAddFile(p({ url: `${B}a.pdf`, name: "a.pdf", size: 10, mimeType: "application/pdf" }), tok, deps);
  await handleRead(p(), tok, deps);
  w.docs.push({ ...w.docs[0], id: "sneaked", url: `${B}b.pdf`, hash: sha(blobs[`${B}b.pdf`]) });
  await handleRead(p(), tok, deps);
  assert.equal(hits.get("entrada:read:email:a@x.com"), 2);
});

async function verified(deps: FlowDeps, w: World, email: string, urls: string[]) {
  const { entrada } = await abrirEntrada(deps, { canal: "web", email, phone9: null, nombre: null, sourceLang: null, targetLang: "es", ipHash: null, marketing: true });
  for (const url of urls) await registrarArchivo(deps, (await deps.store.get(entrada.id))!, { url, name: url.split("/").pop()!, size: 1, mimeType: "application/pdf" });
  await enviarCodigo(deps, (await deps.store.get(entrada.id))!);
  await verificarCodigo(deps, (await deps.store.get(entrada.id))!, w.codes[w.codes.length - 1].code);
  await leerEntrada(deps, (await deps.store.get(entrada.id))!);
  return (await deps.store.get(entrada.id))!;
}

test("A1: a lote reused from another entrada (same bytes) is read-only for the client", async () => {
  const blobs = { [`${B}x1.pdf`]: bytesOf("%PDF-same"), [`${B}x2.pdf`]: bytesOf("%PDF-same") };
  const w = world(blobs);
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const first = await verified(deps, w, "uno@x.com", [`${B}x1.pdf`]);
  const second = await verified(deps, w, "uno@x.com", [`${B}x2.pdf`]);
  assert.equal(second.loteId, first.loteId);
  const view = await vistaEntrada(deps, second);
  assert.equal(view.lectura?.editable, false);
  const before = JSON.stringify((await deps.lectura.store.get(first.loteId!))!.documents);
  const r = await editarEntrada(deps, second, { op: "exclude", id: view.lectura!.documentos[0].id });
  assert.equal(!r.ok && r.status, 409);
  const t = await editarEntrada(deps, second, { op: "setTargetLang", targetLang: "fr" });
  assert.equal(t.ok, true);
  assert.equal((await deps.store.get(second.id))!.targetLang, "fr", "the language stays in the entrada");
  assert.equal(JSON.stringify((await deps.lectura.store.get(first.loteId!))!.documents), before);
  assert.notEqual((await deps.lectura.store.get(first.loteId!))!.lote.targetLang, "fr");
  assert.equal((await vistaEntrada(deps, first)).lectura?.editable, true, "the owner still edits its own lote");
});

test("A1: an entrada joined to an existing caso cannot edit even its own lote", async () => {
  const blobs = { [`${B}a.pdf`]: bytesOf("%PDF-a"), [`${B}b.pdf`]: bytesOf("%PDF-b") };
  const w = world(blobs);
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  await verified(deps, w, "ana@x.com", [`${B}a.pdf`]);
  const joined = await verified(deps, w, "ana@x.com", [`${B}b.pdf`]);
  assert.equal(joined.regla, "contacto");
  const view = await vistaEntrada(deps, joined);
  assert.equal(view.lectura?.editable, false);
  assert.equal((await editarEntrada(deps, joined, { op: "exclude", id: view.lectura!.documentos[0].id })).ok, false);
});

test("the code never reaches the mail log", async () => {
  const { redactCodes } = await import("../../../lib/azure-mail.ts");
  const subject = codeEmail("es", "482913").subject;
  assert.doesNotMatch(redactCodes(subject), /482913/);
  assert.match(redactCodes(subject), /\[código oculto\]/);
});

test("race: a file slipped in after the «continue» check is caught by the reading itself", async () => {
  const blobs = { [`${B}a.pdf`]: bytesOf("%PDF-a"), [`${B}b.pdf`]: bytesOf("%PDF-b") };
  const w = world(blobs);
  const { deps, hits } = apiDeps(w, (_fs, attempt) => busy(attempt));
  const tok = ((await handleOpen(p({ email: "a@x.com", gdprConsent: true, marketingConsent: true }), deps)).body as { token: string }).token;
  w.entradas[0].emailVerifiedAt = new Date();
  await handleAddFile(p({ url: `${B}a.pdf`, name: "a.pdf", size: 10, mimeType: "application/pdf" }), tok, deps);
  await handleRead(p(), tok, deps);
  const readsBefore = w.reads.length;
  const files = deps.store.files.bind(deps.store);
  let calls = 0;
  deps.store = { ...deps.store, files: async (id) => {
    calls += 1;
    if (calls === 2) w.docs.push({ ...w.docs[0], id: "sneaked", url: `${B}b.pdf`, hash: sha(blobs[`${B}b.pdf`]) });
    return files(id);
  } };
  const r = await handleRead(p(), tok, deps);
  assert.equal(r.status, 409);
  assert.equal(w.reads.length, readsBefore, "no reading was launched");
  assert.equal(hits.get("entrada:read:email:a@x.com"), 1);
  const again = await handleRead(p(), tok, deps);
  assert.notEqual(again.status, 409);
  assert.equal(hits.get("entrada:read:email:a@x.com"), 2, "the changed set now goes through the caps");
});
