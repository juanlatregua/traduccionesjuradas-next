import test from "node:test";
import assert from "node:assert/strict";
import { autoSendAt, autoenvio150On, autoenvioHourOk, autoenvioVerdict, type AutoenvioInput } from "../../lib/autoenvio-150-core.ts";
import { decideAutoSend, type AutoSendInput } from "../../lib/cierre-math.ts";
import { generateCierreToken, verifyCierreToken } from "../../lib/cierre-token.ts";

const NOW = new Date("2026-11-21T11:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60000);
const input = (o: Partial<AutoenvioInput> = {}, q: Partial<AutoenvioInput["quote"]> = {}): AutoenvioInput => ({
  now: NOW,
  quote: {
    status: "DRAFT", sentAt: null, sendingAt: null, deletedAt: null, sourceLang: "en", targetLang: "es", adminCreatedBy: "system:tarifario", autoPricedBy: "tarifario",
    createdAt: ago(140), updatedAt: ago(140), customerEmail: "ana@x.com", ...q,
  },
  lines: [{ quantity: 1, unitPrice: 60, supplierUnitCost: 40 }],
  discountCents: 0,
  leadAt: ago(151),
  consent: true,
  readingDoubt: null,
  otherLive: null,
  claimed: false,
  carrilReasons: [],
  retained: false,
  carrilOn: { ok: true },
  rateApproved: null,
  guards: { action: "send" },
  ...o,
});

test("flag: solo «on» exacto (apagado = hoy, nada sale)", () => {
  assert.equal(autoenvio150On({}), false);
  assert.equal(autoenvio150On({ AUTOENVIO_150: "true" }), false);
  assert.equal(autoenvio150On({ AUTOENVIO_150: "on" }), true);
});

test("franja 08-22 Madrid", () => {
  assert.equal(autoenvioHourOk(7), false);
  assert.equal(autoenvioHourOk(8), true);
  assert.equal(autoenvioHourOk(21), true);
  assert.equal(autoenvioHourOk(22), false);
});

test("todo en verde a los 150 min: sale, con la procedencia de su carril", () => {
  assert.deepEqual(autoenvioVerdict(input()), { action: "send", channel: "learned-rate" });
  assert.deepEqual(autoenvioVerdict(input({}, { adminCreatedBy: "system:encargo-cerrado", autoPricedBy: "encargo-cerrado" })), { action: "send", channel: "lavori-directo" });
  assert.deepEqual(autoenvioVerdict(input({}, { adminCreatedBy: "system:lavori-directo", autoPricedBy: "lavori-directo" })), { action: "send", channel: "lavori-directo" });
});

test("ventana: antes de 150 min espera; pasadas 24 h ya no", () => {
  assert.equal(autoenvioVerdict(input({ leadAt: ago(149) })).action, "wait");
  assert.equal(autoenvioVerdict(input({ leadAt: ago(150) })).action, "send");
  assert.equal(autoenvioVerdict(input({ leadAt: ago(24 * 60 + 1) })).action, "ignore");
  assert.equal(autoenvioVerdict(input({ leadAt: null })).action, "hold");
});

test("nunca dos veces ni lo que no es borrador", () => {
  assert.equal(autoenvioVerdict(input({ claimed: true })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { status: "SENT" })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { sentAt: ago(1) })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { sendingAt: ago(1) })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { deletedAt: ago(1) })).action, "ignore");
});

test("fuera de alcance: francés y borradores del constructor/estimador", () => {
  assert.equal(autoenvioVerdict(input({}, { sourceLang: "fr" })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { sourceLang: "es", targetLang: "fr" })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { adminCreatedBy: "juan@traduccionesjuradas.net" })).action, "ignore");
  assert.equal(autoenvioVerdict(input({}, { adminCreatedBy: "system:estimador" })).action, "ignore");
});

const held = (i: AutoenvioInput) => {
  const v = autoenvioVerdict(i);
  assert.equal(v.action, "hold");
  return (v as { reasons: string[] }).reasons.join(" | ");
};

