import test from "node:test";
import assert from "node:assert/strict";
import { alreadyCustomerFor, buildFacts, CustomerIndex, countSkip, type ClientFact } from "../../lib/client-contact-guard.ts";
import { emailSendStatus } from "../../lib/message-status.ts";
import { clientSmsEnabled, smsBraked } from "../../lib/client-sms-policy.ts";

const d = (s: string) => new Date(s);
const EVENT = d("2026-10-07T10:00:00Z");

const carmePaid: ClientFact = { kind: "presupuesto_pagado", at: d("2026-10-05T12:00:00Z"), ref: "Q-100", name: "Carme", emails: ["Carme@Mail.com"], phones: ["+34 612 345 678"], quoteId: "q1" };

test("Carme pagada: su lead (mismo email) no recibe aviso", () => {
  const index = new CustomerIndex([carmePaid]);
  const r = alreadyCustomerFor({ email: "carme@mail.com", at: EVENT }, { index });
  assert.deepEqual(r, { skip: true, reason: "presupuesto_pagado", ref: "Q-100" });
});

test("Carme: el mismo teléfono con otro email también la reconoce", () => {
  const index = new CustomerIndex([carmePaid]);
  const r = alreadyCustomerFor({ email: "otra@mail.com", phone: "612345678", at: EVENT }, { index });
  assert.equal(r.skip, true);
});

test("pedido pagado entra igual que presupuesto pagado", () => {
  const index = new CustomerIndex([{ kind: "pedido_pagado", at: d("2026-10-04T00:00:00Z"), ref: "26_ABC123", emails: ["x@y.es"] }]);
  const r = alreadyCustomerFor({ email: "x@y.es", at: EVENT }, { index });
  assert.equal(r.skip && r.reason, "pedido_pagado");
});

test("intermediario con 2 clientes: no se excluye por email", () => {
  const facts: ClientFact[] = [{ kind: "presupuesto_pagado", at: d("2026-10-06T00:00:00Z"), ref: "Q-200", emails: ["despacho@x.es"], refs: ["exp:A"], quoteId: "qa" }];
  const quotes = [
    { email: "despacho@x.es", expRef: "exp:A", holder: "Pepe" },
    { email: "despacho@x.es", expRef: "exp:B", holder: "Luis" },
  ];
  const index = new CustomerIndex(facts, quotes);
  // otro cliente del despacho, otro expediente, otro documento: SÍ recibe el aviso
  assert.deepEqual(alreadyCustomerFor({ email: "despacho@x.es", expedienteRef: "exp:B", fileHash: "H-B", at: EVENT }, { index }), { skip: false });
  // mismo expediente que el pagado: se excluye
  assert.equal(alreadyCustomerFor({ email: "despacho@x.es", expedienteRef: "exp:A", at: EVENT }, { index }).skip, true);
});

test("cliente que pagó hace 2 meses y hoy sube un documento distinto: SÍ recibe el aviso", () => {
  const index = new CustomerIndex([{ kind: "pedido_pagado", at: d("2026-08-05T00:00:00Z"), ref: "26_OLD", emails: ["viejo@x.es"], hashes: ["H-OLD"] }]);
  assert.deepEqual(alreadyCustomerFor({ email: "viejo@x.es", fileHash: "H-NEW", at: EVENT }, { index }), { skip: false });
});

test("misma huella de documento: se excluye aunque sea antiguo y con otro email", () => {
  const index = new CustomerIndex([{ kind: "analisis_con_pedido", at: d("2026-03-01T00:00:00Z"), ref: "26_OLD", emails: ["viejo@x.es"], hashes: ["H-OLD"] }]);
  const r = alreadyCustomerFor({ email: "otro@x.es", fileHash: "H-OLD", at: EVENT }, { index });
  assert.deepEqual(r, { skip: true, reason: "mismo_documento", ref: "26_OLD" });
});

test("límite de 14 días antes del evento", () => {
  const index = new CustomerIndex([{ ...carmePaid, at: d("2026-09-24T00:00:00Z") }]); // 13 d antes
  assert.equal(alreadyCustomerFor({ email: "carme@mail.com", at: EVENT }, { index }).skip, true);
  const idx2 = new CustomerIndex([{ ...carmePaid, at: d("2026-09-22T00:00:00Z") }]); // 15 d antes
  assert.equal(alreadyCustomerFor({ email: "carme@mail.com", at: EVENT }, { index: idx2 }).skip, false);
});

test("countSkip suma por motivo", () => {
  const b: Record<string, number> = {};
  countSkip(b, "a"); countSkip(b, "a"); countSkip(b, "b");
  assert.deepEqual(b, { a: 2, b: 1 });
});

test("estado del email de pago: SENT si no lanza, FAILED si lanza (Graph no devuelve providerId)", () => {
  assert.equal(emailSendStatus(null), "SENT");
  assert.equal(emailSendStatus("boom"), "FAILED");
});

test("freno de SMS: 2+ FAILED al mismo número (formatos distintos) lo frena; 1 no", () => {
  assert.equal(smsBraked(["+34 612 345 678", "612345678"], "+34612345678"), true);
  assert.equal(smsBraked(["+34612345678", "+34699999999"], "+34612345678"), false);
});

test("CLIENT_SMS: por defecto on; off lo apaga", () => {
  assert.equal(clientSmsEnabled({}), true);
  assert.equal(clientSmsEnabled({ CLIENT_SMS: "on" }), true);
  assert.equal(clientSmsEnabled({ CLIENT_SMS: "OFF" }), false);
});

/* ───────── Casos reales de prod (revisión Opus 8-oct) ───────── */
const D = d("2026-10-06T10:00:00Z");
const row = (o: Partial<any>): any => ({ clientName: null, clientPhone: null, quoteId: null, quote: null, ...o });

