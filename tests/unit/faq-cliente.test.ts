import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAQ_CLIENTE, FAQ_FIXED, FAQ_LANGS, FROM_PRICE, faqConserjeBlock, faqItems, faqPromptBlock } from "../../lib/knowledge/faq-cliente.ts";
import { CONSERJE_SYSTEM, NO_PRICE, hasMoney } from "../../lib/entrada/conserje.ts";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const SYSTEM_SRC = read("lib/chat/system-prompt.ts");
const CONSERJE_SRC = read("lib/entrada/conserje.ts");
const PAGE_SRC = read("app/preguntas-frecuentes/page.tsx");

test("every entry exists in the five languages with the fixed data", () => {
  for (const e of FAQ_CLIENTE) for (const l of FAQ_LANGS) {
    assert.ok(e.q[l].length > 5 && e.a[l].length > 20, `${e.id}/${l}`);
  }
  const by = (id: string) => FAQ_CLIENTE.find((e) => e.id === id)!;
  assert.match(by("firma").a.es, /valide\.redsara\.es/);
  assert.match(by("firma").a.es, /\/blog\/comprobar-firma-electronica-traduccion-jurada/);
  assert.match(by("oficial").a.es, /3850/);
  assert.match(by("presencial").a.es, /100 % online/);
  assert.match(by("caducado").a.es, /15 días/);
  assert.match(by("pagos").a.es, /tarjeta.*transferencia.*Bizum/);
  assert.match(by("plazos").a.es, /5 páginas.*1 día hábil/);
  assert.equal(FAQ_FIXED.whatsapp, "+34 951 333 614");
});

test("the three consumers read the knowledge file", () => {
  assert.match(SYSTEM_SRC, /faqPromptBlock\(\)/);
  assert.match(CONSERJE_SRC, /faqConserjeBlock\(\)/);
  assert.match(PAGE_SRC, /faqItems\(/);
  assert.match(PAGE_SRC, /<SchemaFAQ[^>]*items=\{FAQ_ITEMS\}/);
  assert.ok(CONSERJE_SYSTEM.includes(faqConserjeBlock()));
  assert.equal(faqItems("es").length, FAQ_CLIENTE.length);
  assert.ok(faqPromptBlock().includes(FAQ_CLIENTE[0].a.es));
});

test("no consumer text keeps the old promises", () => {
  const banned = [/24\s*[-–/]\s*48\s*h/i, /\+\s*40\s*%/, /\+\s*25\s*%/, /Esperanto/, /24 horas desde la confirmación/];
  const texts = [
    SYSTEM_SRC, CONSERJE_SRC, PAGE_SRC, CONSERJE_SYSTEM, faqPromptBlock(), faqConserjeBlock(),
    ...FAQ_LANGS.flatMap((l) => faqItems(l).map((i) => `${i.question} ${i.answer}`)),
  ];
  for (const t of texts) for (const b of banned) assert.doesNotMatch(t, b);
});

test("the concierge never gets prices beyond «desde 30 € + IVA»", () => {
  assert.doesNotMatch(faqConserjeBlock(), /€|euros?\b/i);
  for (const l of FAQ_LANGS) {
    assert.equal(hasMoney(NO_PRICE[l]), false);
    assert.ok(NO_PRICE[l].includes(FROM_PRICE[l]));
  }
  assert.equal(hasMoney("Cuesta 45 € + IVA"), true);
  assert.equal(hasMoney(`Es ${FROM_PRICE.es} y luego el presupuesto`), false);
});
