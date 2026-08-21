import test from "node:test";
import assert from "node:assert/strict";
import {
  lavoriRouteFromPair,
  bridgeAmounts,
  bridgeDescription,
  buildSolicitudPayload,
  buildPriceRequestPayload,
  lavoriCarteraForLang,
  resolveLavoriCandidatos,
  LAVORI_CANDIDATES,
  LAVORI_MEMBERS,
} from "../../lib/lavori-bridge.ts";

// Fase 1 del puente motor→tablón (carril alemán → Morton). Contrato:
// research/contrato-fase1-solicitudes-2026-08-10.md (repo lavori).

test("lavoriRouteFromPair: alemán se enruta, en ambas direcciones", () => {
  const deEs = lavoriRouteFromPair("de->es");
  assert.ok(deEs);
  assert.equal(deEs.par, "DE>ES");
  assert.deepEqual(deEs.candidatos, ["ngus1uku6x5uw2pqbmflpbbt"]);
  const esDe = lavoriRouteFromPair("es->de");
  assert.ok(esDe);
  assert.equal(esDe.par, "ES>DE");
});

test("lavoriRouteFromPair: carriles 12-ago — rumano (Maria) e inglés (Vanessa)", () => {
  const roEs = lavoriRouteFromPair("ro->es");
  assert.ok(roEs);
  assert.equal(roEs.par, "RO>ES");
  assert.deepEqual(roEs.candidatos, ["8npqw6hd5vavn4maio2173lq"]);
  const esEn = lavoriRouteFromPair("es->en");
  assert.ok(esEn);
  assert.equal(esEn.par, "ES>EN");
  assert.deepEqual(esEn.candidatos, ["43dwlkzsr6lsltpwcj32m88s"]);
});

test("lavoriRouteFromPair: carriles 13/14-ago — portugués, árabe y neerlandés multi-candidato", () => {
  const ptEs = lavoriRouteFromPair("pt->es");
  assert.ok(ptEs);
  assert.equal(ptEs.candidatos.length, 2); // Carballo + María García (cotizan ambos)
  const arEs = lavoriRouteFromPair("ar->es");
  assert.ok(arEs);
  assert.equal(arEs.candidatos.length, 3); // los 3 jurados AR operativos
  const nlEs = lavoriRouteFromPair("nl->es");
  assert.ok(nlEs);
  assert.equal(nlEs.candidatos.length, 4);
});

test("lavoriRouteFromPair: carril 21-ago — italiano (Juan Amor, único con canal)", () => {
  const itEs = lavoriRouteFromPair("it->es");
  assert.ok(itEs);
  assert.equal(itEs.par, "IT>ES");
  assert.deepEqual(itEs.candidatos, ["rk1x2kq63rm6ba6mco7c6u2k"]);
  // La cartera IT tiene además a María García Garmendia (elegible a mano).
  const cartera = lavoriCarteraForLang("it").map((m) => m.id);
  assert.deepEqual(cartera, ["rk1x2kq63rm6ba6mco7c6u2k", "f4pyspe0hsa1ss99siaokqti"]);
});

test("lavoriRouteFromPair: el resto de lenguas NO se enrutan", () => {
  assert.equal(lavoriRouteFromPair("fr->es"), null); // FR es de Juan
  assert.equal(lavoriRouteFromPair("ca->es"), null);
  assert.equal(lavoriRouteFromPair("es->es"), null);
  assert.equal(lavoriRouteFromPair(null), null);
  assert.equal(lavoriRouteFromPair(""), null);
});

test("cartera: todo candidato del carril por defecto está en la cartera con esa lengua", () => {
  for (const [lang, ids] of Object.entries(LAVORI_CANDIDATES)) {
    const cartera = lavoriCarteraForLang(lang).map((m) => m.id);
    for (const id of ids) assert.ok(cartera.includes(id), `${id} (${lang}) falta en LAVORI_MEMBERS`);
    // Los del carril van primero en la cartera (la UI los enseña como defecto).
    assert.deepEqual(cartera.slice(0, ids.length).sort(), [...ids].sort());
  }
  // Sin ids repetidos en la cartera.
  assert.equal(new Set(LAVORI_MEMBERS.map((m) => m.id)).size, LAVORI_MEMBERS.length);
});

