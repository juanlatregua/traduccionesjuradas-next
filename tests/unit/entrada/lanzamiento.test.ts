import test from "node:test";
import assert from "node:assert/strict";
import { abrirEntrada, confirmarEntrada, enviarCodigo, leerEntrada, registrarArchivo, verificarCodigo, editarEntrada, type FlowDeps } from "../../../lib/entrada/flow.ts";
import type { Reading, SourceFile } from "../../../lib/lectura/index.ts";
import { doc, reading as modelReading } from "../lectura/fixtures.ts";
import { bytesOf, flowDeps, sha, world, type World } from "./fakes.ts";
import { entradaResumen, routingPair, staffLinks, staffTo } from "../../../lib/entrada/aviso.ts";
import { ackLangOf, priceRequestAckText } from "../../../lib/price-request-ack.ts";
import { keepEntradaFiles, isEntradaSession } from "../../../lib/entrada/retencion.ts";
import { madridHour, recordatorioEmail, recordatorioHourOk, selectRecordatorios, type EntradaAMedias } from "../../../lib/entrada/recordatorio.ts";
import { runFrAuto, type FrAutoData, type FrAutoIO } from "../../../lib/entrada/fr-auto.ts";
import type { QuotePayload } from "../../../lib/lectura-constructor/lines.ts";
import { buildLines } from "../../../lib/lectura-constructor/lines.ts";
import { entradaLeads } from "../../../lib/entrada/leads.ts";
import type { EntradaRow } from "../../../lib/entrada/store.ts";
import { sessionKeyOf } from "../../../lib/entrada/store.ts";
import { working } from "../lectura-constructor/fakes.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com";
const blobs: Record<string, Uint8Array> = { [`${BLOB}/web/a.pdf`]: bytesOf("%PDF-a"), [`${BLOB}/web/b.pdf`]: bytesOf("%PDF-b") };
const meter = { attempts: 1, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, usages: [], cost: null, ms: 5, servedBy: ["m"] };
function okReading(files: SourceFile[], sourceLang: string): Reading {
  const batch = { files: files.map((f, i) => ({ index: i + 1, name: f.name, sha256: sha(f.bytes), pageCount: 1 })), duplicateFiles: [], skipped: [], pages: [], requestBytes: 1 };
  const docs = files.map((_, i) => doc(`D${i + 1}`, [[i + 1, 1]], { sourceLang }));
  return { status: "ok", batch, reading: modelReading(docs), documents: docs.map((d) => ({ ...d, pageCount: 1, words: 200, wordsBasis: "exact" })), assessment: { clean: false, reasons: [] }, ...meter } as never;
}

type Calls = { route: unknown[]; ack: string[]; funnel: string[] };
async function leida(sourceLang: string, extra: Partial<FlowDeps> = {}, langs: { s?: string | null; t?: string } = {}) {
  const w: World = world(blobs);
  const calls: Calls = { route: [], ack: [], funnel: [] };
  const deps: FlowDeps = {
    ...flowDeps(w, { read: (fs) => okReading(fs, sourceLang) }),
    ackClient: async (e) => void calls.ack.push(e.lang ?? "es"),
    funnel: async (_e, step) => void calls.funnel.push(step),
    ...extra,
  };
  const { entrada } = await abrirEntrada(deps, { canal: "web", email: "ana@x.com", phone9: "600111222", nombre: "Ana", sourceLang: langs.s ?? null, targetLang: langs.t ?? "es", ipHash: null, marketing: true, lang: "pt", source: "uge-ce" });
  await enviarCodigo(deps, (await deps.store.get(entrada.id))!);
  await verificarCodigo(deps, (await deps.store.get(entrada.id))!, w.codes[w.codes.length - 1].code);
  for (const url of [`${BLOB}/web/a.pdf`, `${BLOB}/web/b.pdf`]) await registrarArchivo(deps, (await deps.store.get(entrada.id))!, { url, name: url.split("/").pop()!, size: 1, mimeType: "application/pdf" });
  const r = await leerEntrada(deps, (await deps.store.get(entrada.id))!);
  assert.equal(r.ok, true);
  return { w, deps, calls, e: (await deps.store.get(entrada.id))!, view: r.ok ? r.view : null };
}
const confirmar = (deps: FlowDeps, e: EntradaRow, loteUpdatedAt: string | null) =>
  confirmarEntrada(deps, e, { urgency: "ASAP", neededBy: null, organismo: "Registro Civil", notas: null, loteUpdatedAt, respuestas: [{ pregunta: "¿Dónde lo presentas?", respuesta: "Registro Civil" }] });

