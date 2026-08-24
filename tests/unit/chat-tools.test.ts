import test from "node:test";
import assert from "node:assert/strict";

// Todos los módulos bajo prueba usan imports relativos con extensión .ts, que es
// lo que node --test resuelve (el alias @/ solo lo entiende Next).
import { recommendPath } from "../../lib/chat/tools/recommend.ts";
import { verifyTranslatorCredentials } from "../../lib/chat/tools/verify.ts";
import { getQuoteEstimate } from "../../lib/chat/tools/quote.ts";
import { PER_WORD_RATE } from "../../lib/pricing-engine/languages.ts";

const UTM = "utm_source=chat&utm_medium=bot&utm_campaign=recommend_path";

test("recommend_path: Marruecos → guía + página francés (con UTM)", () => {
  const out = recommendPath({ country: "MA" });
  assert.equal(out.blog_url, `/blog/documentos-marroquies-guia-completa?${UTM}`);
  assert.equal(out.language_page, `/traductor-jurado-frances?${UTM}`);
  assert.equal(out.primary_url, `/blog/documentos-marroquies-guia-completa?${UTM}`);
  assert.match(out.reasoning, /apostilla.*2016/i);
});

test("recommend_path: UK alias y GB devuelven el mismo blog", () => {
  const a = recommendPath({ country: "UK" });
  const b = recommendPath({ country: "GB" });
  assert.equal(a.blog_url, b.blog_url);
  assert.match(a.blog_url ?? "", /documentos-britanicos-brexit-espana/);
});

test("recommend_path: Argelia menciona la fecha de entrada en vigor", () => {
  const out = recommendPath({ country: "DZ" });
  assert.match(out.reasoning, /9 de julio de 2026/);
});

test("recommend_path: intent=compare devuelve el hub agregador", () => {
  const out = recommendPath({ intent: "compare" });
  assert.match(out.primary_url, /tramites-espana-por-pais-origen/);
  assert.match(out.primary_url, /utm_source=chat/);
});

test("recommend_path: sin contexto cae al hub", () => {
  const out = recommendPath({});
  assert.match(out.primary_url, /tramites-espana-por-pais-origen/);
});

test("recommend_path: intent=urgent añade WhatsApp como primera CTA (sin UTM en URL externa)", () => {
  const out = recommendPath({ country: "MA", intent: "urgent" });
  assert.equal(out.ctas[0]?.url, "https://wa.me/34951333614");
});

test("recommend_path: tipo de documento devuelve página /documentos-oficiales con UTM", () => {
  const out = recommendPath({ language: "fr", document_type: "criminal_record" });
  assert.match(out.document_type_page ?? "", /^\/documentos-oficiales\/antecedentes-penales\?utm_/);
});

test("recommend_path: UTM solo en URLs internas (no en wa.me)", () => {
  const out = recommendPath({ country: "MA", intent: "urgent" });
  const internal = out.ctas.filter((c) => c.url.startsWith("/"));
  const external = out.ctas.filter((c) => !c.url.startsWith("/"));
  for (const c of internal) assert.match(c.url, /utm_source=chat/);
  for (const c of external) assert.doesNotMatch(c.url, /utm_source/);
});

test("verify_translator_credentials: nº 3850 → verified=true con datos de Juan Silva", () => {
  const out = verifyTranslatorCredentials({ maec_number: 3850 });
  assert.equal(out.verified, true);
  if (out.verified) {
    assert.equal(out.data.full_name, "Juan Silva Moreno");
    assert.equal(out.data.maec_number, 3850);
    assert.equal(out.data.language_iso, "fr");
    assert.equal(out.data.appointed_year, 2009);
    assert.equal(out.match_reason, "maec_number");
  }
});

test("verify_translator_credentials: nombre 'Juan Silva' → verified=true", () => {
  const out = verifyTranslatorCredentials({ name: "Juan Silva" });
  assert.equal(out.verified, true);
  if (out.verified) assert.equal(out.match_reason, "name");
});

