import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrice } from "../../lib/pricing-engine/calculator.ts";
import { buildDiagnosis } from "../../lib/diagnosis.ts";
import {
  computePagePricing,
  detectTables,
  clientBaseFromQuote,
  clientUrgentFromQuote,
  dePagePactado,
  isDePageTariffLine,
  isDePageTariffQuote,
} from "../../lib/pricing-engine/page-pricing.ts";
import { clientPriceFromCost } from "../../lib/quote-math.ts";
import { evaluateLinesMargin } from "../../lib/learned-rates-math.ts";
import { isFrenchPair } from "../../lib/workflow.ts";
import { buildSolicitudPayload, LAVORI_CANDIDATES } from "../../lib/lavori-bridge.ts";
import { clientCentsWithMotorPrice } from "../../lib/lavori-directo-math.ts";

// Decisión de Juan, 8-oct-2026: FR→ES 30 € + IVA por página; DE→ES 30 € (35 € con
// tablas) por página, coste de Morton 10 € (15 € con tablas). ES→FR y ES→DE no se tocan.

function analysis(over: {
  type?: string;
  source?: string;
  target?: string;
  pages?: number;
  words?: number;
  tables?: boolean;
  country?: string;
  apostille?: boolean;
}): any {
  return {
    document_type: { category: "civil_registry", specific_type: over.type ?? "birth_certificate", specific_type_es: "Doc", confidence: 1 },
    language: {
      source: over.source ?? "fr",
      source_name: "x",
      target: over.target ?? "es",
      target_name: "y",
      confidence: 1,
    },
    country: { origin: over.country ?? "FR", origin_name: "", issuing_authority: "", confidence: 1 },
    document_metrics: {
      estimated_words: over.words ?? 250,
      pages: over.pages ?? 1,
      has_tables: over.tables ?? false,
      has_stamps_seals: false,
      has_handwriting: false,
      scan_quality: "good",
      is_legible: true,
    },
    extracted_data: { names: [], dates: [], reference_numbers: [], institutions: [], notes: "" },
    complexity: { level: "standard", reasons: [], estimated_hours: 1 },
    requirements: { needs_apostille_translation: false, has_apostille: over.apostille ?? false, has_legalization: false, special_notes: "" },
    warnings: [],
  };
}

const price = (a: any) => calculatePrice(a).basePrice;

// ── FR→ES por página ─────────────────────────────────────────────────

test("FR→ES: 1 página = 30 €, 3 páginas = 90 € (por página del original)", () => {
  assert.equal(price(analysis({ pages: 1 })), 30);
  assert.equal(price(analysis({ pages: 3 })), 90);
  assert.equal(price(analysis({ pages: 2, type: "degree" })), 60);
});

test("mínimo 1 página: pages 0 / null / NaN cobran 30 €", () => {
  assert.equal(price(analysis({ pages: 0 })), 30);
  assert.equal(computePagePricing({ specificType: "birth_certificate", foreignLang: "fr", inbound: true, pages: null })?.priceEur, 30);
  assert.equal(computePagePricing({ specificType: "birth_certificate", foreignLang: "fr", inbound: true, pages: Number.NaN })?.priceEur, 30);
});

test("FR→ES: coste 0 (Juan) y las tablas no suben el precio", () => {
  const p = computePagePricing({ specificType: "transcript", foreignLang: "fr", inbound: true, pages: 2, hasTables: true });
  assert.equal(p?.priceEur, 60);
  assert.equal(p?.costEur, 0);
  assert.equal(p?.tables, false);
});

test("FR→ES: sustituye suelos, apostilla y tarifa de Marruecos en documentos por página", () => {
  assert.equal(price(analysis({ pages: 2, apostille: true })), 60); // antes 55 + 5
  assert.equal(price(analysis({ pages: 1, country: "MA" })), 30); // antes 40 fijo
  assert.equal(calculatePrice(analysis({ pages: 1, apostille: true })).breakdown.apostilleSurcharge, 0);
});

