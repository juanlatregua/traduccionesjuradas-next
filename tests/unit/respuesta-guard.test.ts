import test from "node:test";
import assert from "node:assert/strict";
import { expandIdentity, liveBlock, repliedSince, replyGate, matchesIdentity, type LiveFact } from "../../lib/respuesta-guard.ts";

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
});

test("pedido pagado en 30 días frena; pedido pendiente de pago no", () => {
  const id = expandIdentity({ email: "a@x.com" }, []);
  const o = (o: Partial<LiveFact>): LiveFact => ({ kind: "order", ref: "TJ-1", status: "PAID", createdAt: d("2026-10-02T00:00:00Z"), paidAt: d("2026-10-02T00:00:00Z"), email: "A@X.com", ...o });
  assert.ok(liveBlock(id, [o({})], NOW));
  assert.equal(liveBlock(id, [o({ status: "PENDING_PAYMENT", paidAt: null })], NOW), null);
});

test("un intermediario con muchos teléfonos no liga a nadie", () => {
  const pairs = ["600000001", "600000002", "600000003", "600000004"].map((phone) => ({ email: "agencia@x.com", phone }));
  const id = expandIdentity({ email: "agencia@x.com" }, pairs);
  assert.equal(id.phones.size, 0);
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
