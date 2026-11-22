import test from "node:test";
import assert from "node:assert/strict";
import {
  informeHourOk,
  informeOn,
  itemState,
  newStates,
  renderInforme,
  selectClientesAMedias,
  smsWorthy,
  type EntradaInforme,
  type InformeInput,
  type PuertaDocRow,
} from "../../lib/clientes-a-medias-core.ts";
import { clientDraft, mailtoDraft, noPresupuestable } from "../../lib/no-presupuestable.ts";

const NOW = new Date("2026-11-21T11:00:00Z"); // 12:00 Madrid
const ago = (min: number) => new Date(NOW.getTime() - min * 60000);
const doc = (o: Partial<PuertaDocRow> = {}): PuertaDocRow => ({
  sessionToken: "S1", createdAt: ago(70), clientEmail: "ana@x.com", clientName: "Ana", clientPhone: null, sourceLanguage: "en", targetLanguage: "es",
  estimatedWords: 300, quoteAmount: 45, status: "QUOTE_GENERATED", casoId: null, fileHash: "h1", ...o,
});
const ent = (o: Partial<EntradaInforme> = {}): EntradaInforme => ({
  id: "E1", estado: "abierta", createdAt: ago(40), email: "luis@x.com", emailVerified: true, phone9: null, nombre: "Luis", sourceLang: "de", targetLang: "es", casoId: "C1", files: 2, leida: false, fileHash: "h9", ...o,
});
const run = (o: Partial<InformeInput>) => selectClientesAMedias({ now: NOW, docs: [], entradas: [], quotes: [], paidOrders: [], ...o });

test("flag: solo «on» exacto lo enciende (apagado = hoy)", () => {
  assert.equal(informeOn({}), false);
  assert.equal(informeOn({ CLIENTES_A_MEDIAS_INFORME: "ON" }), false);
  assert.equal(informeOn({ CLIENTES_A_MEDIAS_INFORME: "1" }), false);
  assert.equal(informeOn({ CLIENTES_A_MEDIAS_INFORME: "on" }), true);
});

test("franja 08-21 Madrid con cron en UTC, invierno y verano", () => {
  assert.equal(informeHourOk(new Date("2026-11-21T06:00:00Z")), false, "07:00 invierno");
  assert.equal(informeHourOk(new Date("2026-11-21T07:00:00Z")), true, "08:00 invierno");
  assert.equal(informeHourOk(new Date("2026-11-21T20:00:00Z")), true, "21:00 invierno");
  assert.equal(informeHourOk(new Date("2026-07-01T06:00:00Z")), true, "08:00 verano");
  assert.equal(informeHourOk(new Date("2026-07-01T20:00:00Z")), false, "22:00 verano");
});

test("sesión y entrada sin presupuesto: llegada, progreso, minutos que quedan y enlace", () => {
  const out = run({ docs: [doc()], entradas: [ent()], lecturaOn: true });
  assert.equal(out.length, 2);
  const s = out.find((i) => i.kind === "puerta")!;
  assert.equal(s.minutes, 70);
  assert.equal(s.minutesLeft, 110);
  assert.equal(s.words, 300);
  assert.equal(s.price, 45);
  assert.match(s.link, /presupuesto\?session=S1$/);
  const e = out.find((i) => i.kind === "entrada")!;
  assert.match(e.link, /lectura\?caso=C1$/);
  assert.equal(e.files, 2);
});

test("entrada sin LECTURA_CONSTRUCTOR: el enlace cae al constructor, no a /lectura (404)", () => {
  const e = run({ entradas: [ent()], lecturaOn: false }).find((i) => i.kind === "entrada")!;
  assert.match(e.link, /zona-traductor\/presupuesto\?session=entrada%3A/);
  assert.doesNotMatch(e.link, /lectura/);
});