test("non-FR confirmed: goes down the old puerta path (one call), Juan is told by it, the client gets the ack once and the funnel sees it", async () => {
  const route: unknown[] = [];
  const { deps, w, calls, e, view } = await leida("pt", { routeQuote: async (en, data, x) => (route.push({ id: en.id, x, data: !!data }), { handled: true, quoteSent: false }) });
  const id = view!.lectura!.documentos[1].id;
  const ex = await editarEntrada(deps, e, { op: "exclude", id });
  const c = await confirmar(deps, e, ex.ok ? ex.view.lectura!.loteUpdatedAt : null);
  assert.equal(c.ok, true);
  assert.equal(route.length, 1);
  assert.deepEqual((route[0] as { x: { documentos: number; excluidos: string[] } }).x.documentos, 1);
  assert.equal((route[0] as { x: { excluidos: string[] } }).x.excluidos.length, 1);
  assert.equal(w.avisos.length, 0, "the router already emailed and texted staff");
  assert.deepEqual(calls.ack, ["pt"]);
  assert.deepEqual(calls.funnel, ["entrada_confirmada"]);
});

test("the router fails → the entrada notice goes out (never stranded) and the client still gets the ack", async () => {
  const { deps, w, calls, e, view } = await leida("de", { routeQuote: async () => { throw new Error("lavori caído"); } });
  const c = await confirmar(deps, e, view!.lectura!.loteUpdatedAt);
  assert.equal(c.ok, true);
  assert.equal(w.avisos.length, 1);
  assert.equal(w.avisos[0].kind, "confirmada");
  assert.deepEqual(calls.ack, ["pt"]);
});

test("the router sent a quote by itself (tariff / closed price) → no ack on top, the client is told it is sent", async () => {
  const { deps, calls, e, view } = await leida("pt", { routeQuote: async () => ({ handled: true, quoteSent: true }) });
  const c = await confirmar(deps, e, view!.lectura!.loteUpdatedAt);
  assert.equal(c.ok && c.view.presupuestoEnviado, true);
  assert.deepEqual(calls.ack, []);
});

test("FR with an automatic draft: no second path, Juan gets the entrada notice with the number, the client gets the ack", async () => {
  const route: unknown[] = [];
  const { deps, w, calls, e, view } = await leida("fr", {
    frAuto: async () => ({ action: "drafted", detail: "x", quoteNumber: "2026-0400" }),
    routeQuote: async () => (route.push(1), { handled: true, quoteSent: false }),
  });
  await confirmar(deps, e, view!.lectura!.loteUpdatedAt);
  assert.equal(route.length, 0);
  assert.equal(w.avisos.length, 1);
  assert.equal(w.avisos[0].kind === "confirmada" && w.avisos[0].presupuesto, "2026-0400");
  assert.deepEqual(calls.ack, ["pt"]);
});

test("FR sent automatically: no ack (the quote email is the answer)", async () => {
  const { deps, calls, e, view } = await leida("fr", { frAuto: async () => ({ action: "sent", detail: "x", quoteNumber: "2026-0401" }) });
  await confirmar(deps, e, view!.lectura!.loteUpdatedAt);
  assert.deepEqual(calls.ack, []);
});

const fila = (o: Partial<EntradaRow> = {}) =>
  ({ id: "e1", casoId: "c1", email: "ana@x.com", nombre: "Ana López", phone9: "600111222", lang: "es", source: null, urgency: "ASAP", neededBy: null, organismo: null, pais: null, notas: null, respuestas: null, sourceLang: "pt", targetLang: "es", targetLangs: ["es"], regla: null, relacionados: [], ...o }) as EntradaRow;

test("staff links work with LECTURA_CONSTRUCTOR off: caso page and builder with the entrada's files", () => {
  const l = staffLinks(fila());
  assert.equal(l.caso, "https://www.traduccionesjuradas.net/zona-traductor/casos/c1");
  assert.match(l.builder, /\/zona-traductor\/presupuesto\?session=entrada%3Ae1&customerEmail=ana%40x\.com&customerName=Ana\+L%C3%B3pez&customerPhone=600111222$/);
  assert.doesNotMatch(l.builder + l.caso, /lectura/);
  assert.doesNotMatch(entradaLeads([{ ...fila(), estado: "confirmada", createdAt: new Date(), files: [{ name: "a", sha256: "h" }] }])[0].link, /lectura/);
});

