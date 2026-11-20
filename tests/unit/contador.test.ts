import test from "node:test";
import assert from "node:assert/strict";
import {
  GIVE_UP_MS,
  applyCounterToAnalysis,
  contadorClient,
  contadorConfig,
  cronAction,
  quoteImpact,
  sanitizeJob,
  shouldCount,
  signCallback,
  verifyCallback,
  type ContadorJob,
  type FetchLike,
  type QuoteRef,
} from "../../lib/contador/core.ts";
import { processJobUpdate, runContadorCron, submitForDocument, type ContadorDeps, type ContadorRepo, type TrabajoRow } from "../../lib/contador/flow.ts";

const ENV = { CONTADOR_TRADUCAT: "on", CONTADOR_URL: "https://contador.test/v1/", CONTADOR_TOKEN: "tok", CONTADOR_HMAC_SECRET: "sec" };
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

function job(over: Partial<ContadorJob> = {}): ContadorJob {
  return {
    id: "job1",
    estado: "hecho",
    paginas_hechas: 6,
    paginas_total: 6,
    palabras_total: 1200,
    palabras_por_pagina: [200, 200, 200, 200, 200, 200],
    paginas_sin_texto: [],
    idioma_detectado: "fr",
    motivo_error: null,
    referencia: "doc1",
    ...over,
  };
}

function analysis(words = 1000, over: Record<string, unknown> = {}) {
  return {
    document_metrics: { pages: 6, estimated_words: words, words_basis: "transcribed_partial", ...over },
    price_risk: { risky: true, reasons: ["oversized_estimate", "scan_not_fully_counted"] },
    builderRun: { mode: "vision" },
  };
}

function trabajo(over: Partial<TrabajoRow> = {}): TrabajoRow {
  return {
    id: "t1",
    documentAnalysisId: "doc1",
    jobId: "job1",
    estado: "contando",
    intentos: 1,
    paginasHechas: 0,
    paginasTotal: 6,
    palabrasTotal: null,
    palabrasPorPagina: [],
    paginasSinTexto: [],
    palabrasHaiku: 1000,
    aplicadoAt: null,
    abandonadoAt: null,
    avisoJson: null,
    createdAt: new Date(NOW - 60_000),
    updatedAt: new Date(NOW - 60_000),
    ...over,
  };
}

function fakeDeps(opts: { quotes?: QuoteRef[]; analysisJson?: any; client?: ContadorDeps["client"]; trabajos?: TrabajoRow[] } = {}) {
  const trabajos = new Map<string, TrabajoRow>((opts.trabajos || []).map((t) => [t.id, { ...t }]));
  const doc = { id: "doc1", fileUrl: "https://blob.test/a.pdf", analysisJson: opts.analysisJson ?? analysis(), orderId: null as string | null, estimatedWords: 1000 };
  const calls: string[] = [];
  const alerts: any[] = [];
  const repo: ContadorRepo = {
    async findTrabajoByDoc(id) { calls.push("findTrabajoByDoc"); return [...trabajos.values()].find((t) => t.documentAnalysisId === id) ?? null; },
    async findTrabajoByJobId(jobId) { return [...trabajos.values()].find((t) => t.jobId === jobId) ?? null; },
    async createTrabajo(data) {
      calls.push("createTrabajo");
      const t = trabajo({ ...data, id: `t${trabajos.size + 1}`, jobId: null, estado: "pendiente_envio", intentos: 0 });
      trabajos.set(t.id, t);
      return t;
    },
    async updateTrabajo(id, data) { calls.push("updateTrabajo"); Object.assign(trabajos.get(id)!, data); },
    async listPending() { return [...trabajos.values()].filter((t) => !t.aplicadoAt && ["pendiente_envio", "en_cola", "contando"].includes(t.estado)); },
    async loadDoc() { return doc; },
    async quotesForFile() { return opts.quotes ?? []; },
    async orderRef() { return null; },
    async applyAtomically(tid, data, _docId, json, words) {
      const t = trabajos.get(tid)!;
      if (t.aplicadoAt) return false;
      Object.assign(t, data);
      doc.analysisJson = json;
      doc.estimatedWords = words;
      return true;
    },
    async saveDocAnalysis(_id, json, words) { doc.analysisJson = json; doc.estimatedWords = words; },
  };
  const deps: ContadorDeps = {
    client: opts.client === undefined ? null : opts.client,
    repo,
    alertStaff: async (m) => { alerts.push(m); },
    now: () => NOW,
    log: () => {},
  };
  return { deps, trabajos, doc, calls, alerts };
}

