import test from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = process.env.ORDER_TOKEN_SECRET || "test-secret";
import {
  AUTO_SEND_MAX_CENTS,
  buildCierreReminder,
  decideAutoSend,
  decideReminder,
  deduceLostReason,
  hasCostGap,
  hasHumanOpen,
  whatsappNudgeText,
  type AutoSendInput,
  type CostGapOrder,
} from "../../lib/cierre-math.ts";
import { effectiveLostReason, effectiveLostReasonLabel, AUTO_LOST_NOTES } from "../../lib/quote-lost-reasons.ts";
const { generateCierreToken, verifyCierreToken } = await import("../../lib/cierre-token.ts");

const base: AutoSendInput = {
  sourceLang: "de",
  targetLang: "es",
  quoteStatus: "DRAFT",
  sentAt: null,
  sendingAt: null,
  netCents: 12000,
  customerEmail: "ana@example.com",
  customerPhone: null,
  marginDetail: null,
  costMissing: false,
  heldByJuan: false,
  duplicate: null,
  alreadyCustomer: null,
};

/* ───── (a) envío automático ───── */
test("envío automático: margen OK, ≤300 €, no FR, cliente identificado → send", () => {
  assert.deepEqual(decideAutoSend(base), { action: "send" });
});

test("el tope es el del carril directo y el límite exacto sí sale", () => {
  assert.equal(AUTO_SEND_MAX_CENTS, 30000);
  assert.equal(decideAutoSend({ ...base, netCents: 30000 }).action, "send");
  const d = decideAutoSend({ ...base, netCents: 30001 });
  assert.equal(d.action, "alert");
});

test("el freno de margen impide enviar y genera aviso con el motivo", () => {
  const d = decideAutoSend({ ...base, marginDetail: "precio 40 € − coste 40 € = 0 € de margen" });
  assert.equal(d.action, "alert");
  assert.ok(d.action === "alert" && d.reasons[0].includes("freno de margen"));
});

test("par FR (en cualquier sentido) nunca sale solo", () => {
  for (const [s, t] of [["fr", "es"], ["es", "fr"]]) {
    const d = decideAutoSend({ ...base, sourceLang: s, targetLang: t });
    assert.equal(d.action, "alert");
  }
});

test("sin coste en las líneas no se envía (el freno de margen no lo ve)", () => {
  assert.equal(decideAutoSend({ ...base, costMissing: true }).action, "alert");
});

test("cliente solo-WhatsApp o sin identificar: aviso, no envío", () => {
  assert.equal(decideAutoSend({ ...base, customerEmail: "34600111222@whatsapp.local", customerPhone: "+34600111222" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, customerEmail: "", customerPhone: null }).action, "alert");
});

test("guardas: lo llevo yo, duplicado, ya pagó y avisos extra frenan el envío", () => {
  assert.equal(decideAutoSend({ ...base, heldByJuan: true }).action, "alert");
  assert.equal(decideAutoSend({ ...base, duplicate: "otro encargo vivo" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, alreadyCustomer: "presupuesto_pagado Q-1" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, avisos: ["precio anómalo"] }).action, "alert");
});

test("no hay doble envío: un presupuesto ya enviado o en envío se salta sin avisar", () => {
  assert.equal(decideAutoSend({ ...base, quoteStatus: "SENT" }).action, "skip");
  assert.equal(decideAutoSend({ ...base, sentAt: new Date() }).action, "skip");
  assert.equal(decideAutoSend({ ...base, sendingAt: new Date() }).action, "skip");
  // Aunque además no pase el margen: lo ya enviado no genera aviso.
  assert.equal(decideAutoSend({ ...base, quoteStatus: "OPENED", marginDetail: "x" }).action, "skip");
});

