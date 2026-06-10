import test from "node:test";
import assert from "node:assert/strict";
import {
  getSourceLang,
  isQuoteExcludedLang,
  isFrenchSourceLang,
  pickSuggestedBid,
} from "../../lib/quotes.ts";

test("getSourceLang extrae el idioma origen de varios formatos", () => {
  assert.equal(getSourceLang("en-es"), "en");
  assert.equal(getSourceLang("fr-es"), "fr");
  assert.equal(getSourceLang("FR → ES"), "fr");
  assert.equal(getSourceLang("de -> es"), "de");
  assert.equal(getSourceLang("ru-es"), "ru");
  assert.equal(getSourceLang("uk-es"), "uk");
});

test("getSourceLang devuelve null para entradas vacías o inválidas", () => {
  assert.equal(getSourceLang(""), null);
  assert.equal(getSourceLang(null), null);
  assert.equal(getSourceLang(undefined), null);
});

test("isQuoteExcludedLang excluye uk y permite ru", () => {
  assert.equal(isQuoteExcludedLang("uk"), true);
  assert.equal(isQuoteExcludedLang("UK"), true);
  assert.equal(isQuoteExcludedLang("ru"), false);
  assert.equal(isQuoteExcludedLang("en"), false);
  assert.equal(isQuoteExcludedLang("fr"), false);
});

test("isFrenchSourceLang detecta fr (asignación directa)", () => {
  assert.equal(isFrenchSourceLang("fr"), true);
  assert.equal(isFrenchSourceLang("FR"), true);
  assert.equal(isFrenchSourceLang("en"), false);
});

test("pickSuggestedBid ordena por precio ascendente", () => {
  const id = pickSuggestedBid([
    { id: "a", status: "QUOTED", quotedPriceCents: 5000, quotedDeadline: null },
    { id: "b", status: "QUOTED", quotedPriceCents: 3000, quotedDeadline: null },
    { id: "c", status: "QUOTED", quotedPriceCents: 4000, quotedDeadline: null },
  ]);
  assert.equal(id, "b");
});

test("pickSuggestedBid desempata por plazo más corto", () => {
  const id = pickSuggestedBid([
    { id: "a", status: "QUOTED", quotedPriceCents: 3000, quotedDeadline: "2026-07-10" },
    { id: "b", status: "QUOTED", quotedPriceCents: 3000, quotedDeadline: "2026-07-05" },
  ]);
  assert.equal(id, "b");
});

test("pickSuggestedBid ignora ofertas no QUOTED o sin precio", () => {
  const id = pickSuggestedBid([
    { id: "a", status: "REQUESTED", quotedPriceCents: null, quotedDeadline: null },
    { id: "b", status: "REJECTED", quotedPriceCents: 1000, quotedDeadline: null },
    { id: "c", status: "QUOTED", quotedPriceCents: 9000, quotedDeadline: null },
  ]);
  assert.equal(id, "c");
});

test("pickSuggestedBid devuelve null si no hay ofertas válidas", () => {
  assert.equal(pickSuggestedBid([]), null);
  assert.equal(
    pickSuggestedBid([{ id: "a", status: "REQUESTED", quotedPriceCents: null, quotedDeadline: null }]),
    null
  );
});

// Filtrado de idioma: el broadcast solo procede si el idioma no está excluido.
test("filtrado de idioma del broadcast excluye uk siempre", () => {
  const langs = ["fr", "en", "de", "ru", "uk", "ar"];
  const broadcastable = langs.filter((l) => !isQuoteExcludedLang(l));
  assert.deepEqual(broadcastable, ["fr", "en", "de", "ru", "ar"]);
  assert.ok(!broadcastable.includes("uk"));
});
