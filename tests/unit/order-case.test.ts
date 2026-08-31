import test from "node:test";
import assert from "node:assert/strict";
import { createCaseRef, selectShippableMembers } from "../../lib/order-case-logic.ts";

function m(reference: string, deliveryType: string, shippedAt: Date | null = null) {
  return { id: `id-${reference}`, reference, deliveryType, shippedAt };
}

test("createCaseRef usa el prefijo TRAM- y nunca el de los expedientes de entrada", () => {
  const ref = createCaseRef();
  assert.match(ref, /^TRAM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.ok(!ref.startsWith("EXP-"));
});

test("createCaseRef no repite", () => {
  const refs = new Set(Array.from({ length: 200 }, () => createCaseRef()));
  assert.equal(refs.size, 200);
});

// Caso real Ana Suárez (31-ago-2026): 26_3259FE digital YA entregado + dos de
// papel pendientes. El digital NO puede colarse en el email de mensajería.
test("el trámite de Ana manda solo los dos de papel, no el PDF ya entregado", () => {
  const members = [
    m("26_3259FE", "pdf", new Date("2026-08-07")),
    m("26_EB4037", "paper"),
    m("26_349A82", "paper"),
  ];
  const out = selectShippableMembers(members).map((x) => x.reference);
  assert.deepEqual(out, ["26_EB4037", "26_349A82"]);
});

test("un pedido de papel ya sellado no se reescribe", () => {
  const members = [m("26_A", "paper", new Date("2026-08-30")), m("26_B", "paper")];
  assert.deepEqual(selectShippableMembers(members).map((x) => x.reference), ["26_B"]);
});

test("un trámite entero ya enviado no deja nada que sellar", () => {
  const members = [m("26_A", "paper", new Date("2026-08-30")), m("26_B", "paper", new Date("2026-08-30"))];
  assert.deepEqual(selectShippableMembers(members), []);
});

test("un trámite solo digital no produce envío en papel", () => {
  assert.deepEqual(selectShippableMembers([m("26_A", "pdf"), m("26_B", "pdf")]), []);
});
