import test from "node:test";
import assert from "node:assert/strict";
import {
  channelPriceToBaseCents,
  directQuoteLines,
  isAnomalousPrice,
  exceedsQuotedCost,
  isDiscardableLeadStatus,
  DOC_FLOOR_CENTS,
} from "../../lib/lavori-directo-math.ts";

// Funnel directo (Juan, 15-sep-2026): el jurado da su cifra en base o en
// líquido a cobrar (base × 1,06); el presupuesto sale con +20 % sobre la base.

test("channelPriceToBaseCents: payable_iva_irpf divide entre 1,06 (Daniela 100 € → base 94,34)", () => {
  assert.equal(channelPriceToBaseCents(10000, "payable_iva_irpf"), 9434);
});

test("channelPriceToBaseCents: base se queda igual", () => {
  assert.equal(channelPriceToBaseCents(10000, "base"), 10000);
});

test("Daniela 62 € payable, 2 docs 100/75 pal: base 5849, Σcost exacto y suelo por doc", () => {
  const base = channelPriceToBaseCents(6200, "payable_iva_irpf");
  assert.equal(base, 5849);
  const lines = directQuoteLines(base, [{ words: 100 }, { words: 75 }]);
  assert.equal(lines.length, 2);
  const sumCost = lines.reduce((a, l) => a + l.costCents, 0);
  assert.equal(sumCost, base, "la suma de costes tiene que ser EXACTA (el último absorbe el redondeo)");
  for (const l of lines) assert.ok(l.clientCents >= DOC_FLOOR_CENTS, "nunca por debajo del suelo de 40 €");
  // Reparto proporcional a palabras (100/175 y 75/175): el primero queda justo
  // por encima del punto donde el suelo deja de mandar (3342 × 1,20 → 4050
  // tras roundUp50); el segundo se queda en el suelo (2507 × 1,20 = 3050 < 4000).
  assert.deepEqual(lines.map((l) => l.costCents), [3342, 2507]);
  assert.deepEqual(lines.map((l) => l.clientCents), [4050, 4000]);
});

test("Morton 10 € base, 1 doc: suelo de 40 € manda", () => {
  const base = channelPriceToBaseCents(1000, "base");
  const lines = directQuoteLines(base, [{ words: 250 }]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].costCents, 1000);
  assert.equal(lines[0].clientCents, 4000);
});

test("Lourdes 140 € base, 1 doc: +20 % ya está por encima del suelo", () => {
  const base = channelPriceToBaseCents(14000, "base");
  const lines = directQuoteLines(base, [{ words: 900 }]);
  assert.equal(lines[0].costCents, 14000);
  assert.equal(lines[0].clientCents, 16800);
});

test("sin palabras en algún documento, reparto a partes iguales", () => {
  const lines = directQuoteLines(9000, [{ words: 500 }, { words: null }]);
  assert.equal(lines[0].costCents, 4500);
  assert.equal(lines[1].costCents, 4500);
  assert.equal(lines[0].costCents + lines[1].costCents, 9000);
});

test("isAnomalousPrice: sin madurez de historial (<3 muestras) nunca es anómalo", () => {
  assert.equal(isAnomalousPrice(50, [10, 12]), false);
  assert.equal(isAnomalousPrice(500, []), false);
});

test("isAnomalousPrice: por encima de 2× la mediana del historial SÍ es anómalo", () => {
  const historial = [8, 9, 10, 11, 12]; // mediana 10
  assert.equal(isAnomalousPrice(20, historial), false, "exactamente 2x no es anómalo");
  assert.equal(isAnomalousPrice(21, historial), true, "por encima de 2x sí");
});

test("exceedsQuotedCost: dentro de la tolerancia de 1 céntimo no excede", () => {
  assert.equal(exceedsQuotedCost(5849, 5849), false);
  assert.equal(exceedsQuotedCost(5850, 5849), false, "1 céntimo de redondeo tolerado");
});

test("exceedsQuotedCost: por encima del coste presupuestado SÍ excede", () => {
  assert.equal(exceedsQuotedCost(5851, 5849), true);
  assert.equal(exceedsQuotedCost(10000, 5849), true, "Daniela sube de 62 € a mucho más tras enviar el presupuesto");
});

test("spreadCents reparte exacto y cae a partes iguales sin pesos", async () => {
  const { spreadCents } = await import("../../lib/lavori-directo-math.ts");
  assert.deepEqual(spreadCents(10000, [1, 1]), [5000, 5000]);
  assert.deepEqual(spreadCents(10000, [3, 1]), [7500, 2500]);
  assert.deepEqual(spreadCents(10001, [1, 1, 1]).reduce((a, b) => a + b, 0), 10001);
  assert.deepEqual(spreadCents(9000, [0, 5]), [4500, 4500]); // un peso vacío → partes iguales
  assert.deepEqual(spreadCents(5000, []), []);
});