test("staff recipient never missing: PRESUPUESTO_TO, else ADMIN_EMAIL, else hola@", () => {
  assert.equal(staffTo({ PRESUPUESTO_TO: "p@x", ADMIN_EMAIL: "a@x" }), "p@x");
  assert.equal(staffTo({ ADMIN_EMAIL: "a@x" }), "a@x");
  assert.equal(staffTo({}), "hola@traduccionesjuradas.net");
});

test("the router's staff email carries what the client said, the campaign and the extra targets", () => {
  const lines = entradaResumen(fila({ source: "regularizacion-2026", targetLangs: ["es", "en"], respuestas: [{ pregunta: "¿Apostilla?", respuesta: "Sí" }], notas: "en papel" }), { casoRef: "CASO-1", documentos: 2, excluidos: ["el cliente indica que no hace falta traducirlo"] });
  const text = lines.join("\n");
  assert.match(text, /CASO-1.*2 documento/);
  assert.match(text, /¿Apostilla\?: Sí/);
  assert.match(text, /«en papel»/);
  assert.match(text, /1 documento\(s\) fuera del presupuesto/);
  assert.match(text, /2 idiomas de destino/);
  assert.match(text, /regularización 2026/);
  assert.match(text, /zona-traductor\/casos\/c1/);
});

test("routing pair: the entrada's languages, else the only one the reading found; never a guess", () => {
  const docs = (...l: string[]) => ({ documents: l.map((s) => ({ included: true, sourceLang: s })), targetLang: "es" });
  assert.deepEqual(routingPair(fila(), null), { sourceLang: "pt", targetLang: "es" });
  assert.deepEqual(routingPair(fila({ sourceLang: null }), docs("de", "de")), { sourceLang: "de", targetLang: "es" });
  assert.equal(routingPair(fila({ sourceLang: null }), docs("de", "nl")), null);
  assert.equal(routingPair(fila({ sourceLang: null }), docs("unknown")), null);
  assert.equal(routingPair(fila({ sourceLang: "es", targetLangs: ["es"], targetLang: "es" }), null), null);
});

test("ack in the entrada language (es/fr/en/de/pt); es and fr are the texts of always", () => {
  assert.deepEqual(["fr", "en", "de", "pt", "it", null].map(ackLangOf), ["fr", "en", "de", "pt", "es", "es"]);
  const es = priceRequestAckText("es", { name: "Ana", askDeadline: true, reviews: 12 });
  assert.equal(es.subject, "Tu solicitud está en marcha — traduccionesjuradas.net");
  assert.match(es.body, /^Hola Ana,\nHemos recibido tu solicitud de presupuesto y ya está en marcha: un traductor jurado nombrado por el MAEC está estudiando/);
  assert.match(es.body, /¿Tienes una fecha límite\?/);
  assert.match(es.body, /Traductor jurado MAEC nº 3850 · 12 reseñas en Google$/);
  assert.match(priceRequestAckText("fr", { translatorLangName: "Alemán" }).body, /traducteur assermenté \(alemán\)/);
  for (const [l, re] of [["en", /^Hello,/], ["de", /^Guten Tag,/], ["pt", /^Olá,/]] as const) {
    const t = priceRequestAckText(l, { recurrent: true });
    assert.match(t.body, re);
    assert.doesNotMatch(t.body, /Hola|traductor jurado de/);
  }
});

test("cleanup: entrada files stay while the caso has a live quote or an unfinished order, and go 30 days after delivery", () => {
  const th = new Date("2026-10-22T00:00:00Z");
  const q = (status: string, o: Record<string, unknown> = {}) => ({ status, deletedAt: null, lostReason: null, ...o }) as never;
  assert.equal(isEntradaSession("entrada:x"), true);
  assert.equal(isEntradaSession("puerta-tok"), false);
  assert.equal(keepEntradaFiles(null, th), false);
  assert.equal(keepEntradaFiles({ quotes: [q("SENT")], orders: [] }, th), true);
  assert.equal(keepEntradaFiles({ quotes: [q("EXPIRED"), q("SENT", { deletedAt: new Date() })], orders: [] }, th), false);
  assert.equal(keepEntradaFiles({ quotes: [], orders: [{ status: "IN_PROGRESS", updatedAt: new Date("2026-01-01") }] }, th), true);
  assert.equal(keepEntradaFiles({ quotes: [], orders: [{ status: "DELIVERED", updatedAt: new Date("2026-10-30") }] }, th), true);
  assert.equal(keepEntradaFiles({ quotes: [], orders: [{ status: "DELIVERED", updatedAt: new Date("2026-10-01") }] }, th), false);
  assert.equal(keepEntradaFiles({ quotes: [], orders: [{ status: "CANCELLED", updatedAt: new Date("2026-10-30") }] }, th), false);
});