test("FR: el Bulletin n°3 de 3+ páginas conserva el paquete de 61,98 €", () => {
  assert.equal(price(analysis({ type: "criminal_record", pages: 5 })), 61.98);
  assert.equal(price(analysis({ type: "criminal_record", pages: 1 })), 30);
});

test("FR→ES: contrato y texto largo siguen POR PALABRA (suelo FR 35 / 55)", () => {
  const q = calculatePrice(analysis({ type: "contract", pages: 1, words: 200 }));
  assert.equal(q.pagePricing ?? null, null);
  assert.equal(q.basePrice, 35); // mínimo FR de siempre
  assert.equal(price(analysis({ type: "contract", pages: 10, words: 5000 })), 400); // 5000 × 0,08
  assert.equal(price(analysis({ type: "power_of_attorney", pages: 2, words: 300 })), 55);
});

// ── DE→ES por página ─────────────────────────────────────────────────

test("DE→ES sin tablas: 30 €/pág., coste Morton 10 €/pág.", () => {
  const one = calculatePrice(analysis({ source: "de", country: "DE", pages: 1 }));
  assert.equal(one.basePrice, 30);
  assert.equal(one.pagePricing?.costEur, 10);
  const three = calculatePrice(analysis({ source: "de", country: "DE", pages: 3 }));
  assert.equal(three.basePrice, 90);
  assert.equal(three.pagePricing?.costEur, 30);
});

test("DE→ES con tablas: 35 €/pág., coste Morton 15 €/pág.", () => {
  const q = calculatePrice(analysis({ source: "de", country: "DE", type: "birth_certificate", pages: 2, tables: true }));
  assert.equal(q.basePrice, 70);
  assert.equal(q.pagePricing?.costEur, 30);
  assert.equal(q.pagePricing?.tables, true);
});

test("tablas por tipo: transcript / grades / bank_statement las implican; el resto solo si has_tables", () => {
  assert.equal(detectTables({ specificType: "transcript", hasTables: false }), true);
  assert.equal(detectTables({ specificType: "grades" }), true);
  assert.equal(detectTables({ specificType: "bank_statement" }), true);
  assert.equal(detectTables({ specificType: "birth_certificate", hasTables: false }), false);
  assert.equal(detectTables({ specificType: "birth_certificate", hasTables: true }), true);
  const t = calculatePrice(analysis({ source: "de", country: "DE", type: "transcript", pages: 1, tables: false }));
  assert.equal(t.basePrice, 35);
  assert.equal(t.pagePricing?.costEur, 15);
});

test("DE→ES: contrato / escritura siguen por palabra y no llevan tarifa por página", () => {
  const q = calculatePrice(analysis({ source: "de", country: "DE", type: "contract", pages: 4, words: 2000 }));
  assert.equal(q.pagePricing ?? null, null);
  assert.equal(q.basePrice, 240); // 2000 × 0,12 (coste; el cliente paga con margen)
});

test("ES→FR y ES→DE no se tocan: sin tarifa por página", () => {
  const fr = calculatePrice(analysis({ source: "es", target: "fr", pages: 1 }));
  assert.equal(fr.pagePricing ?? null, null);
  assert.equal(fr.basePrice, 35);
  const fr3 = calculatePrice(analysis({ source: "es", target: "fr", pages: 3 }));
  assert.equal(fr3.basePrice, 55);
  const de = calculatePrice(analysis({ source: "es", target: "de", pages: 1 }));
  assert.equal(de.pagePricing ?? null, null);
  assert.equal(de.basePrice, 50); // mínimo de siempre
});

test("otros idiomas (en) no cambian: por palabra con su suelo", () => {
  assert.equal(calculatePrice(analysis({ source: "en", country: "GB", pages: 1 })).pagePricing ?? null, null);
});

// ── Precio cliente: sin margen tiered encima de la tarifa por página ──