test("el precio del motor manda salvo que el margen no dé", async () => {
  const { clientCentsWithMotorPrice } = await import("../../lib/lavori-directo-math.ts");
  // Motor 120 €, coste real 50 € → se respeta el motor (margen de sobra).
  assert.equal(clientCentsWithMotorPrice(12000, 5000), 12000);
  // Motor 55 €, coste 50 € → margen insuficiente: sube a la regla (+20 %, redondeo 50 c).
  assert.equal(clientCentsWithMotorPrice(5500, 5000), 6000);
  // Motor por debajo del suelo de 40 €/doc con coste pequeño → suelo.
  assert.equal(clientCentsWithMotorPrice(2500, 1000), 4000);
  // Sin precio del motor → regla pura.
  assert.equal(clientCentsWithMotorPrice(0, 10000), 12000);
});

// Cifra propuesta al jurado (orden Juan 21-sep-2026): el coste del tarifario
// aprendido, solo si TODOS los documentos tienen tipo y tarifa.
const { proposedCostCents, baseToChannelPriceCents, acceptsNewPrice, acceptanceMatchesPrice, isDirectLeadRequest } = await import("../../lib/lavori-directo-math.ts");
const { buildPriceRequestPayload } = await import("../../lib/lavori-bridge.ts");

const docRate = (costCents: number, wordsRef: number | null = null) => ({ unit: "doc", costCents, wordsRef });

test("proposedCostCents: todos conocidos → suma de costes base (doc + kword)", () => {
  const cents = proposedCostCents(
    [
      { docType: "birth_certificate", words: 200, rate: docRate(3500, 220) },
      { docType: "criminal_record", words: 2000, rate: { unit: "kword", costCents: 4000, wordsRef: null } },
    ],
    "base"
  );
  assert.equal(cents, 3500 + 8000);
});

test("proposedCostCents: un tipo desconocido o sin tarifa → sin cifra", () => {
  const ok = { docType: "birth_certificate", words: 200, rate: docRate(3500) };
  assert.equal(proposedCostCents([ok, { docType: "other", words: 200, rate: docRate(3500) }], "base"), null);
  assert.equal(proposedCostCents([ok, { docType: null, words: 200, rate: docRate(3500) }], "base"), null);
  assert.equal(proposedCostCents([ok, { docType: "diploma", words: 200, rate: null }], "base"), null);
  assert.equal(proposedCostCents([ok, { docType: "diploma", words: 900, rate: docRate(3500, 200) }], "base"), null, "fuera de ±30 % de tamaño");
  assert.equal(proposedCostCents([], "base"), null);
});

test("proposedCostCents: Daniela cotiza en líquido → la base ×1,06, y vuelve a la misma base", () => {
  const cents = proposedCostCents([{ docType: "birth_certificate", words: 150, rate: docRate(9434) }], "payable_iva_irpf");
  assert.equal(cents, 10000);
  assert.equal(channelPriceToBaseCents(cents!, "payable_iva_irpf"), 9434);
  for (const b of [1, 99, 4000, 5849, 12345]) assert.equal(channelPriceToBaseCents(baseToChannelPriceCents(b, "payable_iva_irpf"), "payable_iva_irpf"), b);
});

test("buildPriceRequestPayload: la cifra va en la descripción y en cifraOrientativa, nunca en paraTi", () => {
  const route = { lang: "pt", par: "PT>ES", candidatos: ["nhucqnd3q4znddxhe8qs5c51"] };
  const p = buildPriceRequestPayload({ reference: "LEAD-X", route, documentos: [], cifra: { cents: 4550, tipos: ["certificado de nacimiento"] } });
  assert.equal(p.cifraOrientativa, "45.50");
  assert.match(p.descripcion, /Te proponemos 45,50 € \(lo que se ha pagado antes por certificado de nacimiento\)\. Confírmalo o pasa tu precio\./);
  assert.equal(p.paraTi, undefined);
  assert.equal(p.precioCliente, undefined);
  const sin = buildPriceRequestPayload({ reference: "LEAD-X", route, documentos: [], cifra: null });
  assert.equal(sin.cifraOrientativa, undefined);
  assert.doesNotMatch(sin.descripcion, /Te proponemos/);
});

test("acceptsNewPrice: en el carril directo gana el primer precio; el mismo jurado puede corregir el suyo", () => {
  const d = (priceCents: number | null, miembroId: string | null) => ({ priceCents, miembroId, createdBy: "puerta-directo:retenido" });
  assert.equal(acceptsNewPrice(d(null, null), "cristina"), true);
  assert.equal(acceptsNewPrice(d(5000, "cristina"), "maria-carmen"), false);
  assert.equal(acceptsNewPrice(d(5000, "cristina"), null), false);
  assert.equal(acceptsNewPrice(d(5000, "cristina"), "cristina"), true);
  assert.equal(acceptsNewPrice(d(5000, null), "maria-carmen"), false, "un primer precio sin miembro tampoco se pisa");
});

test("acceptsNewPrice: fuera del carril directo (NL multi, reapertura, one-tap) la última cifra pisa como siempre", () => {
  for (const createdBy of ["puerta-auto", "directo-escalado", "one-tap", null]) {
    assert.equal(acceptsNewPrice({ priceCents: 5000, miembroId: "dolores", createdBy }, "daniela"), true, String(createdBy));
  }
  assert.equal(isDirectLeadRequest("puerta-directo"), true);
  assert.equal(isDirectLeadRequest("directo-escalado"), false);
});