const scanDoc = { id: "doc1", fileUrl: "https://blob.test/a.pdf", mimeType: "application/pdf", mode: "vision", pageCount: 6, analysisJson: analysis() };

/* ---------- flag ---------- */

test("flag: solo 'on' exacto con las tres variables activa el contador", () => {
  assert.ok(contadorConfig(ENV));
  assert.equal(contadorConfig(ENV)!.url, "https://contador.test/v1");
  for (const v of ["ON", "true", "1", " on", "", undefined]) assert.equal(contadorConfig({ ...ENV, CONTADOR_TRADUCAT: v }), null);
  assert.equal(contadorConfig({ ...ENV, CONTADOR_HMAC_SECRET: "" }), null);
  assert.equal(contadorConfig({ ...ENV, CONTADOR_TOKEN: undefined }), null);
});

test("flag apagado: ninguna llamada al contador ni a la BD", async () => {
  let fetches = 0;
  const fetchSpy: FetchLike = async () => { fetches++; return { status: 202, json: async () => ({ id: "x", estado: "en_cola" }) }; };
  const cfg = contadorConfig({ ...ENV, CONTADOR_TRADUCAT: "off" });
  const f = fakeDeps({ client: cfg ? contadorClient(cfg, fetchSpy) : null });
  const r = await submitForDocument(f.deps, scanDoc);
  assert.deepEqual(r, { submitted: false, reason: "inactivo" });
  assert.equal(fetches, 0);
  assert.deepEqual(f.calls, []);
  const cron = await runContadorCron(f.deps);
  assert.equal(cron.revisados, 0);
});

test("shouldCount: solo PDF por visión con más de 5 páginas", () => {
  assert.equal(shouldCount({ mimeType: "application/pdf", mode: "vision", pageCount: 6 }), true);
  assert.equal(shouldCount({ mimeType: "application/pdf", mode: "vision", pageCount: 5 }), false);
  assert.equal(shouldCount({ mimeType: "application/pdf", mode: "text", pageCount: 20 }), false);
  assert.equal(shouldCount({ mimeType: "image/jpeg", mode: "vision", pageCount: 20 }), false);
});

/* ---------- firma ---------- */

test("firma: buena, mala, caducada, futura y ausente", () => {
  const body = JSON.stringify(job());
  const ts = String(Math.floor(NOW / 1000));
  const sig = signCallback("sec", ts, body);
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
  assert.deepEqual(verifyCallback({ secret: "sec", timestamp: ts, signature: sig, rawBody: body, now: NOW }), { ok: true });
  assert.equal(verifyCallback({ secret: "otro", timestamp: ts, signature: sig, rawBody: body, now: NOW }).ok, false);
  assert.equal(verifyCallback({ secret: "sec", timestamp: ts, signature: sig, rawBody: body + " ", now: NOW }).ok, false);
  const old = String(Math.floor((NOW - 6 * 60_000) / 1000));
  assert.deepEqual(verifyCallback({ secret: "sec", timestamp: old, signature: signCallback("sec", old, body), rawBody: body, now: NOW }), { ok: false, reason: "caducada" });
  const fut = String(Math.floor((NOW + 6 * 60_000) / 1000));
  assert.deepEqual(verifyCallback({ secret: "sec", timestamp: fut, signature: signCallback("sec", fut, body), rawBody: body, now: NOW }), { ok: false, reason: "caducada" });
  assert.deepEqual(verifyCallback({ secret: "sec", timestamp: null, signature: sig, rawBody: body, now: NOW }), { ok: false, reason: "sin_firma" });
  assert.deepEqual(verifyCallback({ secret: "sec", timestamp: "abc", signature: sig, rawBody: body, now: NOW }), { ok: false, reason: "marca_invalida" });
  const tsMs = String(NOW);
  assert.deepEqual(verifyCallback({ secret: "sec", timestamp: tsMs, signature: signCallback("sec", tsMs, body), rawBody: body, now: NOW }), { ok: true });
});