test("guardas: cada una deja el borrador quieto con su motivo", () => {
  assert.match(held(input({}, { updatedAt: ago(100) })), /tocado/);
  assert.match(held(input({}, { autoPricedBy: null })), /procedencia/);
  assert.match(held(input({ lines: [{ quantity: 1, unitPrice: 60, supplierUnitCost: 56 }] })), /margen/);
  assert.match(held(input({ lines: [{ quantity: 1, unitPrice: 60, supplierUnitCost: null }] })), /sin coste/);
  assert.match(held(input({ lines: [{ quantity: 1, unitPrice: 310, supplierUnitCost: 200 }] })), /300 €/);
  assert.match(held(input({}, { customerEmail: "600111222@whatsapp.local" })), /sin email/);
  assert.match(held(input({ consent: false })), /consentimiento/);
  assert.match(held(input({ readingDoubt: "fiscal_financial" })), /lectura dudosa/);
  assert.match(held(input({ otherLive: "ya hay otro presupuesto enviado (Q2)" })), /otro presupuesto/);
  assert.match(held(input({ guards: { action: "alert", reasons: ["el cliente ya pagó"] } })), /ya pagó/);
  assert.equal(autoenvioVerdict(input({ lines: [{ quantity: 1, unitPrice: 44, supplierUnitCost: 40 }] })).action, "send", "10 % justo pasa");
  assert.equal(autoenvioVerdict(input({ lines: [{ quantity: 1, unitPrice: 300, supplierUnitCost: 200 }] })).action, "send", "300 € justos pasan");
});

test("el borrador debe llevar ≥60 min creado además de los 150 min desde la llegada", () => {
  assert.equal(autoenvioVerdict(input({ leadAt: ago(200) }, { createdAt: ago(59), updatedAt: ago(59) })).action, "wait");
  assert.equal(autoenvioVerdict(input({ leadAt: ago(200) }, { createdAt: ago(60), updatedAt: ago(60) })).action, "send");
  assert.equal(autoSendAt(ago(200), ago(10)).getTime(), ago(-50).getTime());
  assert.equal(autoSendAt(ago(100), ago(90)).getTime(), ago(-50).getTime());
});

test("retenciones del carril (cierre/lavori-directo): cada una impide el autoenvío", () => {
  for (const r of [
    "cierre: precio de Daniela anómalo frente a su historial (9.00 cent./palabra)",
    "cierre: Daniela no puede recibir el encargo ahora: de vacaciones",
    "cierre: ya hay otro encargo vivo para estos documentos (LEAD-1, SENT)",
    "cierre: el par de la solicitud (DE>ES) no coincide con el del presupuesto (en>es)",
    "tarifario: 130.00 € con IVA superan el tope de envío solo",
    "encargo-cerrado: el cliente ya habló",
  ]) assert.match(held(input({ carrilReasons: [r] })), new RegExp(r.slice(0, 20).replace(/[()]/g, ".")));
  assert.match(held(input({ retained: true })), /retenido por Juan/);
});

test("guardas del cierre recalculadas con la solicitud real: lo llevo yo, duplicado y par distinto", () => {
  const base: AutoSendInput = { sourceLang: "en", targetLang: "es", quoteStatus: "DRAFT", sentAt: null, sendingAt: null, netCents: 6000, customerEmail: "ana@x.com", customerPhone: null, marginDetail: null, costMissing: false, heldByJuan: false, duplicate: null, alreadyCustomer: null };
  assert.equal(decideAutoSend(base).action, "send");
  for (const extra of [{ heldByJuan: true }, { duplicate: "ya hay otro encargo vivo para estos documentos (LEAD-2, SENT)" }, { leadPar: "DE>ES" }] as Partial<AutoSendInput>[]) {
    const g = decideAutoSend({ ...base, ...extra });
    assert.equal(g.action, "alert");
    assert.equal(autoenvioVerdict(input({ guards: g as AutoenvioInput["guards"] })).action, "hold");
  }
});

test("interruptores de rodaje del carril y tarifa que dejó de estar APPROVED", () => {
  assert.match(held(input({ carrilOn: { ok: false, reason: "rodaje: LEARNED_RATES_AUTOSEND apagado o tarifario no vivo" } })), /LEARNED_RATES_AUTOSEND/);
  assert.match(held(input({ carrilOn: { ok: false, reason: "rodaje: ENCARGO_CERRADO_AUTOSEND apagado" } }, { adminCreatedBy: "system:encargo-cerrado", autoPricedBy: "encargo-cerrado" })), /ENCARGO_CERRADO_AUTOSEND/);
  assert.match(held(input({ rateApproved: false })), /APPROVED/);
  assert.equal(autoenvioVerdict(input({ rateApproved: true })).action, "send");
});

test("enlace «Retener»: firmado por presupuesto y propósito, no vale para otro", () => {
  process.env.ORDER_TOKEN_SECRET = process.env.ORDER_TOKEN_SECRET || "test-secret";
  const t = generateCierreToken("Q1", 3600, "autoenvio-retener");
  assert.equal(verifyCierreToken("Q1", t, "autoenvio-retener"), true);
  assert.equal(verifyCierreToken("Q2", t, "autoenvio-retener"), false);
  assert.equal(verifyCierreToken("Q1", t, "revisar"), false);
});
