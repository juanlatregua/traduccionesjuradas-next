import test from "node:test";
import assert from "node:assert/strict";
import { abrirEntrada, confirmarEntrada, editarEntrada, enviarCodigo, leerEntrada, registrarArchivo, verificarCodigo, vistaEntrada, EXCLUDED_BY_CLIENT, type FlowDeps } from "../../../lib/entrada/flow.ts";
import type { Canal } from "../../../lib/entrada/identidad.ts";
import { fingerprintOf } from "../../../lib/lectura-constructor/run.ts";
import type { Reading, SourceFile } from "../../../lib/lectura/index.ts";
import { doc, reading as modelReading } from "../lectura/fixtures.ts";
import { AHORA, bytesOf, flowDeps, sha, world, type World } from "./fakes.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com";
const JEN_PDF = bytesOf("%PDF-jeniffer-acta");
const DIEGO_PDF = bytesOf("%PDF-diego-facturas");
const blobs: Record<string, Uint8Array> = {
  [`${BLOB}/web/acta-x1.pdf`]: JEN_PDF,
  [`${BLOB}/wa/acta-y2.pdf`]: JEN_PDF,
  [`${BLOB}/web/Facturas-a.pdf`]: DIEGO_PDF,
  [`${BLOB}/wa/Facturas-b.pdf`]: DIEGO_PDF,
  [`${BLOB}/web/pasaporte.jpg`]: bytesOf("jpeg-pasaporte"),
  [`${BLOB}/web/hoja2.jpg`]: bytesOf("jpeg-hoja2"),
};

const meter = { attempts: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, usages: [], cost: null, ms: 5, servedBy: ["m"] };
function okReading(files: SourceFile[], sourceLang = "fr"): Reading {
  const batch = { files: files.map((f, i) => ({ index: i + 1, name: f.name, sha256: sha(f.bytes), pageCount: 1 })), duplicateFiles: [], skipped: [], pages: [], requestBytes: 1 };
  const docs = files.map((_, i) => doc(`D${i + 1}`, [[i + 1, 1]], { sourceLang, holder: "Titular" }));
  return {
    status: "ok", batch, reading: modelReading(docs), documents: docs.map((d) => ({ ...d, pageCount: 1, words: 200, wordsBasis: "exact" })),
    assessment: { clean: false, reasons: [] }, ...meter,
  } as never;
}

export async function verificar(deps: FlowDeps, w: World, id: string) {
  await enviarCodigo(deps, (await deps.store.get(id))!);
  const r = await verificarCodigo(deps, (await deps.store.get(id))!, w.codes[w.codes.length - 1].code);
  assert.equal(r.ok, true);
}

async function entrar(deps: FlowDeps, canal: Canal, contacto: { email?: string; phone9?: string; nombre?: string }, urls: string[], langs: { s?: string; t?: string } = {}, w?: World) {
  const { entrada } = await abrirEntrada(deps, { canal, email: contacto.email ?? null, phone9: contacto.phone9 ?? null, nombre: contacto.nombre ?? null, sourceLang: langs.s ?? null, targetLang: langs.t ?? "es", ipHash: null, marketing: true });
  if (canal === "web") await verificar(deps, w ?? CURRENT!, entrada.id);
  for (const url of urls) {
    const r = await registrarArchivo(deps, (await deps.store.get(entrada.id))!, { url, name: url.split("/").pop()!, size: 1, mimeType: "application/pdf" });
    assert.equal(r.ok, true);
  }
  const read = await leerEntrada(deps, (await deps.store.get(entrada.id))!);
  return { entrada: (await deps.store.get(entrada.id))!, read };
}

const casoCount = (w: World) => w.casos.length;
let CURRENT: World | null = null;
const mundo = () => (CURRENT = world(blobs));

test("Jeniffer: same PDF by web and by WhatsApp, different people as far as we can prove → 2 casos linked «¿mismo cliente?», no quote, no request", async () => {
  const w = mundo();
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const web = await entrar(deps, "web", { email: "jenifferdeschamps@icloud.com", nombre: "Jeniffer Deschamps" }, [`${BLOB}/web/acta-x1.pdf`]);
  const wa = await entrar(deps, "whatsapp", { phone9: "791365173" }, [`${BLOB}/wa/acta-y2.pdf`]);
  assert.equal(casoCount(w), 2);
  assert.deepEqual([wa.entrada.regla, wa.entrada.posibles], ["dudoso", [web.entrada.casoId]]);
  assert.equal(w.casos.find((c) => c.id === wa.entrada.casoId)!.dudoso, true);
  assert.deepEqual(w.quotesCreated, []);
});

test("same PDF by the same verified email twice → 1 caso and 1 reading", async () => {
  const w = mundo();
  const deps = flowDeps(w, { read: (fs) => okReading(fs, "pt") });
  const a1 = await entrar(deps, "web", { email: "diegoarndt@outlook.com" }, [`${BLOB}/web/Facturas-a.pdf`]);
  const a2 = await entrar(deps, "email", { email: "diegoarndt@outlook.com" }, [`${BLOB}/wa/Facturas-b.pdf`]);
  assert.equal(casoCount(w), 1);
  assert.equal(a2.entrada.casoId, a1.entrada.casoId);
  assert.equal(w.reads.length, 1);
});

