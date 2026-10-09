import test from "node:test";
import assert from "node:assert/strict";
import { matchOpenSiblings, blockingSibling, describeSibling, parsCompatible, type OpenItem } from "../../lib/open-siblings.ts";

const NOW = new Date("2026-10-09T12:00:00Z");
const h = (n: number) => new Date(NOW.getTime() - n * 3_600_000);
const item = (o: Partial<OpenItem>): OpenItem => ({
  kind: "quote", ref: "2026-00219", id: "q1", at: h(2), chan: "presupuesto", par: "PT>ES",
  email: "ana@x.com", phone: "+34 658 40 41 51", url: "u", ...o,
});

test("mismo email (mayúsculas/espacios) y mismo documento: hermano que bloquea", () => {
  const s = matchOpenSiblings({ email: "  ANA@x.com ", par: "PT>ES" }, [item({})], { now: NOW });
  assert.equal(s.length, 1);
  assert.equal(s[0].via, "email");
  assert.equal(blockingSibling(s, new Set(["q1"]))?.ref, "2026-00219");
  // misma persona y par pero OTRO documento: no bloquea
  assert.equal(blockingSibling(s), null);
  assert.equal(blockingSibling(s, new Set(["otro"])), null);
  assert.equal(describeSibling(s[0], NOW), "2026-00219 (presupuesto, hace 2 h)");
});

test("otro par conocido: aparece pero NO bloquea", () => {
  const s = matchOpenSiblings({ email: "ana@x.com", par: "EN>ES" }, [item({})], { now: NOW });
  assert.equal(s.length, 1);
  assert.equal(s[0].samePar, false);
  assert.equal(blockingSibling(s), null);
});

test("par desconocido en cualquiera de los lados cuenta como compatible", () => {
  assert.ok(parsCompatible("ES>UNKNOWN", "ES>PT"));
  assert.ok(parsCompatible(null, "ES>PT"));
  assert.ok(!parsCompatible("DE>ES", "ES>PT"));
});

test("solo teléfono (con y sin prefijo) y email distinto: avisa pero NO bloquea ni fusiona", () => {
  for (const phone of ["658404151", "+34658404151", "0034 658 40 41 51"]) {
    const s = matchOpenSiblings({ email: "otro@y.com", phone, par: "PT>ES" }, [item({})], { now: NOW });
    assert.equal(s.length, 1, phone);
    assert.equal(s[0].via, "phone");
    assert.equal(blockingSibling(s), null);
    assert.match(describeSibling(s[0], NOW), /OTRO email/);
  }
});

test("sin coincidencia o fuera de ventana: nada", () => {
  assert.equal(matchOpenSiblings({ email: "nadie@z.com", phone: "611000999" }, [item({})], { now: NOW }).length, 0);
  assert.equal(matchOpenSiblings({ email: "ana@x.com" }, [item({ at: h(24 * 8) })], { now: NOW }).length, 0);
  assert.equal(matchOpenSiblings({}, [item({})], { now: NOW }).length, 0);
});

test("un lead o una conversación abiertos informan pero no bloquean; el más reciente primero", () => {
  const s = matchOpenSiblings(
    { email: "ana@x.com", par: "PT>ES" },
    [item({ kind: "inbox", ref: "Olá", chan: "whatsapp", par: null, at: h(1) }), item({ kind: "lead", ref: "puerta:abcd1234", chan: "puerta", at: h(5) })],
    { now: NOW }
  );
  assert.equal(s.length, 2);
  assert.equal(s[0].kind, "inbox");
  assert.equal(blockingSibling(s), null);
});

test("email-marcador @whatsapp.local = sin email: no casa por correo, solo por teléfono (posible)", () => {
  const it = item({ email: "34658404151@whatsapp.local" });
  const a = matchOpenSiblings({ email: "34658404151@whatsapp.local", par: "PT>ES" }, [it], { now: NOW });
  assert.equal(a.length, 0);
  const b = matchOpenSiblings({ email: "34658404151@whatsapp.local", phone: "+34658404151", par: "PT>ES" }, [it], { now: NOW });
  assert.equal(b.length, 1);
  assert.equal(b[0].via, "phone");
  assert.equal(blockingSibling(b, new Set(["q1"])), null);
  const c = matchOpenSiblings({ email: "ana@x.com" }, [item({ email: "WA@whatsapp.local" })], { now: NOW });
  assert.equal(c.length, 0);
});
