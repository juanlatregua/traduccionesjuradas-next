import test from "node:test";
import assert from "node:assert/strict";
import { decidirCaso, paresCompatibles, normPar, type CasoCandidato, type Senal } from "../../lib/caso/resolver.ts";
import { identidadDe, aliasDesdeEnv } from "../../lib/caso/identidad.ts";

const AHORA = new Date("2026-10-11T12:00:00Z");
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000);
const sinDocs = { hashes: [], contentKeys: [] };

const senal = (o: Partial<Senal> & { email?: string | null; phone?: string | null }): Senal => ({
  entrada: "puerta",
  identidad: identidadDe({ email: o.email, phone: o.phone }),
  pares: ["EN>ES"],
  docs: sinDocs,
  ahora: AHORA,
  ...o,
});
const caso = (o: Partial<CasoCandidato> & { email?: string | null; phone?: string | null }): CasoCandidato => ({
  id: "c1",
  estado: "ABIERTO",
  identidad: identidadDe({ email: "email" in o ? o.email : "ana@x.com", phone: o.phone }),
  pares: ["EN>ES"],
  docs: { hashes: ["h1"], contentKeys: [] },
  esAgencia: false,
  lastActivityAt: hace(2),
  porAncla: false,
  ...o,
});

test("pares: formato, desconocido casa con todo, dirección importa", () => {
  assert.equal(normPar("en->es"), "EN>ES");
  assert.equal(normPar("fr-es"), "FR>ES");
  assert.equal(normPar("?>ES"), "");
  assert.ok(paresCompatibles(["EN>ES"], ["en-es"]));
  assert.ok(paresCompatibles([], ["EN>ES"]));
  assert.ok(!paresCompatibles(["ES>EN"], ["EN>ES"]));
});

test("ancla directa manda (aunque el caso esté encargado); dos anclas distintas = dudoso", () => {
  const d = decidirCaso(senal({ email: "otra@y.com" }), [caso({ porAncla: true, estado: "EN_CURSO" })]);
  assert.deepEqual([d.accion, d.casoId, d.regla], ["adjuntar", "c1", "ancla"]);
  const d2 = decidirCaso(senal({ email: "ana@x.com" }), [caso({ porAncla: true }), caso({ id: "c2", porAncla: true })]);
  assert.equal(d2.accion, "dudoso");
  assert.deepEqual(d2.posibles, ["c1", "c2"]);
});

test("mismo documento y par en caso ABIERTO: adjuntar (reenvío)", () => {
  const d = decidirCaso(senal({ email: "ana@x.com", docs: { hashes: ["h1"], contentKeys: [] } }), [caso({})]);
  assert.deepEqual([d.accion, d.casoId, d.regla], ["adjuntar", "c1", "mismo_documento"]);
});

test("mismo documento en caso con pedido reciente: adjuntar avisando (¿segunda copia?)", () => {
  const d = decidirCaso(senal({ email: "ana@x.com", docs: { hashes: ["h1"], contentKeys: [] } }), [caso({ estado: "ENTREGADO", lastActivityAt: hace(24 * 10) })]);
  assert.equal(d.accion, "adjuntar");
  assert.equal(d.yaEncargado, true);
});

test("D4: mismo cliente y par con documento DISTINTO → caso nuevo con posible, nunca unir", () => {
  const d = decidirCaso(senal({ email: "ana@x.com", docs: { hashes: ["h2"], contentKeys: [] } }), [caso({})]);
  assert.deepEqual([d.accion, d.regla], ["crear", "documento_distinto"]);
  assert.deepEqual(d.posibles, ["c1"]);
});