test("legacy file without stored hash (fileHash NULL) is hashed on demand: another person's caso is flagged, not joined", async () => {
  const w = mundo();
  w.casos.push({ id: "old", ref: "CASO-OLD", estado: "ABIERTO", email: null, phone9: "997504962", nombre: null, esAgencia: false, lastActivityAt: new Date(AHORA.getTime() - 3 * 864e5), hashes: [], conPedido: false, origen: "whatsapp", dudoso: false });
  w.docs.push({ id: "legacy", casoId: "old", session: "exp:X", url: `${BLOB}/wa/Facturas-b.pdf`, name: "Facturas.pdf", size: DIEGO_PDF.length, hash: null, mimeType: "application/pdf" });
  const deps = flowDeps(w, { read: (fs) => okReading(fs, "pt") });
  const r = await entrar(deps, "web", { email: "diegoarndt@outlook.com" }, [`${BLOB}/web/Facturas-a.pdf`]);
  assert.notEqual(r.entrada.casoId, "old");
  assert.deepEqual(r.entrada.posibles, ["old"]);
  assert.equal(w.docs.find((d) => d.id === "legacy")!.hash, null, "the old row is not written");
});

test("invariance: same files and contact give the same caso and fingerprint whatever the channel or file order", async () => {
  const urls = [`${BLOB}/web/pasaporte.jpg`, `${BLOB}/web/hoja2.jpg`];
  const fps = new Set<string>();
  for (const [canal, list] of [["web", urls], ["email", [...urls].reverse()], ["constructor", urls]] as const) {
    const w = mundo();
    const deps = flowDeps(w, { read: (fs) => okReading(fs) });
    const r = await entrar(deps, canal, { email: "ana@x.com" }, [...list]);
    assert.equal(casoCount(w), 1);
    assert.equal(w.casos[0].estado, "ABIERTO");
    const lote = [...w.lectura.rows.values()][0].lote;
    fps.add(lote.fingerprint);
    assert.equal(lote.casoId, r.entrada.casoId);
    assert.equal(r.read.ok && r.read.view.lectura?.documentos.length, 2);
  }
  assert.equal(fps.size, 1);
  assert.equal(fingerprintOf([{ name: "a", url: "u1", mimeType: null }, { name: "b", url: "u2", mimeType: null }], "es", null), fingerprintOf([{ name: "b", url: "u2", mimeType: null }, { name: "a", url: "u1", mimeType: null }], "es", null));
});

test("client view: documents and what is not included, never prices", async () => {
  const w = mundo();
  const deps = flowDeps(w, {
    read: (fs) => okReading(fs),
    extras: { notToTranslate: [{ parts: [{ fileIndex: 2, page: 1 }], reason: "es el pasaporte del cliente, no se traduce" }], duplicates: [], questions: [{ textEs: "¿Dónde vas a presentarlo?" }], missing: { D1: [2] } },
  });
  const r = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/web/pasaporte.jpg`, `${BLOB}/web/hoja2.jpg`]);
  assert.equal(r.read.ok, true);
  const view = r.read.ok ? r.read.view : null;
  assert.match(view!.lectura!.resumen, /Has subido 2 archivos que corresponden a 2 documentos/);
  assert.deepEqual(view!.lectura!.documentos[0].faltan, [2]);
  assert.equal(view!.lectura!.noIncluidos[0].motivo, "es el pasaporte del cliente, no se traduce");
  assert.deepEqual(view!.lectura!.preguntas, ["¿Dónde vas a presentarlo?"]);
  const text = JSON.stringify(view);
  assert.doesNotMatch(text, /price|cents|precio|€|tariff|words/i);
});

test("client corrects (excludes a document) and confirms with deadline → Juan is told, lote stays for him to price", async () => {
  const w = mundo();
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const r = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/web/pasaporte.jpg`, `${BLOB}/web/hoja2.jpg`]);
  const view = r.read.ok ? r.read.view : null;
  const id = view!.lectura!.documentos[1].id;
  const ex = await editarEntrada(deps, r.entrada, { op: "exclude", id });
  assert.equal(ex.ok && ex.view.lectura!.documentos[1].incluido, false);
  assert.equal(ex.ok && ex.view.lectura!.documentos[1].motivo, EXCLUDED_BY_CLIENT);
  const stale = await confirmarEntrada(deps, r.entrada, { urgency: "ASAP", neededBy: null, organismo: null, notas: null, loteUpdatedAt: view!.lectura!.loteUpdatedAt });
  assert.equal(stale.ok, false, "the lote changed since that view");
  const fresh = ex.ok ? ex.view.lectura!.loteUpdatedAt : null;
  const c = await confirmarEntrada(deps, r.entrada, { urgency: "DATE", neededBy: new Date("2026-11-30T00:00:00Z"), organismo: "Consulado de Francia", notas: null, loteUpdatedAt: fresh });
  assert.equal(c.ok, true);
  const lote = [...w.lectura.rows.values()][0].lote;
  assert.equal(lote.status, "ok", "the client never confirms the lines: Juan does");
  assert.equal(w.avisos.length, 1);
  assert.equal(w.avisos[0].kind, "confirmada");
  assert.ok(w.eventos.some((e) => e.tipo === "entrada_confirmada" && e.payload.documentos === 1));
  assert.equal((await deps.store.get(r.entrada.id))!.estado, "confirmada");
});

