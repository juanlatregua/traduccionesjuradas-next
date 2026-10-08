import test from "node:test";
import assert from "node:assert/strict";
import { alreadyCustomerFor, CustomerIndex, countSkip, type ClientFact } from "../../lib/client-contact-guard.ts";
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
