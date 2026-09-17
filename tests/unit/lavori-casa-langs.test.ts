import test from "node:test";
import assert from "node:assert/strict";

// El francés es de Juan (orden 16-sep-2026). La regla vivía solo como ausencia
// en LAVORI_CANDIDATES y se escapó tres veces por la cartera viva de lavori:
// LEAD-0B0C46A29D (10-sep), LEAD-C4699A93B1 y LEAD-6E846030BB (16-sep).
const { isCasaLang, casaJuradoFor, CASA_LANGS } = await import("../../lib/lavori-bridge.ts");

test("el francés lo jura la casa: Juan Silva Moreno, T-IJ 3850", () => {
  assert.equal(isCasaLang("fr"), true);
  assert.equal(isCasaLang("FR"), true);
  assert.equal(casaJuradoFor("fr")?.nombre, "Juan Silva Moreno");
  assert.equal(casaJuradoFor("fr")?.maec, "3850");
});

test("las lenguas del tablón no son de la casa", () => {
  for (const l of ["nl", "de", "en", "ro", "it", "pt", "ca", "sv", "ar", "ru"]) {
    assert.equal(isCasaLang(l), false, l);
  }
});

test("vacío o desconocido no cuela como lengua de la casa", () => {
  assert.equal(isCasaLang(null), false);
  assert.equal(isCasaLang(""), false);
  assert.equal(isCasaLang("unknown"), false);
  assert.equal(casaJuradoFor("nl"), null);
});

test("CASA_LANGS solo tiene francés (si crece, que sea a propósito)", () => {
  assert.deepEqual(Object.keys(CASA_LANGS), ["fr"]);
});

test("un pedido de francés en cualquier dirección es de la casa; el resto no", async () => {
  const { isCasaPair } = await import("../../lib/lavori-bridge.ts");
  assert.equal(isCasaPair("fr->es"), true);
  assert.equal(isCasaPair("es->fr"), true);
  assert.equal(isCasaPair("FR->ES"), true);
  assert.equal(isCasaPair("fr-es"), true);
  assert.equal(isCasaPair("FR>ES"), true);
  assert.equal(isCasaPair("es→fr"), true);
  // Sin español al otro lado no lo jura la casa (FR→EN no es de Juan).
  for (const p of ["nl->es", "es->de", "en->es", "fr->en", "en-fr", null, "", "es->es", "fr"]) assert.equal(isCasaPair(p), false, String(p));
});