test("language without sworn translator: declared pair closes without spending a reading", async () => {
  const w = mundo();
  const deps = flowDeps(w, { read: (fs) => okReading(fs, "el"), jurado: (s, t) => (s === "el" || t === "el" ? "no" : "si") });
  const r = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/web/pasaporte.jpg`], { s: "el", t: "es" });
  assert.equal(w.reads.length, 0);
  assert.equal(r.entrada.estado, "sin_jurado");
  assert.equal(r.read.ok && r.read.view.sinJurado?.idioma, "griego");
  assert.match(r.read.ok ? r.read.view.sinJurado!.maecUrl : "", /exteriores\.gob\.es/);
  assert.equal(w.casos[0].estado, "SIN_JURADO");
  assert.equal(w.avisos[0].kind, "sin_jurado");
});

test("language without sworn translator found by the reading closes too; unknown availability does not", async () => {
  const w = mundo();
  const deps = flowDeps(w, { read: (fs) => okReading(fs, "el"), jurado: () => "no" });
  const r = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/web/pasaporte.jpg`]);
  assert.equal(r.entrada.estado, "sin_jurado");
  const w2 = mundo();
  const r2 = await entrar(flowDeps(w2, { read: (fs) => okReading(fs, "el"), jurado: () => "desconocido" }), "web", { email: "ana@x.com" }, [`${BLOB}/web/pasaporte.jpg`]);
  assert.equal(r2.entrada.estado, "leida");
});

test("busy: attempts are counted by the lote on the server and the client is told to come back", async () => {
  const w = mundo();
  const seen: number[] = [];
  const deps = flowDeps(w, {
    read: (fs, attempt) => {
      seen.push(attempt);
      return attempt < 1 ? ({ status: "busy", retryable: true, attempt: attempt + 1, maxRetries: 2, reasonEs: "ocupado" } as Reading) : okReading(fs);
    },
  });
  const first = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/web/pasaporte.jpg`]);
  assert.equal(first.read.ok, false);
  assert.equal(!first.read.ok && first.read.busy, true);
  const again = await leerEntrada(deps, (await deps.store.get(first.entrada.id))!);
  assert.equal(again.ok, true);
  assert.deepEqual(seen, [0, 1]);
  assert.equal(casoCount(w), 1);
});

test("a file uploaded twice in one entrada is one file", async () => {
  const w = mundo();
  const deps = flowDeps(w);
  const { entrada } = await abrirEntrada(deps, { canal: "web", email: "ana@x.com", phone9: null, nombre: null, sourceLang: null, targetLang: null, ipHash: null, marketing: true });
  await registrarArchivo(deps, entrada, { url: `${BLOB}/web/acta-x1.pdf`, name: "acta.pdf", size: 1, mimeType: "application/pdf" });
  await registrarArchivo(deps, entrada, { url: `${BLOB}/wa/acta-y2.pdf`, name: "acta (1).pdf", size: 1, mimeType: "application/pdf" });
  assert.equal((await vistaEntrada(deps, entrada)).archivos.length, 1);
  assert.equal(w.docs[0].size, JEN_PDF.length, "size comes from the bytes, not from the client");
});

test("Juan 1: the same file after the first caso was ordered opens a new caso, related both ways", async () => {
  const w = mundo();
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const first = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/web/acta-x1.pdf`]);
  w.casos[0].conPedido = true;
  w.casos[0].estado = "EN_CURSO";
  const again = await entrar(deps, "web", { email: "ana@x.com" }, [`${BLOB}/wa/acta-y2.pdf`]);
  assert.equal(casoCount(w), 2);
  assert.notEqual(again.entrada.casoId, first.entrada.casoId);
  assert.deepEqual(again.entrada.relacionados, [first.entrada.casoId]);
  assert.ok(w.eventos.some((e) => e.casoId === again.entrada.casoId && e.tipo === "relacionado"));
  assert.ok(w.eventos.some((e) => e.casoId === first.entrada.casoId && e.tipo === "relacionado"));
});

test("attribution and language travel with the entrada and onto its files", async () => {
  const w = mundo();
  const deps = flowDeps(w);
  const { entrada } = await abrirEntrada(deps, { canal: "web", email: "ana@x.com", phone9: null, nombre: null, sourceLang: null, targetLang: null, ipHash: null, marketing: true, source: "uge-ce", lang: "fr" });
  assert.deepEqual([entrada.source, entrada.lang], ["uge-ce", "fr"]);
});
