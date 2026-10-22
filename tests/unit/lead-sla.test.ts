import test from "node:test";
import assert from "node:assert/strict";
import { dedupeId, selectLeadSla, smsAllowed, stageFor, type SlaDoc, type SlaInbound, type SlaInput, type SlaQuote } from "../../lib/lead-sla-core.ts";

const NOW = new Date("2026-10-22T10:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60000);

const doc = (email: string, minutesAgo: number, extra: Partial<SlaDoc> = {}): SlaDoc => ({
  clientEmail: email, clientName: "Ana", clientPhone: null, sessionToken: `S-${email}`, fileHash: null, fileName: "a.pdf",
  sourceLanguage: "fr", targetLanguage: "es", estimatedWords: 300, quoteAmount: 30, createdAt: ago(minutesAgo), ...extra,
});
const run = (over: Partial<SlaInput>) => selectLeadSla({ now: NOW, docs: [], inbound: [], solicitudes: [], quotes: [], paidOrders: [], ...over });

test("umbrales: nada antes de 60 min, aviso 1 a 60, aviso 2 a 150", () => {
  assert.equal(stageFor(59), 0);
  assert.equal(stageFor(60), 1);
  assert.equal(stageFor(149), 1);
  assert.equal(stageFor(150), 2);
  assert.equal(run({ docs: [doc("a@x.com", 30)] }).length, 0);
  assert.equal(run({ docs: [doc("a@x.com", 61)] })[0].stage, 1);
  assert.equal(run({ docs: [doc("a@x.com", 200)] })[0].stage, 2);
});

test("corte a 24 h: un lead más viejo ya no avisa", () => {
  assert.equal(run({ docs: [doc("a@x.com", 24 * 60 + 5)] }).length, 0);
  assert.equal(run({ docs: [doc("a@x.com", 23 * 60)] }).length, 1);
});

test("atendido: presupuesto enviado, pedido pagado o email contestado lo excluyen; un borrador no", () => {
  const q = (sentAt: Date | null, createdAt = ago(10)): SlaQuote => ({ id: "Q1", email: "a@x.com", phone: null, expRef: null, sentAt, createdAt });
  assert.equal(run({ docs: [doc("a@x.com", 90)], quotes: [q(ago(10))] }).length, 0);
  assert.equal(run({ docs: [doc("a@x.com", 90)], quotes: [q(null)] }).length, 0, "borrador posterior: aviso 1 suprimido");
  assert.equal(run({ docs: [doc("a@x.com", 200)], quotes: [q(null)] }).length, 1, "aviso 2 sigue hasta que se envíe");
  assert.equal(run({ docs: [doc("a@x.com", 90)], quotes: [q(ago(60 * 24 * 3), ago(60 * 24 * 3))] }).length, 1, "presupuesto enviado hace días no contesta esta petición");
  assert.equal(run({ docs: [doc("a@x.com", 90)], paidOrders: [{ clientEmail: "a@x.com", clientPhone: null, clientName: "Ana" }] }).length, 0);
  const replied: SlaInbound = { fromEmail: "a@x.com", fromName: null, fromPhone: null, subject: "s", receivedAt: ago(80), status: "REPLIED", quoteId: null, repliedAt: ago(5), channel: "EMAIL" };
  assert.equal(run({ docs: [doc("a@x.com", 90)], inbound: [replied] }).length, 0);
});

test("emails de prueba y de staff no avisan", () => {
  const docs = ["x@yopmail.com", "y@mailinator.com", "prueba@gmail.com", "test@gmail.com", "hola@traduccionesjuradas.net"].map((e) => doc(e, 120));
  assert.equal(run({ docs, staffEmails: ["hola@traduccionesjuradas.net"] }).length, 0);
});

test("una persona con dos emails y la misma sesión es una sola fila con la llegada más antigua", () => {
  const leads = run({ docs: [doc("a@x.com", 100, { clientPhone: "600111222" }), doc("b@x.com", 80, { clientPhone: "600111222", sessionToken: "S2", fileName: "b.pdf" })] });
  assert.equal(leads.length, 1);
  assert.equal(leads[0].minutes, 100);
  assert.equal(leads[0].motor, 60);
  assert.match(leads[0].keyBase, /^p:|^e:/);
});

test("clave de dedupe por persona y aviso, estable aunque entren más datos", () => {
  const a = run({ docs: [doc("a@x.com", 100, { clientPhone: "600111222" })] })[0];
  const b = run({ docs: [doc("a@x.com", 110, { clientPhone: "600111222" }), doc("c@x.com", 70, { clientPhone: "600111222", sessionToken: "S3", fileName: "c.pdf" })] })[0];
  assert.equal(a.keyBase, b.keyBase);
  assert.equal(dedupeId(a.keyBase, 1), `lead-sla:${a.keyBase}:1`);
  assert.notEqual(dedupeId(a.keyBase, 1), dedupeId(a.keyBase, 2));
});

test("email del buzón no avisa; WhatsApp de persona nueva sí; con quoteId o con historial no", () => {
  const base: SlaInbound = { fromEmail: "cli@x.com", fromName: "Cli", fromPhone: null, subject: "Precio", receivedAt: ago(70), status: "NEW", quoteId: null, repliedAt: null, channel: "EMAIL" };
  assert.equal(run({ inbound: [base] }).length, 0);
  const wa = run({ inbound: [{ ...base, fromEmail: "34600111222@whatsapp.local", fromPhone: "+34600111222", channel: "WHATSAPP" }] });
  assert.equal(wa[0].email, null);
  assert.equal(wa[0].via[0], "whatsapp");
  const waMsg = { ...base, fromEmail: "34600111222@whatsapp.local", fromPhone: "+34600111222", channel: "WHATSAPP" };
  assert.equal(run({ inbound: [{ ...waMsg, quoteId: "Q9" }] }).length, 0);
  const old: SlaQuote = { id: "Q0", email: "x@x.com", phone: "600111222", expRef: null, sentAt: ago(60 * 24 * 20), createdAt: ago(60 * 24 * 20) };
  assert.equal(run({ inbound: [waMsg], quotes: [old] }).length, 0, "cliente con historial: seguimiento, no lead nuevo");
});

test("solicitud a lavori SENT sin precio cuenta; con precio no", () => {
  const sol = (priceCents: number | null) => ({ ref: "LEAD-1", customerHint: "Pepe pepe@x.com", expedienteRef: null, quoteId: null, status: "SENT", priceCents, par: "NL>ES", createdAt: ago(100) });
  assert.equal(run({ solicitudes: [sol(null)] }).length, 1);
  assert.equal(run({ solicitudes: [sol(5000)] }).length, 0);
});

test("horas de SMS: 08:00-22:00 Madrid", () => {
  assert.equal(smsAllowed(new Date("2026-10-22T05:59:00Z")), false); // 07:59 CEST
  assert.equal(smsAllowed(new Date("2026-10-22T06:00:00Z")), true); // 08:00
  assert.equal(smsAllowed(new Date("2026-10-22T19:59:00Z")), true); // 21:59
  assert.equal(smsAllowed(new Date("2026-10-22T20:00:00Z")), false); // 22:00
  assert.equal(smsAllowed(new Date("2026-12-22T06:30:00Z")), false); // 07:30 CET
});