test("verify_translator_credentials: nombre + nº correctos → match_reason=both", () => {
  const out = verifyTranslatorCredentials({ name: "juan silva moreno", maec_number: 3850 });
  assert.equal(out.verified, true);
  if (out.verified) assert.equal(out.match_reason, "both");
});

test("verify_translator_credentials: otro nº → verified=false con listado MAEC", () => {
  const out = verifyTranslatorCredentials({ maec_number: 9999 });
  assert.equal(out.verified, false);
  if (!out.verified) {
    assert.match(out.official_listing_url, /exteriores\.gob\.es/);
    assert.ok(out.how_to_validate.length >= 2);
  }
});

// === get_quote_estimate sobre el módulo REAL ===
// Antes se reproducía aquí la tabla de tarifas a mano porque los imports con
// alias @/ no resuelven en node --test; la copia podía divergir del motor sin
// que nada fallara. Con los imports relativos ya se prueba el módulo de verdad.

function priced(r: ReturnType<typeof getQuoteEstimate>) {
  assert.ok(!("auto_priceable" in r), "esperaba precio y salió la puerta de idioma sin tarifa");
  return r as Exclude<typeof r, { auto_priceable: false }>;
}

test("get_quote_estimate: FR + criminal_record + 3 páginas → precio fijo 75 € con IVA", () => {
  const r = priced(getQuoteEstimate({ language: "fr", document_type: "criminal_record", pages: 3 }));
  assert.equal(r.is_french_criminal_record, true);
  assert.equal(r.base_price_with_vat_eur, 75);
});

test("get_quote_estimate: MA + fr → Morocco fixed pricing activado", () => {
  const r = priced(getQuoteEstimate({ language: "fr", country: "MA" }));
  assert.equal(r.is_morocco_special, true);
});

// Escaparate 24-ago-2026: cifras públicas SOLO en francés ("el resto previa
// cotización en lavori"). El árabe MA ya no recibe cifra del chatbot.
test("get_quote_estimate: MA + ar → sin cifras (previa cotización en lavori)", () => {
  const r = getQuoteEstimate({ language: "ar", country: "MA" });
  assert.ok("auto_priceable" in r);
  assert.equal((r as { auto_priceable: boolean }).auto_priceable, false);
});

test("get_quote_estimate: mínimos FR 24-ago (suelto 35, 2+ págs 55, apostilla +5)", () => {
  assert.equal(priced(getQuoteEstimate({ language: "fr", document_type: "birth_certificate" })).minimum_price_eur, 35);
  assert.equal(priced(getQuoteEstimate({ language: "fr", document_type: "other", pages: 2 })).minimum_price_eur, 55);
});

test("get_quote_estimate: idiomas del motor distintos de fr NO devuelven cifras al público", () => {
  for (const lang of Object.keys(PER_WORD_RATE)) {
    const r = getQuoteEstimate({ language: lang });
    if (lang === "fr") {
      assert.equal(priced(r).rate_per_word_eur, PER_WORD_RATE.fr);
    } else {
      assert.ok("auto_priceable" in r, `${lang} no debe dar cifra pública`);
      assert.equal((r as { auto_priceable: boolean }).auto_priceable, false);
    }
  }
});

// Gate del último borde sin puerta (incidente TJ-20260602-NJ42): un idioma sin
// tarifa oficial caía al fallback y el chatbot daba una cifra con confianza.
test("get_quote_estimate: idioma sin tarifa oficial NO devuelve cifras", () => {
  for (const lang of ["ru", "uk", "zh", "ja", "es", ""]) {
    const r = getQuoteEstimate({ language: lang });
    assert.ok("auto_priceable" in r, `${lang} debería quedar fuera del precio automático`);
    assert.equal(r.auto_priceable, false);
    assert.ok(!("base_price_eur" in r), `${lang} no puede devolver precio`);
  }
});
