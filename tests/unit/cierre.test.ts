import test from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = process.env.ORDER_TOKEN_SECRET || "test-secret";
import {
  AUTO_SEND_MAX_CENTS,
  buildCierreReminder,
  decideAutoSend,
  decideFollowUp,
  normalizePair,
  NO_RESPONSE_NOTE,
  deduceLostReason,
  hasCostGap,
  groupedInvoiceCovers,
  hasHumanOpen,
  linkedExpenseFor,
  isOwnTranslator,
  needsSupplierCost,
  parseEurToCents,
  sameTranslatorExact,
  whatsappNudgeText,
  type AutoSendInput,
  type ColabExpense,
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

/* ───── (a bis) par del lead ≠ par del presupuesto ───── */
test("par: coincide (DE>ES vs de/es) → send; distinto o ilegible → solo aviso", () => {
  assert.deepEqual(decideAutoSend({ ...base, leadPar: "DE>ES" }), { action: "send" });
  const d = decideAutoSend({ ...base, leadPar: "NL>ES" });
  assert.equal(d.action, "alert");
  assert.match((d as { reasons: string[] }).reasons.join("|"), /no coincide/);
  assert.equal(decideAutoSend({ ...base, leadPar: "ES>DE" }).action, "alert", "el sentido importa");
  assert.equal(decideAutoSend({ ...base, leadPar: "???" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, leadPar: "DE>ES", sourceLang: null }).action, "alert");
  assert.equal(normalizePair("de→es"), "de>es");
  assert.equal(normalizePair("DE", "ES"), "de>es");
});

/* ───── (b) segundo contacto a las 24 h y cierre suave ───── */
const NOW = new Date("2026-10-09T10:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const fu = { status: "SENT", sentAt: hoursAgo(25), now: NOW, events: [], openedAt: null, customerEmail: "ana@example.com", reminderSentAt: null, reminderSkipped: false, lastFailedAt: null };

test("2º contacto: a las 24 h sin apertura → email «¿lo recibiste?»; antes de 24 h nada", () => {
  assert.deepEqual(decideFollowUp(fu), { action: "remind_email", opened: false });
  assert.equal(decideFollowUp({ ...fu, sentAt: hoursAgo(23) }).action, "none");
});

test("2º contacto: lo abrió (OPENED, openedAt o apertura humana) o aceptó → también, con texto de ayuda", () => {
  assert.deepEqual(decideFollowUp({ ...fu, status: "OPENED" }), { action: "remind_email", opened: true });
  assert.deepEqual(decideFollowUp({ ...fu, openedAt: hoursAgo(3) }), { action: "remind_email", opened: true });
  assert.deepEqual(decideFollowUp({ ...fu, events: [{ userAgent: "Mozilla/5.0 (iPhone) Safari" }] }), { action: "remind_email", opened: true });
  assert.deepEqual(decideFollowUp({ ...fu, events: [{ userAgent: "WhatsApp/2.23" }, { userAgent: "facebookexternalhit/1.1" }] }), { action: "remind_email", opened: false });
  assert.equal(hasHumanOpen([{ userAgent: null }]), true);
});

test("2º contacto: nunca dos; no a quien pagó ni a quien ya es cliente", () => {
  assert.equal(decideFollowUp({ ...fu, reminderSentAt: hoursAgo(2) }).action, "none");
  assert.equal(decideFollowUp({ ...fu, paidAt: hoursAgo(1) }).action, "none");
  assert.equal(decideFollowUp({ ...fu, reminderSkipped: true }).action, "none");
  assert.equal(decideFollowUp({ ...fu, reminderSkipped: true, reminderSentAt: hoursAgo(30) }).action, "none", "ya cliente: ni se cierra");
  for (const status of ["DRAFT", "ACCEPTED", "PAID", "EXPIRED", "IN_PROGRESS"]) assert.equal(decideFollowUp({ ...fu, status }).action, "none");
  assert.equal(decideFollowUp({ ...fu, sentAt: null }).action, "none");
});

test("2º contacto: un FAILED de las últimas 20 h frena el reintento (cron 4×/día); pasado ese margen se reintenta", () => {
  assert.equal(decideFollowUp({ ...fu, lastFailedAt: hoursAgo(6) }).action, "none");
  assert.equal(decideFollowUp({ ...fu, lastFailedAt: hoursAgo(19) }).action, "none");
  assert.equal(decideFollowUp({ ...fu, lastFailedAt: hoursAgo(21) }).action, "remind_email");
  // Simulación de las 4 ejecuciones del día tras un fallo: solo la primera intenta.
  let failedAt: Date | null = null;
  let attempts = 0;
  for (const h of [0, 6, 12, 18]) {
    const now = new Date(NOW.getTime() + h * 3_600_000);
    const d = decideFollowUp({ ...fu, now, sentAt: new Date(now.getTime() - 25 * 3_600_000), lastFailedAt: failedAt });
    if (d.action === "remind_email") { attempts++; failedAt = now; }
  }
  assert.equal(attempts, 1);
});

test("cierre suave: 24 h después del 2º contacto sin pago → close (no antes)", () => {
  assert.equal(decideFollowUp({ ...fu, sentAt: hoursAgo(49), reminderSentAt: hoursAgo(25) }).action, "close");
  assert.equal(decideFollowUp({ ...fu, sentAt: hoursAgo(49), reminderSentAt: hoursAgo(23) }).action, "none");
  assert.equal(decideFollowUp({ ...fu, status: "OPENED", sentAt: hoursAgo(49), reminderSentAt: hoursAgo(25) }).action, "close");
  assert.equal(decideFollowUp({ ...fu, sentAt: hoursAgo(49), reminderSentAt: hoursAgo(25), paidAt: hoursAgo(1) }).action, "none", "pagó: no se cierra");
  assert.equal(NO_RESPONSE_NOTE, "auto:sin_respuesta");
});

test("solo-WhatsApp: tarea del vigía a las 24 h abra o no el presupuesto; nunca email", () => {
  const wa = { ...fu, customerEmail: "34600111222@whatsapp.local" };
  assert.deepEqual(decideFollowUp(wa), { action: "whatsapp_task", opened: false });
  assert.deepEqual(decideFollowUp({ ...wa, status: "OPENED" }), { action: "whatsapp_task", opened: true });
  assert.equal(decideFollowUp({ ...wa, sentAt: hoursAgo(23) }).action, "none");
});

test("solo-WhatsApp: sin constancia del 2º contacto NO se cierra solo, por antiguo que sea", () => {
  const wa = { ...fu, customerEmail: "34600111222@whatsapp.local" };
  assert.equal(decideFollowUp({ ...wa, sentAt: hoursAgo(200) }).action, "whatsapp_task");
  assert.equal(decideFollowUp({ ...wa, sentAt: hoursAgo(200), status: "OPENED" }).action, "whatsapp_task");
});

test("solo-WhatsApp: con «Ya lo traté» (WhatsApp enviado) se cierra 24 h después, no antes", () => {
  const wa = { ...fu, customerEmail: "34600111222@whatsapp.local", sentAt: hoursAgo(60) };
  assert.equal(decideFollowUp({ ...wa, reminderSentAt: hoursAgo(25) }).action, "close");
  assert.equal(decideFollowUp({ ...wa, reminderSentAt: hoursAgo(5) }).action, "none");
});

test("reloj: un reenvío del enlace reinicia las 24 h (el llamador pasa sentAt = último envío)", () => {
  assert.equal(decideFollowUp({ ...fu, sentAt: hoursAgo(10) }).action, "none");
  assert.equal(decideFollowUp({ ...fu, sentAt: hoursAgo(25) }).action, "remind_email");
});

test("etiqueta: auto:sin_respuesta se muestra como cerrado sin respuesta aunque lostReason sea NO_LONGER_NEEDED", () => {
  const q = { lostReason: "NO_LONGER_NEEDED", lostReasonNote: NO_RESPONSE_NOTE };
  assert.equal(effectiveLostReason(q), "NO_RESPONSE");
  assert.match(effectiveLostReasonLabel(q) || "", /Cerrado sin respuesta/);
  assert.equal(effectiveLostReason({ lostReason: "PRICE", lostReasonNote: "caro" }), "PRICE");
});

test("copy WhatsApp 2º contacto abierto: «terminar» con pago directo", () => {
  const payUrl = "https://www.traduccionesjuradas.net/q/abc";
  assert.match(whatsappNudgeText({ lang: "es", name: "Ana", quoteNumber: "Q1", payUrl, opened: true }), /terminar/);
  assert.ok(whatsappNudgeText({ lang: "fr", name: "Ana", quoteNumber: "Q1", payUrl, opened: true }).includes("pago=tarjeta"));
  assert.doesNotMatch(whatsappNudgeText({ lang: "es", name: "Ana", quoteNumber: "Q1", payUrl }), /terminar/);
});

test("copy del 2º contacto: abierto → «te ayudo a terminar» con enlace de pago directo, en el idioma", () => {
  const payUrl = "https://www.traduccionesjuradas.net/q/abc123";
  const es = buildCierreReminder({ lang: "es", name: "Ana", quoteNumber: "Q1", payUrl, opened: true });
  assert.match(es.body, /terminar/);
  assert.ok(es.body.includes(`${payUrl}?pago=tarjeta`));
  assert.doesNotMatch(buildCierreReminder({ lang: "es", name: "Ana", quoteNumber: "Q1", payUrl }).body, /terminar/);
  for (const lang of ["fr", "en", "de", "pt", "it"]) {
    const o = buildCierreReminder({ lang, name: "X", quoteNumber: "Q1", payUrl, opened: true });
    assert.ok(o.body.includes("pago=tarjeta"), lang);
    assert.notEqual(o.body, buildCierreReminder({ lang, name: "X", quoteNumber: "Q1", payUrl }).body, lang);
  }
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
  // Juan Amor es jurado ajeno: sin coste es hueco aunque se llame Juan.
  assert.equal(hasCostGap({ ...order, langPair: "fr-es", assignedTo: "Juan Amor" }, NOW), true);
});

test("coste: pedidos FR antiguos con «Juan» a secas o con el nombre de la ficha no son hueco", () => {
  assert.equal(hasCostGap({ ...order, langPair: "fr-es", assignedTo: "Juan" }, NOW), false);
  assert.equal(hasCostGap({ ...order, langPair: "de-es", assignedTo: "Juan" }, NOW), true, "fuera del francés sí");
  assert.equal(hasCostGap({ ...order, langPair: "fr-es", assignedTo: "J. Silva" }, NOW, ["J. Silva"]), false);
  assert.equal(hasCostGap({ ...order, langPair: "fr-es", assignedTo: "J. Silva" }, NOW), true);
});

test("cambio de traductor: igualdad exacta de nombre, no por tokens", () => {
  assert.equal(sameTranslatorExact("Juan Amor", "juan  amor"), true);
  assert.equal(sameTranslatorExact("Juan", "Juan Amor"), false);
  assert.equal(sameTranslatorExact("Daniela", "Daniela Cleintuar"), false);
  assert.equal(sameTranslatorExact("", ""), false);
});

test("traductor propio: solo Juan Silva, nunca Juan Amor", () => {
  // Valores reales de Order.assignedTo (BD, 90 días): «Juan Silva Moreno», «Juan Amor», «Juan Amor Fernández».
  for (const n of ["Juan Silva", "Juan Silva Moreno", " juan  silva moreno "]) assert.equal(isOwnTranslator(n), true, n);
  for (const n of ["Juan Amor", "Juan Amor Fernández", "Juan Latregua (EN)", "Juan", "Maria", "", null]) assert.equal(isOwnTranslator(n), false, String(n));
  // La ficha de BD (por email) manda: si Juan figura con otro nombre, también es propio.
  assert.equal(isOwnTranslator("J. Silva", ["J. Silva"]), true);
  assert.equal(isOwnTranslator("Juan Amor", ["Juan Silva Moreno"]), false);
});

test("asignar exige coste: jurado ajeno sin cifra sí; FR propio, vacío o con cifra no", () => {
  const b = { translator: "Daniela Pop", langPair: "ro->es", supplierCostCents: null };
  assert.equal(needsSupplierCost(b), true);
  assert.equal(needsSupplierCost({ ...b, translator: "  " }), false, "quitar asignación no pide coste");
  assert.equal(needsSupplierCost({ ...b, supplierCostCents: 0 }), false, "0 es coste explícito");
  assert.equal(needsSupplierCost({ ...b, supplierCostCents: 4500 }), false);
  assert.equal(needsSupplierCost({ ...b, winningPriceCents: 3000 }), false);
  assert.equal(needsSupplierCost({ ...b, translator: "Juan Silva Moreno", langPair: "fr->es" }), false);
  assert.equal(needsSupplierCost({ ...b, translator: "Juan Silva", langPair: "es-fr" }), false);
  assert.equal(needsSupplierCost({ ...b, translator: "Juan Amor", langPair: "pt->es" }), true, "Juan Amor necesita coste");
  assert.equal(needsSupplierCost({ ...b, translator: "Juan Amor", langPair: "fr->es" }), true);
  assert.equal(needsSupplierCost({ ...b, translator: "Juan Silva", langPair: "en->es" }), true, "fuera del francés no es coste propio");
});

test("reasignar X→Y: el coste de X no vale para Y", () => {
  const b = { translator: "Daniela Cleintuar", langPair: "ro->es", supplierCostCents: 4000 };
  assert.equal(needsSupplierCost({ ...b, previousTranslator: "Maria Murariu Ursu" }), true);
  assert.equal(needsSupplierCost({ ...b, previousTranslator: "Daniela Cleintuar" }), false, "mismo traductor: su coste vale");
  assert.equal(needsSupplierCost({ ...b, previousTranslator: "daniela  cleintuar" }), false, "mismo nombre normalizado");
  assert.equal(needsSupplierCost({ ...b, previousTranslator: "Daniela" }), true, "nombre distinto: se pide cifra (lado seguro)");
  assert.equal(needsSupplierCost({ ...b, previousTranslator: null }), false, "sin traductor previo: el coste del pedido vale");
  assert.equal(needsSupplierCost({ ...b, previousTranslator: "Maria Murariu Ursu", winningPriceCents: 3500 }), false, "Y ya tiene precio ganador");
  assert.equal(needsSupplierCost({ ...b, translator: "Juan Silva Moreno", langPair: "fr->es", previousTranslator: "Inge Luken" }), false, "a FR propio no pide coste");
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

test("ACCEPTED (cliente en el pago): ni 2º contacto ni cierre suave aunque pasen las horas", () => {
  assert.equal(decideFollowUp({ ...fu, status: "ACCEPTED" }).action, "none");
  assert.equal(decideFollowUp({ ...fu, status: "ACCEPTED", reminderSentAt: hoursAgo(48) }).action, "none");
});

test("coste en euros del formulario → céntimos", () => {
  assert.equal(parseEurToCents("45,50"), 4550);
  assert.equal(parseEurToCents(" 30 € "), 3000);
  assert.equal(parseEurToCents(12.345), 1235);
  assert.equal(parseEurToCents("0"), 0);
  for (const v of ["", "  ", null, undefined, "abc", -5]) assert.equal(parseEurToCents(v), null, String(v));
});

const exp = (o: Partial<ColabExpense>): ColabExpense => ({ orderReference: null, isAccrual: false, concept: "", supplier: null, baseCents: 1000, date: new Date("2026-10-05"), ...o });

test("linkedExpenseFor: coste por orderReference o por la ref en el concepto de la factura; la factura manda sobre el devengo", () => {
  const inv = exp({ concept: "Factura Vanessa Bech · 3 encargo(s): 26_388DD7, 26_213E8E, 26_4A0ABA", supplier: "Vanessa Bech" });
  assert.equal(linkedExpenseFor("26_4A0ABA", [inv])?.supplier, "Vanessa Bech");
  assert.equal(linkedExpenseFor("26_OTRO00", [inv]), null);
  const acc = exp({ orderReference: "26_388DD7", isAccrual: true, baseCents: 6200 });
  const fin = exp({ orderReference: "26_388DD7", baseCents: 6000 });
  assert.equal(linkedExpenseFor("26_388DD7", [acc, fin])?.baseCents, 6000);
  assert.equal(linkedExpenseFor("26_388DD7", [acc])?.baseCents, 6200);
  assert.equal(linkedExpenseFor("26_388DD7", [exp({ orderReference: "26_388DD7", isAccrual: true, concept: "x" })].slice(0, 0)), null);
});

test("groupedInvoiceCovers: factura del mes sin refs de su sociedad cubre pedidos pagados antes; con refs ajenas o antes del pago no", () => {
  const grouped = exp({ concept: "Factura Montemar25 215/2026 · 5 encargos de septiembre", supplier: "Montemar25 Traducciones, S.L." });
  const o = { assignedTo: "Juan Amor", paidAt: new Date("2026-09-12") };
  assert.equal(groupedInvoiceCovers(o, [grouped], ["Juan Amor Fernández", "Montemar25 Traducciones, S.L."]), true);
  assert.equal(groupedInvoiceCovers(o, [grouped], []), false);
  assert.equal(groupedInvoiceCovers({ ...o, paidAt: new Date("2026-10-06") }, [grouped], ["Montemar25 Traducciones, S.L."]), false);
  assert.equal(groupedInvoiceCovers({ ...o, paidAt: new Date("2026-08-01") }, [grouped], ["Montemar25 Traducciones, S.L."]), false);
  const conRefs = { ...grouped, concept: "Factura Montemar25 · 1 encargo(s): 26_3BBE08" };
  assert.equal(groupedInvoiceCovers(o, [conRefs], ["Montemar25 Traducciones, S.L."]), false);
});