test("clientBaseFromQuote: DE por página = 30 (no 39); sin tarifa por página aplica margen", () => {
  const q = calculatePrice(analysis({ source: "de", country: "DE", pages: 1 }));
  assert.equal(clientBaseFromQuote(q, "de"), 30);
  assert.equal(clientUrgentFromQuote(q, "de"), 37.5);
  assert.equal(clientPriceFromCost(30, "de"), 39); // lo que pasaría sin el atajo
  const contract = calculatePrice(analysis({ source: "de", country: "DE", type: "contract", pages: 4, words: 2000 }));
  assert.equal(clientBaseFromQuote(contract, "de"), clientPriceFromCost(contract.basePrice, "de"));
});

test("diagnóstico: DE→ES por página sale al momento (público) a 30 € / 35 € con tablas", () => {
  const a = analysis({ source: "de", country: "DE", pages: 2 });
  const d = buildDiagnosis(a, calculatePrice(a));
  assert.equal(d.publicAutoPriceable, true);
  assert.equal(d.autoPriceable, true);
  assert.equal(d.price.base, 60);
  assert.equal(d.price.total, 72.6);
  assert.equal(d.delivery.hours, 48);
  const at = analysis({ source: "de", country: "DE", pages: 1, tables: true });
  assert.equal(buildDiagnosis(at, calculatePrice(at)).price.base, 35);
});

test("diagnóstico: DE contrato y ES→DE NO salen al momento (siguen a presupuesto humano)", () => {
  const c = analysis({ source: "de", country: "DE", type: "contract", pages: 3, words: 1500 });
  assert.equal(buildDiagnosis(c, calculatePrice(c)).publicAutoPriceable, false);
  const o = analysis({ source: "es", target: "de", pages: 1 });
  assert.equal(buildDiagnosis(o, calculatePrice(o)).publicAutoPriceable, false);
  const en = analysis({ source: "en", country: "GB", pages: 1 });
  assert.equal(buildDiagnosis(en, calculatePrice(en)).publicAutoPriceable, false);
});

test("diagnóstico FR: 30 €/pág. y sigue siendo público", () => {
  const a = analysis({ pages: 3 });
  const d = buildDiagnosis(a, calculatePrice(a));
  assert.equal(d.publicAutoPriceable, true);
  assert.equal(d.price.base, 90);
});

// ── Freno de margen ("nunca puedo perder") ───────────────────────────

const lineOf = (unitPrice: number, supplierUnitCost: number | null) => ({ quantity: 1, unitPrice, supplierUnitCost });
const marginOk = (src: string, tgt: string, lines: any[]) =>
  evaluateLinesMargin(lines, { isFrench: isFrenchPair(`${src}-${tgt}`) }).ok;

test("freno de margen: DE por página (30↔10, 35↔15) no salta en falso", () => {
  assert.equal(marginOk("de", "es", [lineOf(30, 10)]), true);
  assert.equal(marginOk("de", "es", [lineOf(35, 15)]), true);
  assert.equal(marginOk("de", "es", [lineOf(90, 30), lineOf(70, 30)]), true);
});

test("freno de margen: FR con coste 0 o coste marcador (= precio) no sale como margen negativo", () => {
  assert.equal(marginOk("fr", "es", [lineOf(30, null)]), true);
  assert.equal(marginOk("fr", "es", [lineOf(30, 0)]), true);
  assert.equal(marginOk("fr", "es", [lineOf(60, 60)]), true); // marcador: exento por ser francés
  assert.equal(marginOk("es", "fr", [lineOf(35, 35)]), true);
});

test("freno de margen: sigue frenando de verdad en alemán si el coste no cuadra", () => {
  assert.equal(marginOk("de", "es", [lineOf(30, 30)]), false); // coste inventado = precio
  assert.equal(marginOk("de", "es", [lineOf(30, 29)]), false); // 3 % de margen
});

test("línea de tarifa por página DE→ES: reconoce 30n↔10n y 35n↔15n, nada más", () => {
  assert.equal(isDePageTariffLine(30, 10), true);
  assert.equal(isDePageTariffLine(90, 30), true);
  assert.equal(isDePageTariffLine(35, 15), true);
  assert.equal(isDePageTariffLine(70, 30), true);
  assert.equal(isDePageTariffLine(30, 15), false); // mezcla
  assert.equal(isDePageTariffLine(90, 20), false); // páginas distintas
  assert.equal(isDePageTariffLine(40, 12), false);
  assert.equal(isDePageTariffLine(30, 0), false);
  assert.equal(isDePageTariffLine(30, null), false);
});