test("resolveLavoriCandidatos: sin elección → carril; elección válida → solo esos; fuera de cartera → error", () => {
  const en = lavoriRouteFromPair("en->es")!;
  assert.deepEqual(resolveLavoriCandidatos(en, undefined), { ok: true, candidatos: en.candidatos, elegidos: false });
  // "Todos los de la lengua": la cartera EN completa.
  const todosEn = lavoriCarteraForLang("en").map((m) => m.id);
  assert.ok(todosEn.length > 1);
  const todos = resolveLavoriCandidatos(en, todosEn);
  assert.ok(todos.ok && todos.elegidos && todos.candidatos.length === todosEn.length);
  // "Uno en concreto": inglés → Vanessa.
  const uno = resolveLavoriCandidatos(en, ["43dwlkzsr6lsltpwcj32m88s"]);
  assert.ok(uno.ok && uno.elegidos);
  assert.deepEqual(uno.ok && uno.candidatos, ["43dwlkzsr6lsltpwcj32m88s"]);
  // Un id de OTRA lengua (Morton, DE) no vale para inglés; ni lista vacía ni basura.
  assert.equal(resolveLavoriCandidatos(en, ["ngus1uku6x5uw2pqbmflpbbt"]).ok, false);
  assert.equal(resolveLavoriCandidatos(en, []).ok, false);
  assert.equal(resolveLavoriCandidatos(en, "43dwlkzsr6lsltpwcj32m88s").ok, false);
});

test("bridgeAmounts: paraTi = 75% del neto, precioCliente = neto", () => {
  // Los números de la demo: 75,02 € brutos → neto 62,00 → paraTi 46,50
  assert.deepEqual(bridgeAmounts(7502), { paraTi: "46.50", precioCliente: "62.00" });
  // Mínimo alemán de la puerta: 50 € neto → 60,50 brutos
  assert.deepEqual(bridgeAmounts(6050), { paraTi: "37.50", precioCliente: "50.00" });
});

test("bridgeDescription: sin PII, con volumen y par", () => {
  const d = bridgeDescription({ docCount: 1, words: 520, par: "DE>ES" });
  assert.match(d, /1 documento PDF/);
  assert.match(d, /~520 palabras/);
  assert.match(d, /DE>ES/);
  const sinPalabras = bridgeDescription({ docCount: 2, words: null, par: "ES>DE" });
  assert.match(sinPalabras, /2 documentos PDF/);
  assert.doesNotMatch(sinPalabras, /palabras/);
});

test("buildSolicitudPayload: forma completa del contrato", () => {
  const route = lavoriRouteFromPair("de->es")!;
  const payload = buildSolicitudPayload({
    reference: "TJ-20260810-TEST",
    route,
    amountCents: 7502,
    words: 520,
    dueDate: new Date("2026-08-14T10:00:00Z"),
    documentos: [{ nombre: "doc.pdf", contentType: "application/pdf", base64: "QQ==" }],
  });
  assert.equal(payload.ref, "TJ-20260810-TEST");
  assert.equal(payload.par, "DE>ES");
  assert.equal(payload.paraTi, "46.50");
  assert.equal(payload.precioCliente, "62.00");
  assert.equal(payload.palabras, 520);
  assert.equal(payload.plazo, "2026-08-14");
  assert.deepEqual(payload.candidatos, ["ngus1uku6x5uw2pqbmflpbbt"]);
  assert.equal(payload.documentos.length, 1);
  // El título del pedido no existe en el payload: la descripción se genera sin PII
  assert.match(payload.descripcion, /Encargo de la casa/);
});

test("buildPriceRequestPayload: especificaciones viajan recortadas; fuera si vacías", () => {
  const route = lavoriRouteFromPair("ro->es")!;
  const base = {
    reference: "LEAD-ABC123",
    route,
    words: null,
    documentos: [{ nombre: "doc.pdf", contentType: "application/pdf", base64: "QQ==" }],
  };
  const con = buildPriceRequestPayload({ ...base, especificaciones: `  apostilla íntegra ${"x".repeat(2100)}` });
  assert.equal(con.ref, "LEAD-ABC123-precio");
  assert.ok(con.especificaciones!.startsWith("apostilla íntegra"));
  assert.equal(con.especificaciones!.length, 2000);
  const sin = buildPriceRequestPayload({ ...base, especificaciones: "   " });
  assert.equal("especificaciones" in sin, false);
  assert.equal("especificaciones" in buildPriceRequestPayload(base), false);
});

test("buildSolicitudPayload: opcionales fuera cuando no hay dato", () => {
  const route = lavoriRouteFromPair("de->es")!;
  const payload = buildSolicitudPayload({
    reference: "X",
    route,
    amountCents: 6050,
    words: null,
    dueDate: null,
    documentos: [],
  });
  assert.equal("palabras" in payload, false);
  assert.equal("plazo" in payload, false);
});