/* ───── (b) recordatorio único ───── */
const NOW = new Date("2026-10-08T10:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const rem = { status: "SENT", sentAt: hoursAgo(25), now: NOW, events: [], openedAt: null, customerEmail: "ana@example.com", alreadyReminded: false };

test("recordatorio: a las 24 h sin apertura humana → un email", () => {
  assert.equal(decideReminder(rem), "remind_email");
  assert.equal(decideReminder({ ...rem, sentAt: hoursAgo(23) }), "none");
});

test("recordatorio: nunca más de uno", () => {
  assert.equal(decideReminder({ ...rem, alreadyReminded: true }), "none");
});

test("recordatorio: apertura humana (o openedAt) lo cancela; la vista previa de WhatsApp no cuenta", () => {
  assert.equal(decideReminder({ ...rem, events: [{ userAgent: "Mozilla/5.0 (iPhone) Safari" }] }), "none");
  assert.equal(decideReminder({ ...rem, openedAt: hoursAgo(3) }), "none");
  assert.equal(decideReminder({ ...rem, events: [{ userAgent: "WhatsApp/2.23" }, { userAgent: "facebookexternalhit/1.1" }] }), "remind_email");
  assert.equal(hasHumanOpen([{ userAgent: null }]), true);
});

test("recordatorio: solo-WhatsApp no recibe email, va a la tarea del vigía", () => {
  assert.equal(decideReminder({ ...rem, customerEmail: "34600111222@whatsapp.local" }), "whatsapp_task");
});

test("recordatorio: sólo SENT/OPENED enviados", () => {
  assert.equal(decideReminder({ ...rem, status: "DRAFT" }), "none");
  assert.equal(decideReminder({ ...rem, status: "PAID" }), "none");
  assert.equal(decideReminder({ ...rem, sentAt: null }), "none");
});

test("copy del recordatorio: idioma del presupuesto, enlace /q y pago con tarjeta", () => {
  const payUrl = "https://www.traduccionesjuradas.net/q/abc123";
  const fr = buildCierreReminder({ lang: "fr", name: "Luc", quoteNumber: "2026-00200", payUrl });
  assert.match(fr.subject, /devis/);
  assert.ok(fr.body.includes(payUrl) && fr.body.includes(`${payUrl}?pago=tarjeta`));
  const xx = buildCierreReminder({ lang: "ja", name: "A", quoteNumber: "Q1", payUrl });
  assert.match(xx.subject, /presupuesto/);
  assert.ok(whatsappNudgeText({ lang: "en", name: "Bob", quoteNumber: "Q1", payUrl }).includes(payUrl));
});

/* ───── (c) motivo de pérdida ───── */
test("lostReason: sustituido si pagó otro del mismo encargo (aunque no abriera)", () => {
  assert.equal(deduceLostReason({ replacedByPaid: true, humanOpened: false }), "REPLACED");
  assert.equal(deduceLostReason({ replacedByPaid: true, humanOpened: true }), "REPLACED");
});
test("lostReason: no abierto si nunca lo abrió; abrió y no pagó → sin motivo (tarea de Juan)", () => {
  assert.equal(deduceLostReason({ replacedByPaid: false, humanOpened: false }), "NOT_OPENED");
  assert.equal(deduceLostReason({ replacedByPaid: false, humanOpened: true }), null);
});
test("lostReason efectivo: el humano manda, la marca automática cuenta como motivo", () => {
  assert.equal(effectiveLostReason({ lostReason: "PRICE", lostReasonNote: AUTO_LOST_NOTES.NOT_OPENED }), "PRICE");
  assert.equal(effectiveLostReason({ lostReason: null, lostReasonNote: AUTO_LOST_NOTES.REPLACED }), "REPLACED");
  assert.equal(effectiveLostReason({ lostReason: null, lostReasonNote: "texto libre" }), null);
  assert.match(effectiveLostReasonLabel({ lostReasonNote: AUTO_LOST_NOTES.NOT_OPENED }) || "", /nunca abrió/);
});

/* ───── (c) alarma de coste ───── */
const order: CostGapOrder = { paymentStatus: "PAID", status: "PAID", paidAt: hoursAgo(30), langPair: "de-es", assignedTo: null, supplierCostCents: null, assignments: [] };

test("coste: pagado hace >24 h sin coste ni asignación → alarma", () => {
  assert.equal(hasCostGap(order, NOW), true);
});
test("coste: antes de 24 h no salta", () => {
  assert.equal(hasCostGap({ ...order, paidAt: hoursAgo(23) }, NOW), false);
});
test("coste: supplierCostCents (incluso 0) o asignación ganadora con precio lo cubren", () => {
  assert.equal(hasCostGap({ ...order, supplierCostCents: 0 }, NOW), false);
  assert.equal(hasCostGap({ ...order, supplierCostCents: 4500 }, NOW), false);
  assert.equal(hasCostGap({ ...order, assignments: [{ isWinning: true, status: "ACCEPTED", quotedPriceCents: 3000 }] }, NOW), false);
  assert.equal(hasCostGap({ ...order, assignments: [{ isWinning: false, status: "QUOTED", quotedPriceCents: 3000 }] }, NOW), true);
});
test("coste: francés propio cuenta como coste 0 explícito, no como hueco", () => {
  assert.equal(hasCostGap({ ...order, langPair: "fr-es" }, NOW), false);
  assert.equal(hasCostGap({ ...order, langPair: "es-fr", assignedTo: "Juan Silva" }, NOW), false);
  // Francés asignado a otro traductor sin coste sí es hueco.
  assert.equal(hasCostGap({ ...order, langPair: "fr-es", assignedTo: "Maria" }, NOW), true);
});
test("coste: no pagados o cancelados no cuentan", () => {
  assert.equal(hasCostGap({ ...order, paymentStatus: "PENDING" }, NOW), false);
  assert.equal(hasCostGap({ ...order, status: "CANCELLED" }, NOW), false);
});

/* ───── enlaces firmados ───── */
test("token de cierre: vale para su presupuesto y propósito, y caduca", () => {
  const t = generateCierreToken("q1", 60);
  assert.equal(verifyCierreToken("q1", t), true);
  assert.equal(verifyCierreToken("q2", t), false);
  assert.equal(verifyCierreToken("q1", t, "motivo-PRICE"), false);
  const m = generateCierreToken("q1", 60, "motivo-PRICE");
  assert.equal(verifyCierreToken("q1", m, "motivo-PRICE"), true);
  assert.equal(verifyCierreToken("q1", m, "motivo-OTHER"), false);
  assert.equal(verifyCierreToken("q1", generateCierreToken("q1", -1)), false);
});
