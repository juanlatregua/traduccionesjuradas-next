import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { abrirEntrada, editarEntrada, enviarCodigo, leerEntrada, registrarArchivo, verificarCodigo, vistaEntrada, type FlowDeps } from "../../../lib/entrada/flow.ts";
import { entradaLeads } from "../../../lib/entrada/leads.ts";
import { moduleMissing } from "../../../lib/lectura/prepare.ts";
import type { Reading, SourceFile } from "../../../lib/lectura/index.ts";
import { doc, reading as modelReading } from "../lectura/fixtures.ts";
import { AHORA, bytesOf, flowDeps, sha, world, type World } from "./fakes.ts";

const B = "https://abc.public.blob.vercel-storage.com/";
const meter = { attempts: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, usages: [], cost: null, ms: 5, servedBy: ["m"] };
const okReading = (fs: SourceFile[], sourceLang = "es"): Reading => {
  const docs = fs.map((_, i) => doc(`D${i + 1}`, [[i + 1, 1]], { sourceLang }));
  return {
    status: "ok", batch: { files: fs.map((f, i) => ({ index: i + 1, name: f.name, sha256: sha(f.bytes), pageCount: 1 })), duplicateFiles: [], skipped: [], pages: [], requestBytes: 1 },
    reading: modelReading(docs, { targetLang: "unknown", targetLangBasis: "unknown" }), documents: docs.map((d) => ({ ...d, pageCount: 1, words: 100, wordsBasis: "exact" })), assessment: { clean: false, reasons: [] }, ...meter,
  } as never;
};

async function web(deps: FlowDeps, w: World, email: string, urls: string[], phone9: string | null = null) {
  const { entrada } = await abrirEntrada(deps, { canal: "web", email, phone9, nombre: "jaun", sourceLang: null, targetLang: null, ipHash: null, marketing: true });
  for (const url of urls) await registrarArchivo(deps, (await deps.store.get(entrada.id))!, { url, name: url.split("/").pop()!, size: 1, mimeType: "image/png" });
  await enviarCodigo(deps, (await deps.store.get(entrada.id))!);
  await verificarCodigo(deps, (await deps.store.get(entrada.id))!, w.codes[w.codes.length - 1].code);
  return entrada.id;
}

test("4: every route that launches a reading gets the worker's modules traced (Next matches keys with picomatch, contains)", async () => {
  const configPath = "../../../next.config.mjs";
  const { LECTURA_ROUTES, LECTURA_MODULES } = (await import(configPath)) as { LECTURA_ROUTES: string[]; LECTURA_MODULES: string[] };
  const picomatch = createRequire(import.meta.url)("next/dist/compiled/picomatch");
  const covered = (route: string) => LECTURA_ROUTES.some((g) => picomatch(g, { dot: true, contains: true })(route));
  for (const route of ["/api/entrada/[token]/leer/route", "/api/entrada/[token]/archivos/route", "/api/zona-traductor/lectura/route"]) assert.ok(covered(route), route);
  for (const m of ["pdf-lib", "pdf-parse", "sharp", "heic-convert"]) assert.ok(LECTURA_MODULES.some((x) => x.includes(`/${m}/`)), m);
});

test("4: a module missing from the deployment is a server fault, never «PDF dañado»", () => {
  const err = Object.assign(new Error("Cannot find module 'pdf-lib'\nRequire stack: ..."), { code: "MODULE_NOT_FOUND" });
  assert.equal(moduleMissing(err), true);
  assert.equal(moduleMissing(new Error("Invalid PDF structure")), false);
});

test("4: pages are counted at upload (no model call); an unreadable file shows as 0 pages", async () => {
  const w = world({ [`${B}a.pdf`]: bytesOf("%PDF-a"), [`${B}b.pdf`]: bytesOf("%PDF-b") });
  const deps: FlowDeps = { ...flowDeps(w), inspect: async (f) => (f.name === "a.pdf" ? { pages: 4, problem: null } : { pages: 0, problem: "no se abre" }) };
  const { entrada } = await abrirEntrada(deps, { canal: "web", email: "a@x.com", phone9: null, nombre: null, sourceLang: null, targetLang: null, ipHash: null, marketing: true });
  await registrarArchivo(deps, entrada, { url: `${B}a.pdf`, name: "a.pdf", size: 1, mimeType: "application/pdf" });
  await registrarArchivo(deps, entrada, { url: `${B}b.pdf`, name: "b.pdf", size: 1, mimeType: "application/pdf" });
  assert.deepEqual((await vistaEntrada(deps, entrada)).archivos.map((f) => f.pages), [4, 0]);
  assert.equal(w.reads.length, 0);
});