test("reminder: verified email + files + not confirmed after 2 h, once, not for staff nor for whoever already finished; 8-22 h Madrid", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const base: EntradaAMedias = { id: "e1", estado: "leida", canal: "web", email: "Ana@x.com", emailVerifiedAt: now, marketingConsentAt: now, updatedAt: new Date(now.getTime() - 3 * 36e5), files: 2 };
  const skip = { done: new Set<string>(), finished: new Set<string>(), staff: (m: string) => m.endsWith("@traduccionesjuradas.net") };
  const sel = (o: Partial<EntradaAMedias>, s = skip) => selectRecordatorios([{ ...base, ...o }], now, s).length;
  assert.equal(sel({}), 1);
  assert.equal(sel({ updatedAt: new Date(now.getTime() - 60 * 60e3) }), 0, "less than 2 h");
  assert.equal(sel({ updatedAt: new Date(now.getTime() - 3 * 864e5) }), 0, "too old");
  assert.equal(sel({ estado: "confirmada" }), 0);
  assert.equal(sel({ emailVerifiedAt: null }), 0);
  assert.equal(sel({ marketingConsentAt: null }), 0);
  assert.equal(sel({ files: 0 }), 0);
  assert.equal(sel({ canal: "whatsapp" }), 0);
  assert.equal(sel({ email: "juan@traduccionesjuradas.net" }), 0);
  assert.equal(sel({}, { ...skip, done: new Set(["e1"]) }), 0, "once");
  assert.equal(sel({}, { ...skip, finished: new Set(["ana@x.com"]) }), 0, "confirmed another entrada or has a quote");
  assert.equal(madridHour(new Date("2026-11-21T06:30:00Z")), 7);
  assert.equal(recordatorioHourOk(new Date("2026-11-21T06:30:00Z")), false);
  assert.equal(recordatorioHourOk(new Date("2026-11-21T07:00:00Z")), true);
  assert.equal(recordatorioHourOk(new Date("2026-11-21T21:00:00Z")), false);
  assert.match(recordatorioEmail("de", "https://x").text, /Mein Angebot anfordern/);
  assert.match(recordatorioEmail("xx", "https://x").subject, /Tus documentos/);
});

const frFiles = [{ position: 1, name: "acta.pdf", url: "https://x.public.blob.vercel-storage.com/acta.pdf", pageCount: 1 }];
function frData(docs = [working("D1", [[1, 1]])]): FrAutoData {
  return { lote: { id: "L1", status: "ok", clean: true, reasons: [], targetLang: "es", sessionKey: sessionKeyOf("e1"), quoteId: null, updatedAt: new Date() } as never, files: frFiles as never, documents: docs };
}
async function frPayload(source: string | null, docs?: ReturnType<typeof working>[]) {
  let payload: QuotePayload | null = null;
  const io: FrAutoIO = {
    mode: () => "draft",
    liveBlock: async () => null,
    claim: async () => true,
    createDraft: async (_e, p) => ((payload = p), { quoteId: "q", quoteNumber: "2026-1", netEur: 1, totalEur: 1, decision: { action: "send" } }),
    link: async () => {},
    send: async () => {},
    staff: async () => {},
  };
  const e = { ...fila({ sourceLang: "fr", targetLangs: ["es"], source }), emailVerifiedAt: new Date(), marketingConsentAt: new Date() } as EntradaRow;
  await runFrAuto(io, e, frData(docs));
  return payload as QuotePayload | null;
}

test("?p=regularizacion-2026 reaches the quote: 25 € per FR document up to 2 pages, labelled; the Bulletin n°3 keeps its price", async () => {
  const normal = await frPayload(null);
  const regu = await frPayload("regularizacion-2026");
  assert.notEqual(normal!.lines[0].unitPrice, "25.00");
  assert.equal(regu!.lines[0].unitPrice, "25.00");
  assert.match(regu!.lines[0].description, /\(regularización 2026\)$/);
  const penal = await frPayload("regularizacion-2026", [working("D1", [[1, 1], [1, 2], [1, 3]], { type: "criminal_record" })]);
  assert.equal(penal!.lines[0].unitPrice, "61.98");
  assert.doesNotMatch(penal!.lines[0].description, /regularización/);
  assert.equal(buildLines([working("D1", [[1, 1]])], frFiles as never, "es").lines[0].priceSource, "fr_tariff", "without the flag nothing changes");
});
