import test from "node:test";
import assert from "node:assert/strict";
import { createCaseRef, selectShippableMembers } from "../../lib/order-case-logic.ts";

function m(reference: string, deliveryType: string, shippedAt: Date | null = null, paymentStatus = "PAID") {
  return { id: `id-${reference}`, reference, deliveryType, shippedAt, paymentStatus };
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

// Regresion cazada en la revision del 31-ago: el sellado en bloque no miraba el
// pago, asi que un hermano recien creado y sin cobrar entraba en el sobre y el
// cliente recibia un email diciendo que iba de camino algo que no habia pagado.
// Misma regla que /api/orders/[ref]/delivery y lib/client-delivery.ts:18.
test("un hermano SIN COBRAR no se sella ni se le anuncia al cliente", () => {
  const members = [m("26_EB4037", "paper"), m("26_349A82", "paper", null, "PENDING")];
  assert.deepEqual(selectShippableMembers(members).map((x) => x.reference), ["26_EB4037"]);
});

test("el hermano sin cobrar sigue siendo enviable cuando entra su pago", () => {
  const pendiente = m("26_349A82", "paper", null, "PENDING");
  assert.equal(selectShippableMembers([pendiente]).length, 0);
  assert.equal(pendiente.shippedAt, null, "no se le pone shippedAt: no queda inservible");
  const pagado = { ...pendiente, paymentStatus: "PAID" };
  assert.deepEqual(selectShippableMembers([pagado]).map((x) => x.reference), ["26_349A82"]);
});

test("papel + cobrado + sin sellar son las TRES condiciones, no dos", () => {
  const members = [
    m("digital", "pdf"),
    m("ya-enviado", "paper", new Date("2026-08-30")),
    m("sin-pagar", "paper", null, "PENDING"),
    m("bueno", "paper"),
  ];
  assert.deepEqual(selectShippableMembers(members).map((x) => x.reference), ["bueno"]);
});