test("5: Julián's testament uploaded with another verified email opens a new caso «¿mismo cliente?», editable for that client", async () => {
  const pngs = { [`${B}p1.png`]: bytesOf("png-p1"), [`${B}p2.png`]: bytesOf("png-p2") };
  const w = world(pngs);
  w.casos.push({ id: "julian", ref: "CASO-94EKHU", estado: "ABIERTO", email: null, phone9: "626261354", nombre: "Julian", esAgencia: false, lastActivityAt: new Date(AHORA.getTime() - 864e5), hashes: [], conPedido: false, origen: "whatsapp", dudoso: false });
  w.docs.push({ id: "j1", casoId: "julian", session: "exp:EXP-X", url: `${B}old-p1.png`, name: "p1.png", size: 6, hash: sha(pngs[`${B}p1.png`]), mimeType: "image/png" });
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const id = await web(deps, w, "juansilvamoreno@msn.com", [`${B}p1.png`, `${B}p2.png`], "607356273");
  await leerEntrada(deps, (await deps.store.get(id))!);
  const e = (await deps.store.get(id))!;
  assert.notEqual(e.casoId, "julian");
  assert.deepEqual([e.regla, e.posibles], ["dudoso", ["julian"]]);
  assert.equal(w.casos.find((c) => c.id === "julian")!.lastActivityAt.getTime(), AHORA.getTime() - 864e5, "Julián's caso is untouched");
  const view = await vistaEntrada(deps, e);
  assert.deepEqual([view.lectura?.editable, view.soloLectura], [true, null]);
});

test("5: a read-only entrada says why", async () => {
  const w = world({ [`${B}a.png`]: bytesOf("a"), [`${B}b.png`]: bytesOf("b") });
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  await leerEntrada(deps, (await deps.store.get(await web(deps, w, "ana@x.com", [`${B}a.png`])))!);
  const id = await web(deps, w, "ana@x.com", [`${B}b.png`]);
  await leerEntrada(deps, (await deps.store.get(id))!);
  assert.equal((await vistaEntrada(deps, (await deps.store.get(id))!)).soloLectura, "caso_existente");
});

test("languages: several targets, changeable after the reading without a new reading, also when read-only", async () => {
  const w = world({ [`${B}t.png`]: bytesOf("t"), [`${B}u.png`]: bytesOf("u") });
  const deps = flowDeps(w, { read: (fs) => okReading(fs) });
  const id = await web(deps, w, "ana@x.com", [`${B}t.png`]);
  const pre = await editarEntrada(deps, (await deps.store.get(id))!, { op: "setLangs", sourceLang: "es", targetLangs: ["es"] });
  assert.equal(!pre.ok && pre.status, 422, "same language on both sides is refused");
  await editarEntrada(deps, (await deps.store.get(id))!, { op: "setLangs", sourceLang: null, targetLangs: ["fr"] });
  await leerEntrada(deps, (await deps.store.get(id))!);
  assert.equal(w.reads.length, 1);
  const r = await editarEntrada(deps, (await deps.store.get(id))!, { op: "setLangs", sourceLang: "es", targetLangs: ["fr", "en"] });
  assert.equal(r.ok && r.view.idiomas.destinos.join(","), "fr,en");
  const e = (await deps.store.get(id))!;
  const lote = (await deps.lectura.store.get(e.loteId!))!;
  assert.equal(lote.lote.targetLang, "fr");
  assert.ok(lote.documents.every((d) => d.sourceLang === "es"));
  assert.equal(w.reads.length, 1, "changing languages never reads again");

  const other = await web(deps, w, "ana@x.com", [`${B}u.png`]);
  await leerEntrada(deps, (await deps.store.get(other))!);
  const ro = (await deps.store.get(other))!;
  assert.equal((await vistaEntrada(deps, ro)).soloLectura, "caso_existente");
  const ch = await editarEntrada(deps, ro, { op: "setLangs", sourceLang: "es", targetLangs: ["de"] });
  assert.equal(ch.ok, true);
  assert.deepEqual((await deps.store.get(other))!.targetLangs, ["de"]);
});

test("6: entradas marked «prueba» are not leads", () => {
  const base = { casoId: "c", email: "a@x.com", phone9: null, nombre: null, sourceLang: null, targetLang: "es", urgency: null, neededBy: null, createdAt: AHORA, files: [{ name: "a", sha256: "h" }] };
  assert.equal(entradaLeads([{ ...base, id: "1", estado: "prueba" }, { ...base, id: "2", estado: "confirmada" }]).length, 1);
});