test("sanitizeJob: solo cifras, nunca texto", () => {
  const j = sanitizeJob({ ...job(), palabras_por_pagina: [10, "hola", -3, 4.6], texto: "secreto", paginas_texto: ["a"] })!;
  assert.deepEqual(j.palabras_por_pagina, [10, 0, 0, 5]);
  assert.equal((j as any).texto, undefined);
  assert.equal(sanitizeJob({ id: "x", estado: "raro" }), null);
});

/* ---------- envío ---------- */

test("errores al enviar no rompen el análisis", async () => {
  const cfg = contadorConfig(ENV)!;
  // 429 cola llena → se queda pendiente para el cron
  const f429 = fakeDeps({ client: contadorClient(cfg, async () => ({ status: 429, json: async () => ({}) })) });
  assert.deepEqual(await submitForDocument(f429.deps, scanDoc), { submitted: true });
  const t = [...f429.trabajos.values()][0];
  assert.equal(t.estado, "pendiente_envio");
  assert.equal((t as any).ultimoError, "HTTP 429");
  // red caída
  const fNet = fakeDeps({ client: contadorClient(cfg, async () => { throw new Error("ECONNREFUSED"); }) });
  assert.equal((await submitForDocument(fNet.deps, scanDoc)).submitted, true);
  assert.equal([...fNet.trabajos.values()][0].estado, "pendiente_envio");
  // 413 → error definitivo, sin reintento
  const f413 = fakeDeps({ client: contadorClient(cfg, async () => ({ status: 413, json: async () => ({}) })) });
  await submitForDocument(f413.deps, scanDoc);
  assert.equal([...f413.trabajos.values()][0].estado, "error");
  // la BD lanza → resuelve igual
  const fDb = fakeDeps({ client: contadorClient(cfg, async () => ({ status: 202, json: async () => ({ id: "j", estado: "en_cola" }) })) });
  fDb.deps.repo.createTrabajo = async () => { throw new Error("db caída"); };
  assert.deepEqual(await submitForDocument(fDb.deps, scanDoc), { submitted: false, reason: "error" });
});

test("timeout del envío: el cliente corta y devuelve reintento", async () => {
  const cfg = contadorConfig(ENV)!;
  const hang: FetchLike = (_u, init) =>
    new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("abort"), { name: "AbortError" }))));
  const t0 = Date.now();
  const r = await contadorClient(cfg, hang, 50).submit({ url: "https://blob.test/a.pdf", referencia: "doc1" });
  assert.deepEqual(r, { ok: false, retry: true, error: "timeout" });
  assert.ok(Date.now() - t0 < 1000);
});

test("envío correcto: guarda el id del trabajo y manda referencia + callback", async () => {
  let sent: any;
  const cfg = contadorConfig(ENV)!;
  const f = fakeDeps({
    client: contadorClient(cfg, async (url, init) => {
      sent = { url, body: JSON.parse(init.body), auth: init.headers.Authorization };
      return { status: 202, json: async () => ({ id: "job9", estado: "en_cola" }) };
    }),
  });
  await submitForDocument(f.deps, scanDoc);
  assert.equal(sent.url, "https://contador.test/v1/trabajos");
  assert.equal(sent.auth, "Bearer tok");
  assert.equal(sent.body.referencia, "doc1");
  assert.equal(sent.body.callback_url, "https://www.traduccionesjuradas.net/api/contador/resultado");
  const t = [...f.trabajos.values()][0];
  assert.equal(t.jobId, "job9");
  assert.equal(t.estado, "en_cola");
  assert.deepEqual(await submitForDocument(f.deps, scanDoc), { submitted: false, reason: "existente" });
});

/* ---------- cron ---------- */