test("agencia: dos documentos distintos el mismo día → dos casos", () => {
  const primero = caso({ email: "nuria@nadalfortuny.es", esAgencia: true, docs: { hashes: ["doc-a"], contentKeys: [] }, lastActivityAt: hace(3) });
  const d = decidirCaso(senal({ email: "nuria@nadalfortuny.es", esAgencia: true, docs: { hashes: ["doc-b"], contentKeys: [] } }), [primero]);
  assert.equal(d.accion, "crear");
  assert.deepEqual(d.posibles, [primero.id]);
  // el mismo documento otra vez sí es el mismo caso
  const d2 = decidirCaso(senal({ email: "nuria@nadalfortuny.es", esAgencia: true, docs: { hashes: ["doc-a"], contentKeys: [] } }), [primero]);
  assert.deepEqual([d2.accion, d2.casoId], ["adjuntar", primero.id]);
  // agencia sin documentos (un «¿cómo va?»): no se sabe de cuál → dudoso
  const d3 = decidirCaso(senal({ email: "nuria@nadalfortuny.es", esAgencia: true }), [primero]);
  assert.equal(d3.accion, "dudoso");
});

test("unir por identidad solo si la señal no trae documentos", () => {
  const d = decidirCaso(senal({ email: "ANA@x.com" }), [caso({})]);
  assert.deepEqual([d.accion, d.casoId, d.regla], ["adjuntar", "c1", "identidad"]);
  const varios = decidirCaso(senal({ email: "ana@x.com" }), [caso({}), caso({ id: "c2", lastActivityAt: hace(1) })]);
  assert.equal(varios.accion, "dudoso");
  assert.deepEqual(varios.posibles, ["c2", "c1"]);
  // caso viejo (>30 d) o cerrado: no se le une
  assert.equal(decidirCaso(senal({ email: "ana@x.com" }), [caso({ lastActivityAt: hace(24 * 40) })]).accion, "crear");
  assert.equal(decidirCaso(senal({ email: "ana@x.com" }), [caso({ estado: "PERDIDO" })]).accion, "crear");
  // otro par: no
  assert.equal(decidirCaso(senal({ email: "ana@x.com", pares: ["DE>ES"] }), [caso({})]).accion, "crear");
});

test("WhatsApp + web con el mismo teléfono", () => {
  const wa = caso({ email: "34658404151@whatsapp.local", docs: { hashes: ["foto-wa"], contentKeys: [] } });
  // web con email + mismo teléfono, sin documentos → mismo caso
  const d = decidirCaso(senal({ email: "ana@x.com", phone: "+34 658 40 41 51" }), [wa]);
  assert.deepEqual([d.accion, d.casoId, d.regla], ["adjuntar", "c1", "identidad"]);
  // sube el mismo documento → mismo caso
  assert.equal(decidirCaso(senal({ email: "ana@x.com", phone: "658404151", docs: { hashes: ["foto-wa"], contentKeys: [] } }), [wa]).casoId, "c1");
  // sube otro documento → caso nuevo con posible
  const d3 = decidirCaso(senal({ email: "ana@x.com", phone: "658404151", docs: { hashes: ["pdf-web"], contentKeys: [] } }), [wa]);
  assert.deepEqual([d3.accion, d3.posibles], ["crear", ["c1"]]);
});

test("sin email (solo teléfono) une por teléfono", () => {
  const d = decidirCaso(senal({ phone: "600111222" }), [caso({ email: null, phone: "+34600111222" })]);
  assert.deepEqual([d.accion, d.regla], ["adjuntar", "identidad"]);
});

test("mismo teléfono con emails reales distintos: posible, nunca unir", () => {
  const d = decidirCaso(senal({ email: "otra@y.com", phone: "658404151" }), [caso({ phone: "658404151" })]);
  assert.deepEqual([d.accion, d.regla, d.posibles], ["crear", "posible", ["c1"]]);
});

test("marcador sin teléfono válido = sin identidad: caso propio", () => {
  const d = decidirCaso(senal({ email: "sintelefono@whatsapp.local" }), [caso({ email: "sintelefono@whatsapp.local" })]);
  assert.deepEqual([d.accion, d.regla], ["crear", "sin_identidad"]);
});

test("alias: otro correo del mismo grupo une como fuerte", () => {
  const alias = aliasDesdeEnv("walid1@gmail.com,walid2@gmail.com");
  const c = caso({ identidad: identidadDe({ email: "walid1@gmail.com" }, { alias }) });
  const d = decidirCaso({ ...senal({}), identidad: identidadDe({ email: "walid2@gmail.com" }, { alias }) }, [c]);
  assert.deepEqual([d.accion, d.casoId], ["adjuntar", "c1"]);
});