test("acceptanceMatchesPrice: la aceptación de otra jurada no se mezcla con la cifra", () => {
  assert.equal(acceptanceMatchesPrice({ priceCents: 5000, miembroId: "cristina" }, "maria-carmen"), false);
  assert.equal(acceptanceMatchesPrice({ priceCents: 5000, miembroId: "cristina" }, "cristina"), true);
  assert.equal(acceptanceMatchesPrice({ priceCents: null, miembroId: null }, "cristina"), true);
});

test("tarifario al pagar: Daniela base 39,62 → paraTi 42,00 → coste guardado 39,62", async () => {
  const paraTi = baseToChannelPriceCents(3962, "payable_iva_irpf");
  assert.equal(paraTi, 4200);
  assert.equal(channelPriceToBaseCents(paraTi, "payable_iva_irpf"), 3962, "assignLavoriAcceptance divide una sola vez");
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../../lib/workflow-server.ts", import.meta.url), "utf8");
  assert.match(src, /const paraTiCents = baseToChannelPriceCents\(costeBaseCents, priceBasisForMember\(q\?\.lavoriMiembroId\)\)/);
  const assign = await readFile(new URL("../../lib/lavori-assign.ts", import.meta.url), "utf8");
  assert.equal((assign.match(/channelPriceToBaseCents\(/g) || []).length, 1);
});

test("el carril directo nunca envía el presupuesto al cliente (orden Juan 21-sep-2026)", async () => {
  const { readFile } = await import("node:fs/promises");
  const directo = await readFile(new URL("../../lib/lavori-directo.ts", import.meta.url), "utf8");
  const cuerpo = directo.slice(directo.indexOf("export async function autoQuoteFromDirectPrice"), directo.indexOf("export type EscalateStaleDirectResult"));
  const sends = cuerpo.match(/\bsend:\s*[^,\n]+/g) || [];
  assert.deepEqual(sends, ["send: false"]);
  assert.doesNotMatch(cuerpo, /finalizeAndSendQuote/);
  const eventos = await readFile(new URL("../../app/api/lavori/eventos/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(eventos, /puerta-directo:enviado/);
});

test("Daniela: 42 € líquidos se aprenden como 39,62 € de base y la cifra propuesta vuelve a 42 €", async () => {
  const base = channelPriceToBaseCents(4200, "payable_iva_irpf");
  assert.equal(base, 3962);
  assert.equal(proposedCostCents([{ docType: "birth_certificate", words: 150, rate: docRate(base) }], "payable_iva_irpf"), 4200);
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../../lib/learned-rates.ts", import.meta.url), "utf8");
  const cuerpo = src.slice(src.indexOf("export async function learnFromLeadPrice"), src.indexOf("export async function learnFromOrderPrice"));
  assert.match(cuerpo, /channelPriceToBaseCents\(lead\.priceCents, priceBasisForMember\(lead\.miembroId\)\)/);
  const orden = src.slice(src.indexOf("export async function learnFromOrderPrice"), src.indexOf("export async function learnFromPaidQuote"));
  assert.match(orden, /channelPriceToBaseCents\(opts\.priceCents, priceBasisForMember\(opts\.miembroId\)\)/);
});

test("isDiscardableLeadStatus: solo SENT y PRICED se pueden descartar (botón «Descartar»)", () => {
  assert.equal(isDiscardableLeadStatus("SENT"), true);
  assert.equal(isDiscardableLeadStatus("PRICED"), true);
  assert.equal(isDiscardableLeadStatus("ACCEPTED"), false);
  assert.equal(isDiscardableLeadStatus("ESCALATED"), false);
  assert.equal(isDiscardableLeadStatus("DISCARDED"), false, "ya descartada no se vuelve a descartar");
});

test("un precio_propuesto o encargo_aceptado sobre una solicitud DESCARTADA no la reabre (eventos/route.ts)", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../../app/api/lavori/eventos/route.ts", import.meta.url), "utf8");
  assert.match(
    src,
    /lead\.status === "DISCARDED" && \(evento === "precio_propuesto" \|\| evento === "encargo_aceptado"\)/,
    "guardia terminal para DISCARDED, igual que ESCALATED"
  );
});

test("la solicitud directa de PT va solo a Cristina y María Carmen (Juan Amor es respaldo del carril, no directo)", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../../lib/lavori-directo.ts", import.meta.url), "utf8");
  const pt = src.slice(src.indexOf("  pt: {"), src.indexOf("  it: {"));
  assert.match(pt, /nhucqnd3q4znddxhe8qs5c51/);
  assert.match(pt, /1h8tul4zycnayru8bsi1tmu4/);
  assert.doesNotMatch(pt, /rk1x2kq63rm6ba6mco7c6u2k/);
  const puerta = await readFile(new URL("../../app/api/puerta/request-quote/route.ts", import.meta.url), "utf8");
  assert.match(puerta, /candidatos: directos\.map\(\(d\) => d\.miembroId\)/);
});