test("TJ-20261006-IPCM: pedido pendiente con análisis enlazado NO se salta a sí mismo", () => {
  const facts = buildFacts({
    orders: [row({ id: "o1", reference: "TJ-20261006-IPCM", clientEmail: "a@x.es", paidAt: null, paymentStatus: "PENDING", status: "PENDING_PAYMENT" })],
    quotes: [],
    analyses: [{ id: "an1", orderId: "o1", clientEmail: "a@x.es", clientName: null, clientPhone: null, sessionToken: "s", fileHash: "H1", createdAt: D }],
  });
  assert.equal(facts.length, 0, "análisis de un pedido sin pagar no cuenta");
  const index = new CustomerIndex(facts, [], [], [{ orderId: "o1", fileHash: "H1" }]);
  assert.deepEqual(alreadyCustomerFor({ mode: "encargo", orderRef: "TJ-20261006-IPCM", orderId: "o1", at: D }, { index }), { skip: false });
});

test("pedido de presupuesto: no coincide consigo mismo por quoteId", () => {
  const facts: ClientFact[] = [{ kind: "presupuesto_pagado", at: D, ref: "Q-1", quoteId: "q1", refs: ["exp:A"] }];
  const index = new CustomerIndex(facts);
  assert.equal(alreadyCustomerFor({ mode: "encargo", orderRef: "26_X", quoteId: "q1", expedienteRef: "exp:A", at: D }, { index }).skip, false);
});

test("2026-00219 y 00236 ACEPTADOS sin pagar (y con pedido sin pagar): no son pago, reciben caducidad", () => {
  const facts = buildFacts({
    orders: [row({ id: "o9", reference: "26_PEND", clientEmail: "c@x.es", quoteId: "q219", paidAt: null, paymentStatus: "PENDING", status: "PENDING_PAYMENT" })],
    quotes: [
      { id: "q219", quoteNumber: "2026-00219", status: "ACCEPTED", paidAt: null, updatedAt: D, customerEmail: "c@x.es", expedienteRef: "exp:C" },
      { id: "q236", quoteNumber: "2026-00236", status: "ACCEPTED", paidAt: null, updatedAt: D, customerEmail: "c@x.es", expedienteRef: "exp:D" },
    ],
    analyses: [],
  });
  assert.equal(facts.length, 0);
  const index = new CustomerIndex(facts);
  for (const [id, exp] of [["q219", "exp:C"], ["q236", "exp:D"]]) {
    assert.equal(alreadyCustomerFor({ mode: "encargo", quoteId: id, expedienteRef: exp, at: D }, { index }).skip, false);
  }
});

test("2026-00216 (pagado) frente a 00219 (otro encargo): 00219 SÍ recibe el aviso", () => {
  const facts = buildFacts({
    orders: [],
    quotes: [{ id: "q216", quoteNumber: "2026-00216", status: "PAID", paidAt: D, updatedAt: D, customerEmail: "c@x.es", expedienteRef: "exp:B" }],
    analyses: [{ id: "a", orderId: null, clientEmail: null, clientName: null, clientPhone: null, sessionToken: "exp:B", fileHash: "H216", createdAt: D }],
  });
  const index = new CustomerIndex(facts, [], [], [{ sessionToken: "exp:B", fileHash: "H216" }, { sessionToken: "exp:C", fileHash: "H219" }]);
  assert.equal(alreadyCustomerFor({ mode: "encargo", quoteId: "q219", expedienteRef: "exp:C", at: D }, { index }).skip, false);
});

test("2026-00199 con otro encargo pagado de la misma persona (26_DCBAE3): SÍ recibe el aviso", () => {
  const facts = buildFacts({
    orders: [row({ id: "o2", reference: "26_DCBAE3", clientEmail: "p@x.es", paidAt: D, paymentStatus: "PAID", status: "PAID" })],
    quotes: [], analyses: [],
  });
  const index = new CustomerIndex(facts);
  assert.equal(alreadyCustomerFor({ mode: "encargo", quoteId: "q199", expedienteRef: "exp:Z", at: D }, { index }).skip, false);
});

test("encargo: mismo expediente o misma huella ya pagados por otra vía SÍ se saltan", () => {
  const facts = buildFacts({
    orders: [row({ id: "o3", reference: "26_PAID", clientEmail: "p@x.es", paidAt: D, paymentStatus: "PAID", status: "DELIVERED", quote: { expedienteRef: "exp:K" } })],
    quotes: [], analyses: [{ id: "a", orderId: "o3", clientEmail: null, clientName: null, clientPhone: null, sessionToken: null, fileHash: "HK", createdAt: D }],
  });
  const index = new CustomerIndex(facts, [], [], [{ orderId: "o3", fileHash: "HK" }]);
  assert.equal(alreadyCustomerFor({ mode: "encargo", quoteId: "qn", expedienteRef: "exp:K", at: D }, { index }).skip, true);
  assert.equal(alreadyCustomerFor({ mode: "encargo", quoteId: "qn", hashes: ["HK"], at: D }, { index }).skip, true);
});

test("Carme (lead de la puerta, persona) sigue sin recibir aviso con pedido PAID real", () => {
  const facts = buildFacts({
    orders: [row({ id: "o4", reference: "26_CARME", clientEmail: "carme@mail.com", paidAt: d("2026-10-05T12:00:00Z"), paymentStatus: "PAID", status: "DELIVERED" })],
    quotes: [], analyses: [],
  });
  const index = new CustomerIndex(facts);
  assert.equal(alreadyCustomerFor({ email: "carme@mail.com", at: EVENT }, { index }).skip, true);
});
