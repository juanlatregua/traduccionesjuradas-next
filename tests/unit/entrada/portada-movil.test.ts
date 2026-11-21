import { test } from "node:test";
import assert from "node:assert/strict";
import { esFalloDeRed, fmtEspera, nombreCorto, normalizarLocal, pasoAtras } from "../../../lib/entrada/portada.ts";
import { PORTADA_T } from "../../../lib/entrada/portada-i18n.ts";
import { ENTRADA_SOURCES, sourceDe } from "../../../lib/entrada/sources.ts";
import type { ClientView } from "../../../lib/entrada/view.ts";

test("atrás del móvil: un paso atrás dentro de la tarjeta; desde Documentos o la lectura sale de la página", () => {
  assert.deepEqual(pasoAtras("fecha", null), { revisado: false });
  assert.deepEqual(pasoAtras("documentos", null), { verArchivos: true });
  assert.deepEqual(pasoAtras("codigo", null), { cambiarEmail: true });
  assert.deepEqual(pasoAtras("email", null), { quiereLeer: false });
  assert.deepEqual(pasoAtras("email", { estado: "leida" } as ClientView), { verArchivos: true });
  for (const p of ["portada", "archivos", "lectura", "enviado", "sin_jurado"] as const) assert.equal(pasoAtras(p, null), null, p);
});

test("nombres largos: se acortan por el medio y conservan la extensión", () => {
  const long = "IMG_20261121_093412_certificado_de_nacimiento_literal_registro_civil_reverso_apostilla.jpg";
  const c = nombreCorto(long);
  assert.equal(c.length, 32);
  assert.ok(c.startsWith("IMG_2026") && c.endsWith(".jpg") && c.includes("…"), c);
  assert.equal(nombreCorto("acta.pdf"), "acta.pdf");
  assert.equal(nombreCorto("x".repeat(50), 20).length, 20);
});

test("espera legible y fallos reintentables", () => {
  assert.equal(fmtEspera(42.4), "42 s");
  assert.equal(fmtEspera(80), "1 min 20 s");
  assert.equal(fmtEspera(120), "2 min");
  assert.ok(esFalloDeRed(0) && esFalloDeRed(500) && esFalloDeRed(503));
  assert.ok(!esFalloDeRed(400) && !esFalloDeRed(410) && !esFalloDeRed(429));
});

test("una duda que falló vuelve a quedar pendiente al recargar (se reintenta sola)", () => {
  const l = normalizarLocal({ dudas: [{ q: "¿apostilla?", a: null, fallo: true }] });
  assert.deepEqual(l.dudas, [{ q: "¿apostilla?", a: null }]);
});

test("textos nuevos de espera y recuperación en los 5 idiomas", () => {
  for (const [lang, p] of Object.entries(PORTADA_T)) {
    assert.match(p.subiendoN(3, 8, "foto.jpg", 40), /3.*8.*foto\.jpg.*40/, lang);
    assert.ok(!p.subiendoN(1, 1, "a.pdf", null).includes("1 "), lang);
    for (const k of ["subidaLenta", "reintentar", "sinConexion", "lecturaFallo", "lecturaLarga", "recuperando", "noRecuperada", "dudaFallo", "envioFallo", "queSigue"] as const) assert.ok(p[k].length > 3, `${lang}.${k}`);
    assert.match(p.noSubidos(["a.jpg"]), /a\.jpg/, lang);
  }
});

test("orígenes de captación: la portada acepta los mismos que /presupuesto-instantaneo", () => {
  for (const s of ENTRADA_SOURCES) assert.equal(sourceDe(` ${s.toUpperCase()} `), s);
  assert.equal(sourceDe("uge-ce"), "uge-ce");
  assert.equal(sourceDe("otro"), null);
  assert.equal(sourceDe(null), null);
});
