import test from "node:test";
import assert from "node:assert/strict";
import { identidadDe } from "../../../lib/caso/identidad.ts";
import { decidirEntrada, nombreParecido, type CasoVisto } from "../../../lib/entrada/identidad.ts";

const AHORA = new Date("2026-11-19T10:00:00Z");
const hace = (d: number) => new Date(AHORA.getTime() - d * 864e5);
const caso = (o: Partial<CasoVisto> & { email?: string | null; phone?: string | null }): CasoVisto => ({
  id: "c1", estado: "ABIERTO", identidad: identidadDe({ email: o.email ?? null, phone: o.phone ?? null }), nombre: null, esAgencia: false, lastActivityAt: hace(1), hashes: [], conPedido: false, ...o,
});
const senal = (o: { email?: string; phone?: string; nombre?: string; hashes?: string[] }) => ({
  identidad: identidadDe({ email: o.email, phone: o.phone }), nombre: o.nombre ?? null, hashes: o.hashes ?? [], ahora: AHORA,
});

test("huella: same file joins even with no common contact (Diego: email vs WhatsApp)", () => {
  const wa = caso({ id: "wa", phone: "+5547997504962", hashes: ["1176acb13419e259"] });
  const d = decidirEntrada(senal({ email: "diegoarndt@outlook.com", hashes: ["1176acb13419e259"] }), [wa]);
  assert.deepEqual([d.accion, d.casoId, d.regla, d.dudoso], ["unir", "wa", "huella", false]);
});

test("huella: an open caso wins over a delivered one, which is only linked as related", () => {
  const open = caso({ id: "open", hashes: ["h"], lastActivityAt: hace(20) });
  const done = caso({ id: "done", estado: "ENTREGADO", hashes: ["h"], lastActivityAt: hace(1) });
  const d = decidirEntrada(senal({ hashes: ["h"] }), [done, open]);
  assert.deepEqual([d.accion, d.casoId, d.relacionados], ["unir", "open", ["done"]]);
});

test("Juan 1: same file as a caso EN_CURSO, ENTREGADO, SIN_JURADO or with an order → NEW caso related to it, never joined", () => {
  for (const c of [caso({ id: "x", estado: "EN_CURSO", hashes: ["h"] }), caso({ id: "x", estado: "ENTREGADO", hashes: ["h"] }), caso({ id: "x", estado: "SIN_JURADO", hashes: ["h"] }), caso({ id: "x", hashes: ["h"], conPedido: true })]) {
    const d = decidirEntrada(senal({ email: "a@x.com", hashes: ["h"] }), [c]);
    assert.deepEqual([d.accion, d.regla, d.relacionados, d.casoId], ["crear", "relacionado", ["x"], undefined], c.estado);
  }
  const byMail = decidirEntrada(senal({ email: "a@x.com" }), [caso({ email: "a@x.com", conPedido: true })]);
  assert.equal(byMail.accion, "crear", "an open caso with an order is not joined by contact either");
});

test("contacto: same email or phone with an open caso in 14 days joins; older does not", () => {
  const c = caso({ email: "ana@x.com", lastActivityAt: hace(13) });
  assert.deepEqual([decidirEntrada(senal({ email: "ANA@x.com " }), [c]).regla], ["contacto"]);
  assert.equal(decidirEntrada(senal({ email: "ana@x.com" }), [{ ...c, lastActivityAt: hace(15) }]).accion, "crear");
  assert.equal(decidirEntrada(senal({ email: "ana@x.com" }), [{ ...c, estado: "PERDIDO" }]).accion, "unir", "a lost caso without order comes back");
  assert.equal(decidirEntrada(senal({ email: "ana@x.com" }), [{ ...c, estado: "ENTREGADO" }]).accion, "crear");
});

test("contacto with different documents still joins (one caso per person while it lives)", () => {
  const c = caso({ email: "ana@x.com", hashes: ["otro"] });
  assert.deepEqual([decidirEntrada(senal({ email: "ana@x.com", hashes: ["nuevo"] }), [c]).accion], ["unir"]);
});

test("dudoso: similar name or same phone with another real email never joins, it marks", () => {
  const c = caso({ id: "wa", phone: "+554791365173", nombre: "Jeniffer Deschamps" });
  const byName = decidirEntrada(senal({ email: "jenifferdeschamps@icloud.com", nombre: "jeniffer DESCHAMPS" }), [c]);
  assert.deepEqual([byName.accion, byName.regla, byName.dudoso, byName.posibles], ["crear", "dudoso", true, ["wa"]]);
  const e = caso({ id: "e", email: "a@x.com", phone: "600111222" });
  const phone = decidirEntrada(senal({ email: "b@y.com", phone: "600111222" }), [e]);
  assert.deepEqual([phone.accion, phone.dudoso], ["crear", true]);
});

test("agency: same contact creates its own caso, linked as possible", () => {
  const d = decidirEntrada(senal({ email: "agencia@x.com" }), [caso({ email: "agencia@x.com", esAgencia: true })]);
  assert.deepEqual([d.accion, d.regla, d.posibles], ["crear", "agencia", ["c1"]]);
});

test("nothing in common: new caso", () => {
  const d = decidirEntrada(senal({ email: "x@x.com", nombre: "Pedro Ruiz", hashes: ["z"] }), [caso({ email: "a@a.com", nombre: "Ana Gómez", hashes: ["h"] })]);
  assert.deepEqual([d.accion, d.regla, d.posibles], ["crear", "nuevo", []]);
});

test("nombreParecido: accents, particles and single names", () => {
  assert.equal(nombreParecido("José de la Fuente García", "Jose Garcia Fuente"), true);
  assert.equal(nombreParecido("María", "maria lópez"), true);
  assert.equal(nombreParecido("Juan Pérez", "Juan Gómez"), false);
  assert.equal(nombreParecido(null, "Ana"), false);
});

test("Juan 4: a phone without a matching email never joins: new caso «¿mismo cliente?»; a known email still joins", () => {
  const p = caso({ id: "wa", phone: "+34 600 111 222", lastActivityAt: hace(2) });
  for (const sg of [senal({ phone: "600111222" }), senal({ email: "otra@y.com", phone: "600111222" })]) {
    const d = decidirEntrada(sg, [p]);
    assert.deepEqual([d.accion, d.regla, d.dudoso, d.posibles], ["crear", "dudoso", true, ["wa"]]);
  }
  const m = caso({ id: "m", email: "ana@x.com", phone: "600111222" });
  assert.deepEqual([decidirEntrada(senal({ email: "ana@x.com", phone: "699999999" }), [m]).casoId], ["m"]);
  assert.equal(decidirEntrada(senal({ phone: "600111222", hashes: ["h"] }), [{ ...p, hashes: ["h"] }]).regla, "huella", "the fingerprint still joins");
});
