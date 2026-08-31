import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLinesMargin } from "../../lib/learned-rates-math.ts";
import { isFrenchPair } from "../../lib/workflow.ts";

// Misma composicion que hace lib/quote-margin.ts (que no se puede cargar aqui
// por el alias @/): el par decide la exencion, la aritmetica decide el freno.
function checkQuoteLinesMargin(input: { sourceLang: string; targetLang: string; lines: any[] }) {
  return evaluateLinesMargin(input.lines, { isFrench: isFrenchPair(`${input.sourceLang}-${input.targetLang}`) });
}

function line(unitPrice: number, supplierUnitCost: number | null = null, quantity = 1) {
  return { quantity, unitPrice, supplierUnitCost };
}

// Caso real: 2026-00103 (Paula, es->en), 137,94 = 137,94, creado 3 dias despues
// del freno del 28-ago — que solo cubria el auto-presupuesto.
test("precio == coste se frena (caso Paula 2026-00103)", () => {
  const r = checkQuoteLinesMargin({ sourceLang: "es", targetLang: "en", lines: [line(137.94, 137.94)] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.marginCents, 0);
});

test("margen negativo se frena (regateo por debajo del coste guardado)", () => {
  const r = checkQuoteLinesMargin({ sourceLang: "pt", targetLang: "es", lines: [line(140, 165)] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.marginCents < 0);
});

test("margen positivo pero bajo el suelo del 10% se frena", () => {
  const r = checkQuoteLinesMargin({ sourceLang: "de", targetLang: "es", lines: [line(105, 100)] });
  assert.equal(r.ok, false);
});

test("margen sano pasa", () => {
  const r = checkQuoteLinesMargin({ sourceLang: "en", targetLang: "es", lines: [line(120, 95)] });
  assert.equal(r.ok, true);
});

// "Prometemos precio cerrado en frances. En el resto, no" (Juan, 31-ago-2026).
test("FRANCES exento aunque coste == precio: Juan es el traductor", () => {
  assert.equal(checkQuoteLinesMargin({ sourceLang: "fr", targetLang: "es", lines: [line(70, 70)] }).ok, true);
  assert.equal(checkQuoteLinesMargin({ sourceLang: "es", targetLang: "fr", lines: [line(70, 70)] }).ok, true);
  // y con el separador viejo de flecha (bug d0a3c33: fr->es no se reconocia)
  assert.equal(checkQuoteLinesMargin({ sourceLang: "FR", targetLang: "ES", lines: [line(70, 70)] }).ok, true);
});

test("sin coste registrado en ninguna linea, pasa: ausencia de dato no es perdida", () => {
  const r = checkQuoteLinesMargin({ sourceLang: "ro", targetLang: "es", lines: [line(75), line(35, null)] });
  assert.equal(r.ok, true);
});

test("varias lineas: los margenes se compensan sobre el TOTAL", () => {
  // una linea a coste exacto + otra con margen ancho = conjunto sano
  const r = checkQuoteLinesMargin({ sourceLang: "pt", targetLang: "es", lines: [line(93.76, 93.76), line(169.65, 100)] });
  assert.equal(r.ok, true);
});

test("la cantidad multiplica precio y coste", () => {
  const r = checkQuoteLinesMargin({ sourceLang: "it", targetLang: "es", lines: [line(40, 40, 3)] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.costCents, 12000);
});

// --- Guarda de PROCEDENCIA (Juan, 31-ago: "lo más importante") --------------
import { evaluateChannelPrice } from "../../lib/learned-rates-math.ts";

test("no-FR sin precio en el canal: FRENA aunque el margen parezca sano", () => {
  const r = evaluateChannelPrice({ isFrench: false, channelPriceCents: null, costCents: 12000 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "sin_precio_en_canal");
});

test("coste inventado por debajo de lo que pidió el jurado: FRENA", () => {
  // el jurado cotizó 320,00 en el canal; las líneas dicen 285,71 (cliente÷1,12)
  const r = evaluateChannelPrice({ isFrench: false, channelPriceCents: 32000, costCents: 28571 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "coste_bajo_canal");
});

test("coste que cubre el canal: pasa (igual o por encima, con redondeo de 1 cent)", () => {
  assert.equal(evaluateChannelPrice({ isFrench: false, channelPriceCents: 32000, costCents: 32000 }).ok, true);
  assert.equal(evaluateChannelPrice({ isFrench: false, channelPriceCents: 32000, costCents: 31999 }).ok, true);
  assert.equal(evaluateChannelPrice({ isFrench: false, channelPriceCents: 32000, costCents: 35000 }).ok, true);
});

test("no-FR con canal pero SIN coste en líneas: FRENA (0 no cubre nada)", () => {
  const r = evaluateChannelPrice({ isFrench: false, channelPriceCents: 2500, costCents: 0 });
  assert.equal(r.ok, false);
});

test("francés exento de la guarda de canal: el traductor es Juan", () => {
  assert.equal(evaluateChannelPrice({ isFrench: true, channelPriceCents: null, costCents: 0 }).ok, true);
});

// --- Correcciones de la revision del 31-ago (verificadas a mano) -------------

test("el DESCUENTO cuenta: 10% de margen con 10% de descuento auto = margen cero real", () => {
  // builder auto-sugiere 5/10/15% por volumen (StaffExpedienteIntake)
  const lines = [{ quantity: 1, unitPrice: 110, supplierUnitCost: 100 }];
  assert.equal(evaluateLinesMargin(lines, { isFrench: false }).ok, true, "sin descuento pasa");
  const r = evaluateLinesMargin(lines, { isFrench: false, discountCents: 1100 });
  assert.equal(r.ok, false, "con el 10% de descuento el margen real es -1 €");
});

test("redondeo por LINEA, no por unidad: 1000 palabras a 0,095 no inventa 5 euros", () => {
  // por unidad: round(0.095*100)=10 cents x 1000 = 100,00 € (mal, +5)
  // por linea: round(1000*0.095*100)=9500 = 95,00 € (bien)
  const r = evaluateLinesMargin(
    [{ quantity: 1000, unitPrice: 0.095, supplierUnitCost: 0.08 }],
    { isFrench: false }
  );
  assert.equal(r.ok, true);
  const r2 = evaluateLinesMargin(
    [{ quantity: 1000, unitPrice: 0.085, supplierUnitCost: 0.08 }],
    { isFrench: false }
  );
  assert.equal(r2.ok, false, "6,25% de margen real: bajo el suelo");
  if (!r2.ok) assert.equal(r2.priceCents, 8500);
});
