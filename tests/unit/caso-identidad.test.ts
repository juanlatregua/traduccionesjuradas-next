import test from "node:test";
import assert from "node:assert/strict";
import {
  identidadDe,
  compararIdentidad,
  telefonosIntermediario,
  esAgencia,
  emailReal,
  identityKeyDe,
  aliasDesdeEnv,
} from "../../lib/caso/identidad.ts";

test("email real normalizado y teléfono a 9 dígitos", () => {
  const id = identidadDe({ email: "  Ana@X.com ", phone: "+34 658 40 41 51" });
  assert.equal(id.email, "ana@x.com");
  assert.equal(id.phone9, "658404151");
  assert.deepEqual(id.keys, ["e:ana@x.com", "p:658404151"]);
  assert.equal(id.primaria, "e:ana@x.com");
});

test("marcador @whatsapp.local = teléfono, nunca email", () => {
  const id = identidadDe({ email: "34658404151@whatsapp.local" });
  assert.equal(id.email, null);
  assert.equal(id.phone9, "658404151");
  assert.deepEqual(id.keys, ["p:658404151"]);
  assert.equal(id.primaria, "p:658404151");
  assert.equal(identidadDe({ email: "sintelefono@whatsapp.local" }).keys.length, 0);
});

test("sin email: solo teléfono; sin nada: anon con su ancla", () => {
  assert.deepEqual(identidadDe({ phone: "600 111 222" }).keys, ["p:600111222"]);
  const vacio = identidadDe({ email: "no-es-email", phone: "1234" });
  assert.equal(vacio.keys.length, 0);
  assert.equal(identityKeyDe(vacio, "q:abc"), "anon:q:abc");
});

test("buzones propios y basura no identifican a nadie", () => {
  assert.equal(emailReal("hola@traduccionesjuradas.net"), null);
  assert.equal(emailReal("x@lavori.es"), null);
  assert.equal(emailReal("staff@gmail.com", ["staff@gmail.com"]), null);
  assert.equal(emailReal("a@b"), null);
});

test("fuerte por email; teléfono con un solo email; posible con dos emails reales", () => {
  const web = identidadDe({ email: "ana@x.com", phone: "658404151" });
  const wa = identidadDe({ email: "34658404151@whatsapp.local" });
  const otra = identidadDe({ email: "otra@y.com", phone: "658404151" });
  assert.equal(compararIdentidad(web, identidadDe({ email: "ANA@x.com" })), "fuerte");
  assert.equal(compararIdentidad(web, wa), "telefono");
  assert.equal(compararIdentidad(web, otra), "posible");
  assert.equal(compararIdentidad(web, identidadDe({ email: "z@z.com" })), "ninguna");
});

test("nunca por nombre", () => {
  // misma persona por nombre, sin clave común: ninguna
  assert.equal(compararIdentidad(identidadDe({ email: "a@x.com" }), identidadDe({ email: "b@x.com" })), "ninguna");
});

test("alias de CLIENTE_IDENTIDADES_ALIAS: dos correos y un teléfono son la misma persona (fuerte)", () => {
  const alias = aliasDesdeEnv("walidvanrijszen@gmail.com,walidwalidhlali222@gmail.com,658404151");
  const a = identidadDe({ email: "walidvanrijszen@gmail.com" }, { alias });
  const b = identidadDe({ email: "walidwalidhlali222@gmail.com" }, { alias });
  const c = identidadDe({ email: "otro@gmail.com", phone: "658404151" }, { alias });
  assert.equal(compararIdentidad(a, b), "fuerte");
  assert.equal(compararIdentidad(a, c), "fuerte", "el teléfono del grupo arrastra al grupo");
  assert.equal(a.primaria, "e:walidvanrijszen@gmail.com");
});

test("teléfono de intermediario: no une (muchos emails, o 2 emails con 2 nombres)", () => {
  const filas = [
    { email: "a@x.com", phone: "611000999", nombre: "Ana" },
    { email: "b@x.com", phone: "611000999", nombre: "Berta" },
    { email: "c@x.com", phone: "622000111", nombre: "Carla" },
    { email: "c2@x.com", phone: "622000111", nombre: "Carla" },
  ];
  const vetados = telefonosIntermediario(filas);
  assert.deepEqual([...vetados], ["611000999"]);
  const a = identidadDe({ email: "a@x.com", phone: "611000999" }, { telefonosVetados: vetados });
  const b = identidadDe({ email: "b@x.com", phone: "611000999" }, { telefonosVetados: vetados });
  assert.equal(compararIdentidad(a, b), "ninguna");
});

test("agencia: solo por la ficha (empresa, crédito, factura mensual)", () => {
  assert.equal(esAgencia({ isBusiness: true }), true);
  assert.equal(esAgencia({ creditEnabled: true }), true);
  assert.equal(esAgencia({ billingCycle: "MONTHLY" }), true);
  assert.equal(esAgencia({ billingCycle: "PER_ORDER", isBusiness: false, creditEnabled: false }), false);
});
