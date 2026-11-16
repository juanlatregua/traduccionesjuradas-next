import test from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = process.env.ORDER_TOKEN_SECRET || "test-secret";
import {
  dedupePuertaRows,
  isRealClientEmail,
  puertaFrAction,
  puertaFrMode,
  puertaSegmentsAreFrEs,
  puertaWaitVerdict,
  segmentsFromPuertaRows,
  type PuertaRow,
} from "../../lib/puerta-fr-math.ts";
import {
  bandejaAction,
  buildWhatsAppAsk,
  isKnownPhone,
  phoneKey,
  priceFrSegments,
  WHATSAPP_SIEMPRE_BORRADOR,
} from "../../lib/agente-bandeja-math.ts";

const NOW = new Date("2026-11-16T12:00:00Z");
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const analysis = (o: { type?: string; src?: string; tgt?: string; pages?: number } = {}) => ({
  document_type: { category: "civil", specific_type: o.type ?? "criminal_record", specific_type_es: "certificado de antecedentes penales", confidence: 0.95 },
  language: { source: o.src ?? "fr", target: o.tgt ?? "es" },
  document_metrics: { estimated_words: 250, pages: o.pages ?? 1, has_tables: false, is_legible: true },
  requirements: { has_apostille: false },
  extracted_data: { names: [] },
});

const row = (o: Partial<PuertaRow> = {}): PuertaRow => ({
  id: "d1",
  fileName: "bulletin.pdf",
  fileUrl: "https://blob/x.pdf",
  mimeType: "application/pdf",
  fileHash: "h1",
  pageCount: 1,
  estimatedWords: 250,
  sourceLanguage: "fr",
  targetLanguage: "es",
  analysisJson: analysis(),
  status: "QUOTE_GENERATED",
  ...o,
});

test("puertaFrMode: off por defecto, solo draft/fr activan", () => {
  assert.equal(puertaFrMode(undefined), "off");
  assert.equal(puertaFrMode(""), "off");
  assert.equal(puertaFrMode("on"), "off");
  assert.equal(puertaFrMode("DRAFT"), "draft");
  assert.equal(puertaFrMode(" fr "), "fr");
});

test("criterio de 60 min: desde la última subida, ventana de 24 h", () => {
  assert.equal(puertaWaitVerdict([minsAgo(59)], NOW), "young");
  assert.equal(puertaWaitVerdict([minsAgo(60)], NOW), "ready");
  assert.equal(puertaWaitVerdict([minsAgo(120), minsAgo(30)], NOW), "young");
  assert.equal(puertaWaitVerdict([minsAgo(25 * 60)], NOW), "stale");
  assert.equal(puertaWaitVerdict([], NOW), "stale");
});

test("email real: ni marcador de WhatsApp ni de prueba", () => {
  assert.equal(isRealClientEmail("ana@gmail.com"), true);
  assert.equal(isRealClientEmail("34600111222@whatsapp.local"), false);
  assert.equal(isRealClientEmail("x@yopmail.com"), false);
  assert.equal(isRealClientEmail("sin-arroba"), false);
});

test("filas de la puerta → segmentos FR→ES con tarifa por documento", () => {
  const r = segmentsFromPuertaRows([row()]);
  assert.ok(r.ok);
  assert.ok(puertaSegmentsAreFrEs(r.segments).ok);
  const p = priceFrSegments(r.segments);
  assert.ok(p.ok);
});

test("análisis sin terminar, sin JSON o sin tipo → no se adapta (borrador)", () => {
  assert.equal(segmentsFromPuertaRows([row({ status: "ANALYZING" })]).ok, false);
  assert.equal(segmentsFromPuertaRows([row({ analysisJson: null })]).ok, false);
  assert.equal(segmentsFromPuertaRows([row({ analysisJson: { foo: 1 } })]).ok, false);
  assert.equal(segmentsFromPuertaRows([]).ok, false);
});

test("par ES→FR o mezclado no pasa por la puerta FR", () => {
  const es = segmentsFromPuertaRows([row({ analysisJson: analysis({ src: "es", tgt: "fr" }) })]);
  assert.ok(es.ok);
  assert.equal(puertaSegmentsAreFrEs(es.segments).ok, false);
  const mixed = segmentsFromPuertaRows([row(), row({ id: "d2", fileHash: "h2", analysisJson: analysis({ src: "en", tgt: "es" }) })]);
  assert.ok(mixed.ok);
  assert.equal(puertaSegmentsAreFrEs(mixed.segments).ok, false);
});

test("más de 2 páginas → sin precio automático", () => {
  const long = segmentsFromPuertaRows([row({ analysisJson: analysis({ pages: 5 }), pageCount: 5 })]);
  assert.ok(long.ok);
  assert.equal(priceFrSegments(long.segments).ok, false);
});

test("duplicados de la misma sesión cuentan una vez", () => {
  const rows = dedupePuertaRows([row(), row({ id: "d2" }), row({ id: "d3", fileHash: "otro" })]);
  assert.equal(rows.length, 2);
});

test("puertaFrAction: todo con tarifa y decisión send, modo fr → send", () => {
  assert.deepEqual(puertaFrAction({ mode: "fr", allTariffed: true, decision: { action: "send" } }), { action: "send" });
});

test("puertaFrAction: cualquier otro caso → borrador; off → skip", () => {
  assert.equal(puertaFrAction({ mode: "fr", allTariffed: false, decision: { action: "send" } }).action, "draft");
  assert.equal(puertaFrAction({ mode: "fr", allTariffed: true, decision: { action: "alert", reasons: ["margen"] } }).action, "draft");
  assert.equal(puertaFrAction({ mode: "fr", allTariffed: true, decision: { action: "skip", reason: "duplicado" } }).action, "draft");
  assert.equal(puertaFrAction({ mode: "draft", allTariffed: true, decision: { action: "send" } }).action, "draft");
  assert.equal(puertaFrAction({ mode: "off", allTariffed: true, decision: { action: "send" } }).action, "skip");
});

test("WhatsApp: nunca send, ni en modo on con decisión en verde", () => {
  for (const mode of ["draft", "fr", "on"] as const) {
    const a = bandejaAction(mode, { action: "send" }, { fr: true, learnedAutosend: true, channel: "WHATSAPP" });
    assert.deepEqual(a, { action: "draft", reasons: [WHATSAPP_SIEMPRE_BORRADOR] });
  }
  assert.equal(bandejaAction("fr", { action: "send" }, { fr: true, learnedAutosend: false, channel: "EMAIL" }).action, "send");
});

test("teléfonos conocidos por los últimos 9 dígitos", () => {
  assert.equal(phoneKey("+34 600 111 222"), "600111222");
  assert.equal(phoneKey("whatsapp:+34951333614"), "951333614");
  const known = new Set(["951333614", "600111222"]);
  assert.equal(isKnownPhone("+34600111222", known), true);
  assert.equal(isKnownPhone("+33612345678", known), false);
  assert.equal(isKnownPhone("", known), false);
});

test("texto de WhatsApp pregunta la fecha en el idioma del cliente", () => {
  assert.match(buildWhatsAppAsk({ lang: "es", name: "Ana" }), /Hola Ana.*¿Para qué fecha/);
  assert.match(buildWhatsAppAsk({ lang: "fr", name: null }), /Pour quelle date/);
  assert.match(buildWhatsAppAsk({ lang: "en", name: null }), /what date/);
});
