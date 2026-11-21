import { test } from "node:test";
import assert from "node:assert/strict";
import { ETAPA, PORTADA_VACIA, hojasDe, pasoDe } from "../../../lib/entrada/portada.ts";
import { PORTADA_T } from "../../../lib/entrada/portada-i18n.ts";
import type { ClientView } from "../../../lib/entrada/view.ts";

const archivo = { id: "a1", name: "x.pdf", url: "u", mimeType: "application/pdf", size: 1, pages: 3 };
const lectura = (fase: "leyendo" | "lista" = "lista") => ({ fase, loteUpdatedAt: "t", editable: true, targetLang: "es", documentos: [], noIncluidos: [], preguntas: [], resumen: "" });
const v = (x: Partial<ClientView>): ClientView => ({
  estado: "abierta", email: null, emailVerificado: false, archivos: [archivo], lectura: null, sinJurado: null, plazo: { urgency: null, neededBy: null },
  organismo: null, pais: null, idiomas: { origen: "fr", destinos: ["es"] }, soloLectura: null, ...x,
});
const L = (x = {}) => ({ ...PORTADA_VACIA, ...x });

test("portada: el email va DESPUÉS de subir; cada estado tiene su paso", () => {
  assert.equal(pasoDe(null, L()), "portada");
  assert.equal(pasoDe(v({ archivos: [] }), L()), "portada");
  assert.equal(pasoDe(v({}), L()), "archivos");
  assert.equal(pasoDe(v({}), L({ quiereLeer: true })), "email");
  assert.equal(pasoDe(v({ email: "a@b.es" }), L({ quiereLeer: true })), "codigo");
  assert.equal(pasoDe(v({ email: "a@b.es" }), L({ quiereLeer: true, cambiarEmail: true })), "email");
  assert.equal(pasoDe(v({ email: "a@b.es", emailVerificado: true }), L({ quiereLeer: true })), "lectura");
  assert.equal(pasoDe(v({ email: "a@b.es", emailVerificado: true, lectura: lectura("leyendo") }), L()), "lectura");
  const leida = v({ estado: "leida", email: "a@b.es", emailVerificado: true, lectura: lectura() });
  assert.equal(pasoDe(leida, L()), "documentos");
  assert.equal(pasoDe(leida, L({ verArchivos: true })), "archivos");
  assert.equal(pasoDe(leida, L({ revisado: true })), "fecha");
  assert.equal(pasoDe({ ...leida, estado: "abierta" }, L()), "archivos", "a file added after the reading asks to read again");
  assert.equal(pasoDe({ ...leida, estado: "confirmada" }, L()), "enviado");
  assert.equal(pasoDe(v({ estado: "sin_jurado" }), L()), "sin_jurado");
  assert.deepEqual([ETAPA.archivos, ETAPA.codigo, ETAPA.documentos, ETAPA.fecha], [0, 1, 2, 3]);
});

test("portada: una miniatura por página de cada archivo", () => {
  assert.deepEqual(hojasDe([{ id: "a", pages: 2 }, { id: "b", pages: null }]), [{ archivoId: "a", page: 1 }, { archivoId: "a", page: 2 }, { archivoId: "b", page: 1 }]);
});

test("portada: textos en los 5 idiomas, sin precios salvo el «desde»", () => {
  for (const l of ["es", "fr", "en", "de", "pt"] as const) {
    const flat = JSON.stringify(PORTADA_T[l]);
    assert.doesNotMatch(flat, /€|\d+ ?eur/i, l);
    assert.equal(PORTADA_T[l].etapas.length, 4);
  }
});
