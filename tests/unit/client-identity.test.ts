import test from "node:test";
import assert from "node:assert/strict";
import {
  emailKey,
  phoneKey,
  identityKey,
  parseIdentityGroups,
  expandIdentity,
} from "../../lib/client-identity.ts";

// Caso real (19-sep-2026): Walid entró con dos correos y un teléfono. El guardia
// cruzaba por email o teléfono sueltos, así que para el sistema eran clientes
// distintos: tres encargos abiertos en lavori y dos presupuestos enviados a
// 78,65 € y 58,08 € por el mismo certificado.
const GRUPO_WALID = "walidvanrijszen@gmail.com,walidwalidhlali222@gmail.com,658404151";

test("phoneKey: los 9 últimos dígitos, venga como venga el prefijo", () => {
  assert.equal(phoneKey("+34 658 40 41 51"), "658404151");
  assert.equal(phoneKey("0034658404151"), "658404151");
  assert.equal(phoneKey("658404151"), "658404151");
  assert.equal(phoneKey("1234"), "", "un número corto no es clave de nadie");
  assert.equal(phoneKey(null), "");
});

test("emailKey: sin mayúsculas ni espacios", () => {
  assert.equal(emailKey("  Walid@Gmail.COM "), "walid@gmail.com");
  assert.equal(emailKey(undefined), "");
});

test("identityKey distingue correo de teléfono por la arroba", () => {
  assert.equal(identityKey("A@B.com"), "a@b.com");
  assert.equal(identityKey("+34 600 111 222"), "600111222");
  assert.equal(identityKey("   "), "");
});

test("parseIdentityGroups lee los grupos declarados y descarta los de uno solo", () => {
  const grupos = parseIdentityGroups(`${GRUPO_WALID};otro@x.com,611000999;suelto@y.com`);
  assert.equal(grupos.length, 2, "un grupo de un solo miembro no agrupa nada");
  assert.deepEqual(grupos[0], ["walidvanrijszen@gmail.com", "walidwalidhlali222@gmail.com", "658404151"]);
});

test("una identidad del grupo devuelve TODAS las del grupo", () => {
  const grupos = parseIdentityGroups(GRUPO_WALID);
  const claves = expandIdentity({ email: "walidwalidhlali222@gmail.com" }, grupos);
  assert.equal(claves.length, 3);
  assert.ok(claves.includes("walidvanrijszen@gmail.com"), "debe alcanzar su otro correo");
  assert.ok(claves.includes("658404151"), "y su teléfono");
});

test("entra por teléfono y también alcanza sus dos correos", () => {
  const grupos = parseIdentityGroups(GRUPO_WALID);
  const claves = expandIdentity({ phone: "+34 658 40 41 51" }, grupos);
  assert.equal(claves.length, 3);
  assert.ok(claves.includes("walidvanrijszen@gmail.com"));
});

test("quien NO está en ningún grupo solo se busca a sí mismo", () => {
  const grupos = parseIdentityGroups(GRUPO_WALID);
  assert.deepEqual(expandIdentity({ email: "ajeno@example.com" }, grupos), ["ajeno@example.com"]);
});

test("sin identidad no hay nada que buscar (no se cruzan fichas a ciegas)", () => {
  assert.deepEqual(expandIdentity({ email: null, phone: null }, parseIdentityGroups(GRUPO_WALID)), []);
});

test("sin grupos declarados, el comportamiento es el de siempre", () => {
  const claves = expandIdentity({ email: "a@b.com", phone: "600111222" }, []);
  assert.deepEqual(claves.sort(), ["600111222", "a@b.com"]);
});

test("un grupo mal escrito no rompe nada", () => {
  assert.deepEqual(parseIdentityGroups(";;  ;"), []);
  assert.deepEqual(parseIdentityGroups(null), []);
});

import { hasPaidOrder, personPaidOrdersWhere, PAID_LOOKBACK_DAYS } from "../../lib/paid-orders.ts";

test("hasPaidOrder: misma persona; con huellas solo la misma huella, sin huellas ±24 h; whatsapp.local aporta teléfono", () => {
  const at = new Date("2026-11-10T12:00:00Z");
  const paidAt = new Date("2026-11-10T00:00:00Z");
  const withHash = [{ clientEmail: "A@x.com", clientPhone: "0034600111222", paidAt, fileHashes: ["H1"] }];
  assert.equal(hasPaidOrder({ email: "a@x.com", at, hashes: ["H1"] }, withHash), true);
  assert.equal(hasPaidOrder({ email: "a@x.com", at, hashes: ["H2"] }, withHash), false);
  assert.equal(hasPaidOrder({ email: "a@x.com", at: new Date("2026-11-09T12:00:00Z"), hashes: ["H2"] }, withHash), true);
  assert.equal(hasPaidOrder({ phone: "+34 600 111 222", at, hashes: ["H1"] }, withHash), true);
  assert.equal(hasPaidOrder({ email: "b@x.com", phone: "611000000", at, hashes: ["H1"] }, withHash), false);
  const noHash = [{ clientEmail: "a@x.com", clientPhone: null, paidAt }];
  assert.equal(hasPaidOrder({ email: "a@x.com", at }, noHash), true);
  assert.equal(hasPaidOrder({ email: "a@x.com", at: new Date("2026-11-13T12:00:00Z") }, noHash), false);
  assert.equal(hasPaidOrder({ phone: "600111222", at }, [{ clientEmail: "34600111222@whatsapp.local", clientPhone: null, paidAt }]), true);
  assert.equal(PAID_LOOKBACK_DAYS, 14);
  assert.equal(personPaidOrdersWhere({}, new Date()), null);
});
