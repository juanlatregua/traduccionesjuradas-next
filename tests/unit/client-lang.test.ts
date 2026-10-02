import test from "node:test";
import assert from "node:assert/strict";
import { suggestClientLang } from "../../lib/client-lang.ts";

test("texto en inglés gana al prefijo español", () => {
  const r = suggestClientLang({ text: "Hello, I need a sworn translation of my birth certificate, please", phone: "+34600111222" });
  assert.equal(r?.lang, "en");
  assert.match(r!.reason, /inglés/);
});
test("texto en español gana al prefijo extranjero", () => {
  const r = suggestClientLang({ text: "Hola, necesito la traducción de un documento para el registro", phone: "+31612345678" });
  assert.equal(r?.lang, "es");
});
test("texto en francés, italiano, portugués y alemán", () => {
  assert.equal(suggestClientLang({ text: "Bonjour, j'ai besoin d'une traduction pour mon dossier, merci" })?.lang, "fr");
  assert.equal(suggestClientLang({ text: "Buongiorno, vorrei un preventivo per la traduzione dei documenti" })?.lang, "it");
  assert.equal(suggestClientLang({ text: "Olá, preciso de um orçamento para a tradução, obrigado" })?.lang, "pt");
  assert.equal(suggestClientLang({ text: "Hallo, ich brauche eine beglaubigte Übersetzung, danke" })?.lang, "de");
});
test("neerlandés en texto -> inglés (no hay PDF nl)", () => {
  const r = suggestClientLang({ text: "Hallo, ik heb een vertaling nodig voor mijn document, graag een offerte" });
  assert.equal(r?.lang, "en");
  assert.match(r!.reason, /neerland/);
});
test("texto corto o ambiguo no decide y cae al prefijo", () => {
  assert.equal(suggestClientLang({ text: "ok", phone: "+31 6 1234 5678" })?.lang, "en");
  assert.equal(suggestClientLang({ text: "" , phone: "+49 170 1234567" })?.lang, "de");
});
test("locale de la página antes que el prefijo", () => {
  const r = suggestClientLang({ pageLocale: "fr-FR", phone: "+34600111222" });
  assert.equal(r?.lang, "fr");
  assert.equal(suggestClientLang({ pageLocale: "nl", phone: "+34600" })?.lang, "en");
});
test("prefijos", () => {
  const p = (phone: string) => suggestClientLang({ phone })?.lang;
  assert.equal(p("+34 600 111 222"), "es");
  assert.equal(p("+212 6 12 34 56 78"), "fr");
  assert.equal(p("+225 07 00 00 00"), "fr");
  assert.equal(p("+44 7700 900123"), "en");
  assert.equal(p("+1 202 555 0100"), "en");
  assert.equal(p("+351 912 345 678"), "pt");
  assert.equal(p("+55 11 91234 5678"), "pt");
  assert.equal(p("+39 333 1234567"), "it");
  assert.equal(p("0043 660 1234567"), "de");
  assert.equal(p("+46 70 123 45 67"), "en");
  assert.equal(p("600111222"), "es");
});
test("+32 y +41 son ambiguos: no deciden por prefijo", () => {
  assert.equal(suggestClientLang({ phone: "+32 470 12 34 56" }), null);
  assert.equal(suggestClientLang({ phone: "+41 79 123 45 67" }), null);
  assert.equal(suggestClientLang({ phone: "+32 470 12 34 56", email: "a@b.fr" })?.lang, "fr");
});
test("TLD del email y @whatsapp.local ignorado", () => {
  assert.equal(suggestClientLang({ email: "x@firma.de" })?.lang, "de");
  assert.equal(suggestClientLang({ email: "x@firma.at" })?.lang, "de");
  assert.equal(suggestClientLang({ email: "x@mail.com.br" })?.lang, "pt");
  assert.equal(suggestClientLang({ email: "x@univ.nl" })?.lang, "en");
  assert.equal(suggestClientLang({ email: "x@gmail.com" }), null);
  assert.equal(suggestClientLang({ email: "34600@whatsapp.local" }), null);
  assert.equal(suggestClientLang({}), null);
});
test("reason corto en español", () => {
  assert.equal(suggestClientLang({ phone: "+31612345678" })?.reason, "teléfono +31");
  assert.equal(suggestClientLang({ email: "a@b.de" })?.reason, "email .de");
});

test("«de»/«en» del español o francés no cuentan como neerlandés", () => {
  assert.notEqual(suggestClientLang({ text: "Traducción de partida de nacimiento de mi hijo en francés" })?.lang, "en");
  assert.equal(suggestClientLang({ text: "Salam, necesito traducir mi acta de matrimonio de Marruecos en español urgente", phone: "+212600000000" })?.lang, "es");
});