test("presupuesto de tarifa por página: solo DE→ES y solo si TODAS las líneas con precio lo son", () => {
  const l = (p: number, c: number | null) => ({ quantity: 1, unitPrice: p, supplierUnitCost: c });
  assert.equal(isDePageTariffQuote({ sourceLang: "de", targetLang: "es", lines: [l(30, 10), l(70, 30)] }), true);
  assert.equal(isDePageTariffQuote({ sourceLang: "de", targetLang: "es", lines: [l(30, 10), l(50, 20)] }), false);
  assert.equal(isDePageTariffQuote({ sourceLang: "es", targetLang: "de", lines: [l(30, 10)] }), false);
  assert.equal(isDePageTariffQuote({ sourceLang: "fr", targetLang: "es", lines: [l(30, 10)] }), false);
});

test("suelo de 40 €/doc: no aplica a líneas por página, sí al resto", () => {
  assert.equal(clientCentsWithMotorPrice(3000, 1000), 4000); // con suelo
  assert.equal(clientCentsWithMotorPrice(3000, 1000, 0), 3000); // sin suelo (tarifa por página)
  assert.equal(clientCentsWithMotorPrice(3000, 1500, 0), 3000); // 30 vs +20 % de 15 = 18
  assert.equal(clientCentsWithMotorPrice(3500, 1500, 0), 3500);
});

// ── Encargo a Morton con precio pactado ──────────────────────────────

test("dePagePactado: paraTi = páginas × 10 (15 con tablas)", () => {
  const doc = (over: any = {}) => ({ specificType: "birth_certificate", sourceLang: "de", pages: 1, hasTables: false, ...over });
  assert.deepEqual(dePagePactado([doc({ pages: 3 })]), { costCents: 3000, priceCents: 9000, pages: 3, tablePages: 0 });
  assert.deepEqual(dePagePactado([doc({ hasTables: true, pages: 2 })]), { costCents: 3000, priceCents: 7000, pages: 2, tablePages: 2 });
  assert.deepEqual(dePagePactado([doc(), doc({ specificType: "transcript", pages: 2 })]), { costCents: 4000, priceCents: 10000, pages: 3, tablePages: 2 });
});

test("dePagePactado: sin pactado si algún documento no es DE→ES por página", () => {
  const doc = (over: any = {}) => ({ specificType: "birth_certificate", sourceLang: "de", pages: 1, hasTables: false, ...over });
  assert.equal(dePagePactado([]), null);
  assert.equal(dePagePactado([doc({ sourceLang: "fr" })]), null); // FR es de Juan, nunca va a Morton
  assert.equal(dePagePactado([doc({ sourceLang: "es" })]), null);
  assert.equal(dePagePactado([doc({ specificType: "contract" })]), null);
  assert.equal(dePagePactado([doc(), doc({ specificType: "contract" })]), null);
});

test("encargo a Morton: payload dirigido con paraTi = coste por página y precioCliente = venta neta", () => {
  const morton = LAVORI_CANDIDATES.de[0];
  const pactado = dePagePactado([{ specificType: "transcript", sourceLang: "de", pages: 2, hasTables: true }]);
  assert.ok(pactado);
  // El pedido pagó 70 € + 21 % de IVA = 84,70 €.
  const payload = buildSolicitudPayload({
    reference: "26_TEST01",
    route: { lang: "de", par: "DE>ES", candidatos: [morton] },
    amountCents: 8470,
    documentos: [],
    paraTiCents: pactado.costCents,
  });
  assert.equal(payload.paraTi, "30.00");
  assert.equal(payload.precioCliente, "70.00");
  assert.deepEqual(payload.candidatos, [morton]);
  assert.equal(payload.par, "DE>ES");
  assert.equal(payload.ref, "26_TEST01"); // ref SIN sufijo: carril pagado, no solicitud de precio
});