test("cron: se rinde a los 10 min y deja la cifra de Haiku", async () => {
  assert.equal(cronAction({ estado: "contando", jobId: "j", createdAt: new Date(NOW - GIVE_UP_MS - 1), aplicadoAt: null }, NOW), "abandonar");
  assert.equal(cronAction({ estado: "contando", jobId: "j", createdAt: new Date(NOW - 60_000), aplicadoAt: null }, NOW), "consultar");
  assert.equal(cronAction({ estado: "pendiente_envio", jobId: null, createdAt: new Date(NOW - 60_000), aplicadoAt: null }, NOW), "enviar");
  assert.equal(cronAction({ estado: "hecho", jobId: "j", createdAt: new Date(NOW - 60_000), aplicadoAt: new Date() }, NOW), "nada");

  const getJobCalls: string[] = [];
  const client = { submit: async () => ({ ok: true as const, id: "x", estado: "en_cola" as const }), getJob: async (id: string) => { getJobCalls.push(id); return null; } };
  const f = fakeDeps({ client, trabajos: [trabajo({ createdAt: new Date(NOW - GIVE_UP_MS - 5_000) })] });
  const r = await runContadorCron(f.deps);
  assert.equal(r.abandonados, 1);
  assert.equal(getJobCalls.length, 0);
  assert.equal(f.trabajos.get("t1")!.estado, "abandonado");
  assert.equal(f.doc.analysisJson.document_metrics.words_basis, "transcribed_partial");
  assert.equal(f.doc.analysisJson.document_metrics.estimated_words, 1000);
});

test("cron: estado error del contador → se rinde y no toca el análisis", async () => {
  const client = { submit: async () => ({ ok: true as const, id: "x", estado: "en_cola" as const }), getJob: async () => job({ estado: "error", motivo_error: "pdf roto", paginas_hechas: 2 }) };
  const f = fakeDeps({ client, trabajos: [trabajo()] });
  await runContadorCron(f.deps);
  const t = f.trabajos.get("t1")!;
  assert.equal(t.estado, "error");
  assert.ok(t.abandonadoAt);
  assert.equal(f.doc.analysisJson.document_metrics.words_basis, "transcribed_partial");
});

test("cron: consulta, aplica la cifra y respeta el tope por pasada", async () => {
  const ts = Array.from({ length: 5 }, (_, i) => trabajo({ id: `t${i}`, documentAnalysisId: `d${i}`, jobId: `j${i}` }));
  const client = { submit: async () => ({ ok: true as const, id: "x", estado: "en_cola" as const }), getJob: async () => job({ estado: "contando", paginas_hechas: 3 }) };
  const f = fakeDeps({ client, trabajos: ts });
  f.deps.repo.listPending = async (limit) => ts.slice(0, limit);
  const r = await runContadorCron(f.deps, { limit: 2 });
  assert.equal(r.consultados, 2);
  assert.equal(f.trabajos.get("t0")!.paginasHechas, 3);
});

/* ---------- aplicar ---------- */

test("applyCounterToAnalysis: cifra del contador manda, Haiku queda para auditoría y se quita scan_not_fully_counted", () => {
  const out = applyCounterToAnalysis(analysis(1000), job());
  assert.ok(out.applied);
  if (!out.applied) return;
  const m = out.json.document_metrics;
  assert.equal(m.estimated_words, 1200);
  assert.equal(m.words_basis, "contador_traducat");
  assert.equal(m.words_haiku, 1000);
  assert.equal(m.words_haiku_basis, "transcribed_partial");
  assert.deepEqual(out.json.price_risk.reasons, ["oversized_estimate"]);
  assert.deepEqual(out.json.builderRun, { mode: "vision" });
  // segunda aplicación sobre lo ya aplicado conserva la cifra original de Haiku
  const again = applyCounterToAnalysis(out.json, job());
  assert.ok(again.applied && again.haikuWords === 1000);
});

test("applyCounterToAnalysis: bilingüe a la mitad; incompleto o segmentado no se aplica", () => {
  const bil = applyCounterToAnalysis(analysis(500, { is_bilingual_duplicate: true }), job());
  assert.ok(bil.applied && bil.counterWords === 600);
  assert.deepEqual(applyCounterToAnalysis(analysis(), job({ paginas_hechas: 5 })), { applied: false, reason: "conteo_incompleto" });
  assert.deepEqual(applyCounterToAnalysis(analysis(), job({ estado: "contando" })), { applied: false, reason: "conteo_incompleto" });
  assert.deepEqual(applyCounterToAnalysis({ segmented: true, documents: [] }, job()), { applied: false, reason: "analisis_no_aplicable" });
  assert.deepEqual(applyCounterToAnalysis(analysis(1000, { pages: 7 }), job()), { applied: false, reason: "paginas_no_cuadran" });
});

