import { test } from "node:test";
import assert from "node:assert/strict";
import { knownLang, resolveSourceLang } from "../../lib/entrada/idioma.ts";

const d = (sourceLang: string, included = true) => ({ included, sourceLang });

test("el idioma elegido manda sobre lo detectado", () => {
  assert.equal(resolveSourceLang("de", [d("fr"), d("fr")]), "de");
  assert.equal(resolveSourceLang(" EN ", []), "en");
});

test("sin elegido: el único idioma detectado, mayúsculas incluidas", () => {
  assert.equal(resolveSourceLang(null, [d("fr"), d("FR")]), "fr");
  assert.equal(resolveSourceLang("unknown", [d("Pt")]), "pt");
});

test("ignora documentos excluidos y «unknown»", () => {
  assert.equal(resolveSourceLang(null, [d("fr"), d("de", false), d("unknown")]), "fr");
});

test("ambiguo o vacío → null", () => {
  assert.equal(resolveSourceLang(null, [d("fr"), d("de")]), null);
  assert.equal(resolveSourceLang(null, []), null);
  assert.equal(resolveSourceLang(null, [d("unknown"), d("", true)]), null);
  assert.equal(resolveSourceLang(null, [d("fr", false)]), null);
});

test("knownLang solo acepta códigos de 2-3 letras", () => {
  assert.equal(knownLang("fra"), "fra");
  assert.equal(knownLang("unknown"), null);
  assert.equal(knownLang("francés"), null);
  assert.equal(knownLang(undefined), null);
});