test("ventana de 6 h; staff, prueba y entradas «prueba» fuera", () => {
  assert.equal(run({ docs: [doc({ createdAt: ago(6 * 60 + 1) })] }).length, 0);
  assert.equal(run({ docs: [doc({ clientEmail: "x@yopmail.com" })] }).length, 0);
  assert.equal(run({ docs: [doc({ clientEmail: "hola@traduccionesjuradas.net" })], staffEmails: ["hola@traduccionesjuradas.net"] }).length, 0);
  assert.equal(run({ entradas: [ent({ estado: "prueba" })] }).length, 0);
});

test("presupuesto enviado o pedido pagado lo sacan; un borrador se muestra (y si está retenido, por qué)", () => {
  const q = (o = {}) => ({ id: "Q1", quoteNumber: "2026-0100", sentAt: null as Date | null, createdAt: ago(10), customerEmail: "ana@x.com", expedienteRef: "puerta:S1", casoId: null, ...o });
  assert.equal(run({ docs: [doc()], quotes: [q({ sentAt: ago(5) })] }).length, 0);
  assert.equal(run({ docs: [doc()], paidOrders: [{ clientEmail: "ana@x.com", clientPhone: null, paidAt: ago(20) }] }).length, 0);
  const d = run({ docs: [doc()], quotes: [q()], held: [{ quoteId: "Q1", quoteNumber: "2026-0100", reasons: ["margen bajo"] }] })[0];
  assert.deepEqual(d.draft, { id: "Q1", quoteNumber: "2026-0100", held: ["margen bajo"], autoAt: null, retener: null });
  assert.equal(run({ entradas: [ent()], quotes: [q({ expedienteRef: null, customerEmail: "otro@x.com", casoId: "C1", sentAt: ago(1) })] }).length, 0, "por caso");
});

test("sesión sin email (abandono antes del email) también aparece", () => {
  const out = run({ entradas: [ent({ email: null, emailVerified: false })] });
  assert.equal(out.length, 1);
  assert.equal(out[0].email, null);
});

test("no presupuestables: par desconocido, 0 palabras, sin jurado, sin documentos", () => {
  assert.equal(run({ docs: [doc({ targetLanguage: "unknown" })] })[0].noPresupuestable?.code, "par_desconocido");
  assert.equal(run({ docs: [doc({ estimatedWords: 0 })] })[0].noPresupuestable?.code, "sin_palabras");
  assert.equal(run({ docs: [doc({ estimatedWords: 0, status: "ANALYZING" })] })[0].noPresupuestable, null, "aún analizando: no");
  assert.equal(run({ docs: [doc({ sourceLanguage: "ru" })] })[0].noPresupuestable?.code, "sin_jurado");
  assert.equal(run({ entradas: [ent({ estado: "sin_jurado", sourceLang: "el" })] })[0].noPresupuestable?.code, "sin_jurado");
  assert.equal(run({ entradas: [ent({ files: 0 })] })[0].noPresupuestable?.code, "sin_documentos");
  for (const l of ["el", "ru", "uk", "pl", "zh", "sv"]) assert.equal(noPresupuestable({ sourceLanguage: l, targetLanguage: "es" })?.code, "sin_jurado");
  assert.equal(noPresupuestable({ sourceLanguage: "es", targetLanguage: "sv" })?.code, "sin_jurado");
  assert.equal(noPresupuestable({ sourceLanguage: "en", targetLanguage: "es", estimatedWords: 200, analyzed: true }), null);
});

test("borrador al cliente: pide el dato que falta y la fecha; mailto solo con email real", () => {
  const d = clientDraft({ code: "par_desconocido", falta: "" }, "Ana María");
  assert.match(d.body, /^Hola Ana:/);
  assert.match(d.body, /idioma/);
  assert.match(d.body, /fecha/);
  assert.equal(mailtoDraft("123@whatsapp.local", d), null);
  assert.match(mailtoDraft("ana@x.com", d)!, /^mailto:ana%40x\.com\?subject=/);
});

