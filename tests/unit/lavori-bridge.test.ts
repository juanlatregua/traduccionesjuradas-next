import test from "node:test";
import assert from "node:assert/strict";
import {
  lavoriRouteFromPair,
  bridgeAmounts,
  bridgeDescription,
  buildSolicitudPayload,
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

test("lavoriRouteFromPair: el resto de lenguas NO se enrutan", () => {
  assert.equal(lavoriRouteFromPair("fr->es"), null); // FR es de Juan
  assert.equal(lavoriRouteFromPair("en->es"), null); // Juan Amor
  assert.equal(lavoriRouteFromPair("pt->es"), null);
  assert.equal(lavoriRouteFromPair("it->es"), null);
  assert.equal(lavoriRouteFromPair(null), null);
  assert.equal(lavoriRouteFromPair(""), null);
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
