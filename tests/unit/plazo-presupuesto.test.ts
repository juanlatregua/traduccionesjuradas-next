import test from "node:test";
import assert from "node:assert/strict";
import { plazoPresupuesto, EN_BREVE } from "../../lib/plazo-presupuesto.ts";

const at = (iso: string) => new Date(iso);
const es = (iso: string, fr = true) => plazoPresupuesto("es", fr, at(iso));

test("FR en horario de oficina (invierno, UTC+1): 1 hora", () => {
  assert.equal(es("2026-11-23T09:00:00Z"), "en 1 hora o menos");
  assert.equal(es("2026-11-23T18:59:00Z"), "en 1 hora o menos");
  assert.equal(es("2026-11-27T18:59:00Z"), "en 1 hora o menos");
});

test("FR lunes 20:00 Madrid: mañana; viernes 21:00, sábado: lunes; domingo: mañana", () => {
  assert.equal(es("2026-11-23T19:00:00Z"), "mañana a partir de las 8:00");
  assert.equal(es("2026-11-27T20:00:00Z"), "el lunes a partir de las 8:00");
  assert.equal(es("2026-11-28T11:00:00Z"), "el lunes a partir de las 8:00");
  assert.equal(es("2026-11-29T09:00:00Z"), "mañana a partir de las 8:00");
});

test("FR madrugada laborable: hoy desde las 8:00", () => {
  assert.equal(es("2026-11-24T05:00:00Z"), "hoy a partir de las 8:00");
});

test("no FR: en breve en los 5 idiomas, a cualquier hora", () => {
  assert.equal(es("2026-11-23T09:00:00Z", false), "en breve");
  for (const l of ["es", "fr", "en", "de", "pt"] as const) assert.equal(plazoPresupuesto(l, false, at("2026-11-28T11:00:00Z")), EN_BREVE[l]);
});

test("cambio de hora: verano UTC+2 y paso de marzo/octubre", () => {
  assert.equal(es("2026-07-06T06:00:00Z"), "en 1 hora o menos");
  assert.equal(es("2026-07-06T05:59:00Z"), "hoy a partir de las 8:00");
  assert.equal(es("2026-07-06T18:00:00Z"), "mañana a partir de las 8:00");
  assert.equal(es("2026-03-27T18:30:00Z"), "en 1 hora o menos");
  assert.equal(es("2026-03-30T17:59:00Z"), "en 1 hora o menos");
  assert.equal(es("2026-03-30T18:00:00Z"), "mañana a partir de las 8:00");
  assert.equal(es("2026-10-26T18:59:00Z"), "en 1 hora o menos");
  assert.equal(es("2026-10-26T19:00:00Z"), "mañana a partir de las 8:00");
});

test("los 5 idiomas devuelven texto en cada caso", () => {
  for (const l of ["es", "fr", "en", "de", "pt"] as const) {
    for (const iso of ["2026-11-23T09:00:00Z", "2026-11-23T19:00:00Z", "2026-11-27T21:00:00Z", "2026-11-24T05:00:00Z"]) assert.ok(plazoPresupuesto(l, true, at(iso)).length > 5);
  }
});
