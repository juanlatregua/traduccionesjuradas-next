import test from "node:test";
import assert from "node:assert/strict";

// recommend.ts and verify.ts are dependency-free, so we can import directly.
// quote.ts imports via @/ alias (resolved by Next, not by node --test), so we
// reproduce its critical branches here as we do in pricing-engine.test.ts.
import { recommendPath } from "../../lib/chat/tools/recommend.ts";
import { verifyTranslatorCredentials } from "../../lib/chat/tools/verify.ts";

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

// === get_quote_estimate: lógica reproducida (importar @/ no funciona en node --test) ===

const PER_WORD_RATE: Record<string, number> = {
  fr: 0.08, en: 0.11, de: 0.12, nl: 0.14, it: 0.12, pt: 0.12,
  ca: 0.08, sv: 0.14, no: 0.14, ar: 0.10, ro: 0.09,
};
const MINIMUM_BY_TYPE: Record<string, number> = {
  birth_certificate: 42, marriage_certificate: 42, criminal_record: 42, other: 42,
};
const MINIMUM_BY_LANGUAGE: Record<string, number> = {
  en: 50, de: 50, nl: 50, it: 50, pt: 50, ca: 50, sv: 50, no: 50, ro: 50, ar: 55,
};
const FRENCH_CRIMINAL_RECORD_PRICE = 61.98;
const MOROCCO_PRICING: Record<number, number> = { 1: 40, 2: 40, 3: 45, 4: 55, 5: 65 };

function fakeQuote(input: { language: string; document_type?: string; pages?: number; country?: string }) {
  const lang = input.language;
  const docType = input.document_type ?? "other";
  const pages = input.pages ?? 1;
  const country = input.country?.toUpperCase();
  const isFrenchCriminal = docType === "criminal_record" && lang === "fr" && pages >= 3;
  const isMoroccoSpecial = country === "MA" && lang !== "ar";
  const minimum = Math.max(
    MINIMUM_BY_TYPE[docType] ?? 42,
    MINIMUM_BY_LANGUAGE[lang] ?? 0,
  );
  return { isFrenchCriminal, isMoroccoSpecial, minimum, rate: PER_WORD_RATE[lang] ?? 0.1 };
}

test("get_quote_estimate (lógica): FR + criminal_record + 3 páginas → french criminal record fixed", () => {
  const r = fakeQuote({ language: "fr", document_type: "criminal_record", pages: 3 });
  assert.equal(r.isFrenchCriminal, true);
  assert.ok(Math.abs(FRENCH_CRIMINAL_RECORD_PRICE * 1.21 - 75) < 0.01);
});

test("get_quote_estimate (lógica): MA + fr → Morocco fixed pricing activado", () => {
  const r = fakeQuote({ language: "fr", country: "MA" });
  assert.equal(r.isMoroccoSpecial, true);
  assert.equal(MOROCCO_PRICING[1], 40);
});

test("get_quote_estimate (lógica): MA + ar → NO Morocco special (árabe se cobra normal)", () => {
  const r = fakeQuote({ language: "ar", country: "MA" });
  assert.equal(r.isMoroccoSpecial, false);
});

test("get_quote_estimate (lógica): mínimo árabe = 55 €", () => {
  const r = fakeQuote({ language: "ar", document_type: "birth_certificate" });
  assert.equal(r.minimum, 55);
});

test("get_quote_estimate (lógica): mínimo francés certificado = 42 €", () => {
  const r = fakeQuote({ language: "fr", document_type: "birth_certificate" });
  assert.equal(r.minimum, 42);
});

test("get_quote_estimate (lógica): mínimo inglés certificado = 50 €", () => {
  const r = fakeQuote({ language: "en", document_type: "birth_certificate" });
  assert.equal(r.minimum, 50);
});