test("solo informa si hay algo nuevo: mismo estado no repite, pasar de fase sí", () => {
  const a = run({ docs: [doc({ createdAt: ago(70) })] });
  const sent = a.map(itemState);
  assert.deepEqual(newStates(a, sent), []);
  const later = selectClientesAMedias({ now: new Date(NOW.getTime() + 90 * 60000), docs: [doc({ createdAt: ago(70) })], entradas: [], quotes: [], paidOrders: [] });
  assert.equal(newStates(later, sent).length, 1, "a las 2,5 h vuelve a contar");
  assert.equal(newStates([], sent).length, 0, "nada pendiente: no se envía");
});

test("render: contador del día, sección aparte de no presupuestables y SMS corto", () => {
  const items = run({ docs: [doc(), doc({ sessionToken: "S2", sourceLanguage: "pl", clientEmail: "p@x.com" })] });
  const r = renderInforme(items, { entradas: 5, leads: 3, subidasSinEmail: 1, enviados: 2, pagados: 0 }, new Set(items.map(itemState)));
  assert.match(r.html, /Hoy:<\/b> 5 entradas/);
  assert.match(r.html, /No presupuestables: 1/);
  assert.match(r.html, /Borrador al cliente \(no enviado\)/);
  assert.match(r.html, /Hacer presupuesto/);
  assert.match(r.html, /quedan 110 min/);
  assert.ok(r.sms.length <= 300);
  assert.match(r.subject, /1 sin presupuesto · 1 no presupuestable/);
});

test("AUTOENVIO_150: el borrador que saldría solo dice la hora y trae «Retener»; retenido, no", () => {
  const q = { id: "Q1", quoteNumber: "2026-0100", sentAt: null, createdAt: ago(30), customerEmail: "ana@x.com", expedienteRef: "puerta:S1", casoId: null, adminCreatedBy: "system:tarifario", sourceLang: "en", targetLang: "es" };
  const it = run({ docs: [doc()], quotes: [q], autoenvioOn: true, retenerUrl: (id) => `https://x/retener?q=${id}` })[0];
  assert.equal(it.draft!.autoAt!.getTime(), ago(-80).getTime(), "max(llegada+150, borrador+60)");
  const html = renderInforme([it], { entradas: 1, leads: 1, subidasSinEmail: 0, enviados: 0, pagados: 0 }, new Set()).html;
  assert.match(html, /saldrá solo a las \d\d:\d\d si no lo retienes/);
  assert.match(html, /retener\?q=Q1/);
  assert.equal(run({ docs: [doc()], quotes: [q], autoenvioOn: false })[0].draft!.autoAt, null, "flag apagado");
  assert.equal(run({ docs: [doc()], quotes: [q], autoenvioOn: true, held: [{ quoteId: "Q1", quoteNumber: "", reasons: ["retenido por Juan"] }] })[0].draft!.autoAt, null);
  assert.equal(run({ docs: [doc()], quotes: [{ ...q, sourceLang: "fr" }], autoenvioOn: true })[0].draft!.autoAt, null, "francés: no");
});

test("SMS del informe solo con un estado nuevo «3h» o «np»; con lead-sla v2 solo los anónimos", () => {
  const fresh = (items: ReturnType<typeof run>) => items.map(itemState);
  const normal = run({ docs: [doc()] });
  assert.equal(smsWorthy(normal, fresh(normal), false), false, "1 h: solo email");
  const late = run({ docs: [doc({ createdAt: ago(185) })] });
  assert.equal(smsWorthy(late, fresh(late), false), true);
  assert.equal(smsWorthy(late, [], false), false, "ya contado: no repite");
  assert.equal(smsWorthy(late, fresh(late), true), false, "lead-sla v2 ya manda su SMS de 3 h");
  const np = run({ entradas: [ent({ files: 0, email: null, emailVerified: false })] });
  assert.equal(smsWorthy(np, fresh(np), true), true, "anónimo no presupuestable");
});
