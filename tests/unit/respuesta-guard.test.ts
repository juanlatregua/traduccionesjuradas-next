import test from "node:test";
import assert from "node:assert/strict";
import { expandIdentity, isOwnAddress, isAutoReplySubject, liveBlock, repliedSince, replyGate, matchesIdentity, type LiveFact } from "../../lib/respuesta-guard.ts";

const d = (s: string) => new Date(s);
const NOW = d("2026-10-09T12:00:00Z");
const MARK = "212772303735@whatsapp.local";

const wa: LiveFact = { kind: "quote", ref: "2026-00236", status: "SENT", createdAt: d("2026-10-08T10:00:00Z"), email: MARK, phone: "+212772303735" };

test("Hella: la puerta sabe el email y el presupuesto de WhatsApp el teléfono; un registro que ligue ambos los une", () => {
  const sinLigar = expandIdentity({ email: "hellatiti@hotmail.fr" }, []);
  assert.equal(liveBlock(sinLigar, [wa], NOW), null);
  const id = expandIdentity({ email: "hellatiti@hotmail.fr" }, [{ email: "hellatiti@hotmail.fr", phone: "+212 772 303 735" }]);
  assert.equal(liveBlock(id, [wa], NOW)?.ref, "2026-00236");
});

test("el email marcador cuenta como teléfono, nunca como email", () => {
  const id = expandIdentity({ email: MARK }, []);
  assert.deepEqual([...id.emails], []);
  assert.equal(id.phones.size, 1);
  assert.ok(matchesIdentity(id, { phone: "+212772303735" }));
});

test("presupuesto vivo de hace más de 30 días, perdido o caducado no frena", () => {
  const id = expandIdentity({ email: "a@x.com" }, []);
  const f = (o: Partial<LiveFact>): LiveFact => ({ kind: "quote", ref: "Q", status: "SENT", createdAt: d("2026-10-01T00:00:00Z"), email: "a@x.com", ...o });
  assert.ok(liveBlock(id, [f({})], NOW));
  assert.equal(liveBlock(id, [f({ createdAt: d("2026-08-01T00:00:00Z") })], NOW), null);
  assert.equal(liveBlock(id, [f({ status: "EXPIRED" })], NOW), null);
  assert.equal(liveBlock(id, [f({ status: "PAID" })], NOW), null);
});

test("pedido: IN_PROGRESS frena; PAID/DELIVERED solo si es posterior al lead; pendiente de pago no", () => {
  const id = expandIdentity({ email: "a@x.com" }, []);
  const o = (o: Partial<LiveFact>): LiveFact => ({ kind: "order", ref: "TJ-1", status: "PAID", createdAt: d("2026-10-02T00:00:00Z"), paidAt: d("2026-10-02T00:00:00Z"), email: "A@X.com", ...o });
  assert.ok(liveBlock(id, [o({ status: "IN_PROGRESS" })], NOW, { leadAt: d("2026-10-05T00:00:00Z") }));
  assert.equal(liveBlock(id, [o({})], NOW, { leadAt: d("2026-10-05T00:00:00Z") }), null);
  assert.ok(liveBlock(id, [o({})], NOW, { leadAt: d("2026-10-01T00:00:00Z") }));
  assert.equal(liveBlock(id, [o({ status: "PENDING_PAYMENT", paidAt: null })], NOW), null);
});

test("un solo salto: email→teléfono sí, email→teléfono→otro email no", () => {
  const pairs = [{ email: "a@x.com", phone: "600000001" }, { email: "b@x.com", phone: "600000001" }];
  const id = expandIdentity({ email: "a@x.com" }, pairs);
  assert.deepEqual([...id.phones], ["600000001"]);
  assert.deepEqual([...id.emails], ["a@x.com"]);
});

test("intermediario (contrapartes contadas aparte) no liga; buzón propio y staff se excluyen", () => {
  const pairs = [{ email: "agencia@x.com", phone: "600000001" }];
  const fanout = (kind: string, key: string) => (kind === "email" && key === "agencia@x.com" ? 9 : 1);
  assert.equal(expandIdentity({ email: "agencia@x.com" }, pairs, { fanout }).phones.size, 0);
  assert.equal(expandIdentity({ email: "hola@traduccionesjuradas.net" }, pairs, { isOwn: (e) => isOwnAddress(e) }).emails.size, 0);
  assert.ok(isOwnAddress("x@lavori.es") && isOwnAddress("a@holabonjour.es") && isOwnAddress("juan@gmail.com", ["juan@gmail.com"]));
  assert.equal(isOwnAddress("cliente@gmail.com"), false);
});

test("respuestas automáticas por asunto no cuentan", () => {
  for (const s of ["Automatic reply: presupuesto", "Réponse automatique : devis", "Respuesta automática: x", "Out of Office", "Abwesenheit", "Risposta automatica"]) assert.ok(isAutoReplySubject(s), s);
  assert.equal(isAutoReplySubject("Re: Presupuesto 2026-00236"), false);
});

test("respuesta: solo cuenta lo posterior al último contacto y de la misma persona", () => {
  const id = expandIdentity({ email: "hellatiti@hotmail.fr" }, [{ email: "hellatiti@hotmail.fr", phone: "212772303735" }]);
  const since = d("2026-10-08T12:00:00Z");
  assert.equal(repliedSince(id, [{ from: "hellatiti@hotmail.fr", at: d("2026-10-09T12:31:00Z") }], since), true);
  assert.equal(repliedSince(id, [{ phone: "+212772303735", at: d("2026-10-09T08:00:00Z") }], since), true);
  assert.equal(repliedSince(id, [{ from: "hellatiti@hotmail.fr", at: d("2026-10-07T12:00:00Z") }], since), false);
  assert.equal(repliedSince(id, [{ from: "otro@x.com", at: d("2026-10-09T12:31:00Z") }], since), false);
});

test("replyGate: contestó → no cierra ni recuerda; Graph caído → no cierra; el resto pasa", () => {
  assert.equal(replyGate({ action: "close", replied: true, inboxOk: true }), "hold_replied");
  assert.equal(replyGate({ action: "remind_email", replied: true, inboxOk: true }), "hold_replied");
  assert.equal(replyGate({ action: "close", replied: false, inboxOk: false }), "hold_unknown");
  assert.equal(replyGate({ action: "close", replied: false, inboxOk: true }), "proceed");
  assert.equal(replyGate({ action: "whatsapp_task", replied: true, inboxOk: false }), "proceed");
});
