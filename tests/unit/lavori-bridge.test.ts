import test from "node:test";
import assert from "node:assert/strict";
import {
  lavoriRouteFromPair,
  bridgeAmounts,
  bridgeDescription,
  buildSolicitudPayload,
  buildPriceRequestPayload,
  lavoriCarteraForLang,
  lavoriLangFromPair,
  lavoriManualRoute,
  mapLavoriMiembro,
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

test("lavoriRouteFromPair: carriles — pt a Juan Amor (31-ago), árabe y neerlandés multi-candidato", () => {
  const ptEs = lavoriRouteFromPair("pt->es");
  assert.ok(ptEs);
  // 31-ago (Juan): el portugués VA A JUAN AMOR — Carballo fuera (tarda mucho).
  assert.equal(ptEs.candidatos.length, 1);
  assert.equal(ptEs.candidatos[0], "rk1x2kq63rm6ba6mco7c6u2k"); // Juan Amor
  const arEs = lavoriRouteFromPair("ar->es");
  assert.ok(arEs);
  assert.equal(arEs.candidatos.length, 3); // los 3 jurados AR operativos
  const nlEs = lavoriRouteFromPair("nl->es");
  assert.ok(nlEs);
  assert.equal(nlEs.candidatos.length, 4);
});

test("lavoriRouteFromPair: carriles 21-ago — italiano y catalán (Juan Amor, único con canal)", () => {
  const itEs = lavoriRouteFromPair("it->es");
  assert.ok(itEs);
  assert.equal(itEs.par, "IT>ES");
  assert.deepEqual(itEs.candidatos, ["rk1x2kq63rm6ba6mco7c6u2k"]);
  const esCa = lavoriRouteFromPair("es->ca");
  assert.ok(esCa);
  assert.equal(esCa.par, "ES>CA");
  assert.deepEqual(esCa.candidatos, ["rk1x2kq63rm6ba6mco7c6u2k"]);
  // La cartera IT tiene además a María García Garmendia (elegible a mano).
  const cartera = lavoriCarteraForLang("it").map((m) => m.id);
  assert.deepEqual(cartera, ["rk1x2kq63rm6ba6mco7c6u2k", "f4pyspe0hsa1ss99siaokqti"]);
});

test("lavoriRouteFromPair: el resto de lenguas NO se enrutan", () => {
  assert.equal(lavoriRouteFromPair("fr->es"), null); // FR es de Juan
  assert.equal(lavoriRouteFromPair("pl->es"), null); // sin carril fijo (solo a mano)
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
  const cartera = lavoriCarteraForLang("en");
  assert.deepEqual(resolveLavoriCandidatos(en, undefined, cartera), { ok: true, candidatos: en.candidatos, elegidos: false });
  // "Todos los de la lengua": la cartera EN completa.
  const todosEn = cartera.map((m) => m.id);
  assert.ok(todosEn.length > 1);
  const todos = resolveLavoriCandidatos(en, todosEn, cartera);
  assert.ok(todos.ok && todos.elegidos && todos.candidatos.length === todosEn.length);
  // "Uno en concreto": inglés → Vanessa.
  const uno = resolveLavoriCandidatos(en, ["43dwlkzsr6lsltpwcj32m88s"], cartera);
  assert.ok(uno.ok && uno.elegidos);
  assert.deepEqual(uno.ok && uno.candidatos, ["43dwlkzsr6lsltpwcj32m88s"]);
  // Un id de OTRA lengua (Morton, DE) no vale para inglés; ni lista vacía ni basura.
  assert.equal(resolveLavoriCandidatos(en, ["ngus1uku6x5uw2pqbmflpbbt"], cartera).ok, false);
  assert.equal(resolveLavoriCandidatos(en, [], cartera).ok, false);
  assert.equal(resolveLavoriCandidatos(en, "43dwlkzsr6lsltpwcj32m88s", cartera).ok, false);
  // Con la cartera VIVA la validación sigue a la cartera, no a la tabla estática.
  const viva = [{ id: "nuevo-en-lavori", nombre: "Alta de hoy", langs: ["en"], canal: true }];
  assert.ok(resolveLavoriCandidatos(en, ["nuevo-en-lavori"], viva).ok);
  assert.equal(resolveLavoriCandidatos(en, ["43dwlkzsr6lsltpwcj32m88s"], viva).ok, false);
});

test("lavoriLangFromPair parsea cualquier lengua; lavoriManualRoute: carril fijo o cartera con canal", () => {
  assert.deepEqual(lavoriLangFromPair("pl->es"), { lang: "pl", par: "PL>ES" });
  assert.deepEqual(lavoriLangFromPair("es->pl"), { lang: "pl", par: "ES>PL" });
  assert.equal(lavoriLangFromPair("es->es"), null);
  assert.equal(lavoriLangFromPair(""), null);
  // Polaco: sin carril automático (lavoriRouteFromPair null)…
  assert.equal(lavoriRouteFromPair("pl->es"), null);
  // …pero a mano se puede pedir a la cartera viva con canal (no en paz, no buzón vacío).
  const carteraPl = [
    { id: "pl1", nombre: "A", langs: ["pl"], canal: true },
    { id: "pl2", nombre: "B", langs: ["pl"], canal: false },
    { id: "pl3", nombre: "C", langs: ["pl"], canal: true, enPaz: true },
  ];
  assert.deepEqual(lavoriManualRoute("pl->es", carteraPl), { lang: "pl", par: "PL>ES", candidatos: ["pl1"] });
  // Con carril fijo, manda el carril (inglés → Vanessa) aunque la cartera sea mayor.
  assert.deepEqual(lavoriManualRoute("en->es", lavoriCarteraForLang("en")), lavoriRouteFromPair("en->es"));
  assert.equal(lavoriManualRoute("es->es", []), null);
});

test("mapLavoriMiembro: del endpoint de lavori a la cartera (solo jurados con pares con español)", () => {
  const m = mapLavoriMiembro({
    id: "rk1x2kq63rm6ba6mco7c6u2k",
    nombre: "Juan Amor Fernández",
    tij: "132",
    pares: ["DE>ES", "ES>DE", "IT>ES", "ES>IT", "CA>EN"],
    jurado: true,
    email: true,
    push: 0,
    papelUnico: false,
    disponible: true,
    enPaz: false,
    canal: true,
  });
  assert.ok(m);
  assert.deepEqual(m.langs, ["de", "it"]); // CA>EN no lleva español: fuera
  assert.equal(m.canal, true);
  assert.equal(m.tij, "132");
  // Sin canal explícito se deriva de email/push.
  assert.equal(mapLavoriMiembro({ id: "x", nombre: "X", pares: ["PT>ES"], email: false, push: 0 })?.canal, false);
  assert.equal(mapLavoriMiembro({ id: "x", nombre: "X", pares: ["PT>ES"], email: false, push: 2 })?.canal, true);
  // No jurado o sin pares con español → null.
  assert.equal(mapLavoriMiembro({ id: "x", nombre: "X", pares: ["IT>ES"], jurado: false }), null);
  assert.equal(mapLavoriMiembro({ id: "x", nombre: "X", pares: ["CA>EN"] }), null);
  assert.equal(mapLavoriMiembro({ id: "", nombre: "X", pares: ["IT>ES"] }), null);
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
    documentos: [{ nombre: "doc.pdf", contentType: "application/pdf", url: "https://x.public.blob.vercel-storage.com/doc.pdf", bytes: 1, sha256: "a".repeat(64) }],
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
    documentos: [{ nombre: "doc.pdf", contentType: "application/pdf", url: "https://x.public.blob.vercel-storage.com/doc.pdf", bytes: 1, sha256: "a".repeat(64) }],
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