test("quoteImpact: umbral del 5 %", () => {
  const qs: QuoteRef[] = [{ id: "q1", quoteNumber: "2026-1", status: "SENT" }, { id: "q2", quoteNumber: "2026-2", status: "DRAFT" }, { id: "q3", quoteNumber: "2026-3", status: "EXPIRED" }];
  assert.equal(quoteImpact(1000, 1050, qs).differs, false);
  const i = quoteImpact(1000, 1060, qs);
  assert.equal(i.differs, true);
  assert.deepEqual(i.alertQuotes.map((q) => q.id), ["q1"]);
  assert.deepEqual(i.draftQuotes.map((q) => q.id), ["q2"]);
});

test(">5 % sobre presupuesto ENVIADO: aviso con las dos cifras, el presupuesto no se toca", async () => {
  const quotes: QuoteRef[] = [{ id: "q1", quoteNumber: "2026-00400", status: "SENT" }];
  const f = fakeDeps({ quotes, trabajos: [trabajo()] });
  const r = await processJobUpdate(f.deps, f.trabajos.get("t1")!, job());
  assert.equal(r, "aplicado");
  assert.equal(f.alerts.length, 1);
  assert.match(f.alerts[0].text, /1200/);
  assert.match(f.alerts[0].text, /1000/);
  assert.match(f.alerts[0].text, /NO se ha cambiado/);
  assert.match(f.alerts[0].sms, /2026-00400/);
  assert.ok(!("updateQuote" in f.deps.repo));
  assert.deepEqual((f.trabajos.get("t1") as any).avisoQuoteIds, ["q1"]);
  assert.equal(f.doc.estimatedWords, 1200);
});

test(">5 % solo en BORRADOR: se anota sin aviso; ≤5 % ni aviso ni anotación", async () => {
  const f = fakeDeps({ quotes: [{ id: "q2", quoteNumber: "2026-00401", status: "DRAFT" }], trabajos: [trabajo()] });
  await processJobUpdate(f.deps, f.trabajos.get("t1")!, job());
  assert.equal(f.alerts.length, 0);
  assert.deepEqual((f.trabajos.get("t1") as any).avisoQuoteIds, ["q2"]);
  assert.equal(f.trabajos.get("t1")!.avisoJson.differs, true);

  const g = fakeDeps({ analysisJson: analysis(1180), quotes: [{ id: "q1", quoteNumber: "x", status: "SENT" }], trabajos: [trabajo()] });
  await processJobUpdate(g.deps, g.trabajos.get("t1")!, job());
  assert.equal(g.alerts.length, 0);
  assert.deepEqual((g.trabajos.get("t1") as any).avisoQuoteIds, []);
});

test("callback idempotente: dos entregas iguales aplican y avisan una sola vez", async () => {
  const f = fakeDeps({ quotes: [{ id: "q1", quoteNumber: "2026-00400", status: "OPENED" }], trabajos: [trabajo()] });
  const stale = { ...f.trabajos.get("t1")! }; // la segunda petición leyó la fila antes de que la primera aplicara
  assert.equal(await processJobUpdate(f.deps, f.trabajos.get("t1")!, job()), "aplicado");
  assert.equal(await processJobUpdate(f.deps, stale, job()), "ya_aplicado");
  assert.equal(await processJobUpdate(f.deps, f.trabajos.get("t1")!, job()), "ya_aplicado");
  assert.equal(f.alerts.length, 1);
  assert.equal(f.doc.analysisJson.document_metrics.words_haiku, 1000);
});

test("progreso intermedio solo actualiza la fila", async () => {
  const f = fakeDeps({ trabajos: [trabajo()] });
  assert.equal(await processJobUpdate(f.deps, f.trabajos.get("t1")!, job({ estado: "contando", paginas_hechas: 4 })), "actualizado");
  assert.equal(f.trabajos.get("t1")!.paginasHechas, 4);
  assert.equal(f.doc.analysisJson.document_metrics.estimated_words, 1000);
});
