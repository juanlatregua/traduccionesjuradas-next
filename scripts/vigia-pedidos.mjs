#!/usr/bin/env node
/*
  VIGÍA DE PEDIDOS — radiografía determinista de lo que hay que recuperar.
  Solo lectura. Fuente de verdad del agente .claude/agents/vigia-pedidos.md.

  Uso:  node --env-file=.env.local scripts/vigia-pedidos.mjs [--dias=7] [--json]

  Cruza cuatro fuentes que hoy nadie mira juntas:
    · LavoriPriceRequest  → solicitudes de precio al colectivo (SENT / PRICED / sin presupuesto)
    · DocumentAnalysis    → leads de la puerta (dejaron email y no compraron)
    · Quote + MessageLog  → presupuestos enviados sin pagar, recordatorios y SMS caídos
    · Order + Assignment  → pagados sin traductor, en curso atascados, pendientes de pago
  y termina con una lista de ACCIONES ordenada por dinero en juego.
*/
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const DAYS = Number(args.dias || 7);
const JSON_OUT = "json" in args;
const NOW = new Date();
const SINCE = new Date(NOW.getTime() - DAYS * 864e5);
const H24 = new Date(NOW.getTime() - 864e5);
const SITE = "https://www.traduccionesjuradas.net";
const MARGIN_PCT = 12; // horquilla de Juan 10-15 % sobre el coste del jurado (24-ago-2026)
const VAT = 1.21;
// Twilio Geo Permissions cerradas a 25-ago-2026: el SMS rebota, hay que ir por WhatsApp/email.
const SMS_DEAD_PREFIXES = ["+55", "+52", "+46", "+49", "+33", "+351", "+31"];

const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;
const days = (d) => (d ? Math.floor((NOW - new Date(d)) / 864e5) : null);
const hours = (d) => (d ? Math.floor((NOW - new Date(d)) / 36e5) : null);
const fmt = (d) => (d ? new Date(d).toISOString().slice(5, 16).replace("T", " ") : "—");
const phoneOf = (phone, email) => {
  if (phone) return phone;
  const m = /^(\d{8,15})@whatsapp\.local$/.exec(email || "");
  return m ? `+${m[1]}` : null;
};
const waLink = (phone) => (phone ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : null);
const smsDead = (phone) => !!phone && SMS_DEAD_PREFIXES.some((p) => phone.replace(/\s/g, "").startsWith(p));
const isFr = (pair) => /^fr\b|\bfr$/.test(String(pair || "").toLowerCase().replace(/[->→]+/g, " ").trim().split(/\s+/).join(" ")) && /fr/.test(String(pair || ""));
const pairOf = (a, b) => `${a || "?"}→${b || "?"}`;

const actions = []; // {stake, urgencia, que, quien, link}
const act = (stake, urgencia, que, link) => actions.push({ stake: Math.round(stake), urgencia, que, link });

/* ───────────────────────── 1. Solicitudes a lavori ───────────────────────── */
const solicitudes = await prisma.lavoriPriceRequest.findMany({
  where: { createdAt: { gte: SINCE } },
  orderBy: { createdAt: "desc" },
});
const quoteIds = solicitudes.map((s) => s.quoteId).filter(Boolean);
const quotesOfSolicitudes = quoteIds.length
  ? await prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, quoteNumber: true, status: true, total: true, sentAt: true } })
  : [];
const quoteById = new Map(quotesOfSolicitudes.map((q) => [q.id, q]));
// Solicitud atada a un pedido pagado (emparejada por cliente o encargo aceptado): el
// payload del evento lavori.* del pedido lleva el encargoId o la ref de la solicitud.
const bridgeEvents = await prisma.orderEvent.findMany({
  where: { type: { startsWith: "lavori." }, createdAt: { gte: SINCE } },
  select: { payload: true, order: { select: { reference: true, status: true } } },
});
// Respaldo cuando Juan ató el precio a mano (caso 26_34F612): mismo cliente (email,
// teléfono o nombre en customerHint), mismo par, pedido pagado después de la solicitud.
const paidOrdersWindow = await prisma.order.findMany({
  where: { paymentStatus: "PAID", paidAt: { gte: SINCE } },
  select: { reference: true, status: true, clientEmail: true, clientName: true, clientPhone: true, langPair: true, paidAt: true },
});
const normPair = (p) => String(p || "").toLowerCase().replace(/[^a-z]+/g, ">");
const digits = (p) => String(p || "").replace(/\D/g, "").slice(-9);
const orderOfSolicitud = (s) => {
  const needles = [s.encargoId, s.ref].filter(Boolean);
  const hit = bridgeEvents.find((e) => { const p = JSON.stringify(e.payload || {}); return needles.some((n) => p.includes(n)); });
  if (hit) return hit.order;
  const hint = (s.customerHint || "").toLowerCase();
  if (!hint) return null;
  return paidOrdersWindow.find((o) => o.paidAt >= s.createdAt && normPair(o.langPair) === normPair(s.par) && (
    hint.includes(o.clientEmail.toLowerCase()) ||
    (o.clientPhone && digits(o.clientPhone).length >= 9 && digits(hint).includes(digits(o.clientPhone))) ||
    (o.clientName && o.clientName.length >= 6 && hint.includes(o.clientName.toLowerCase()))
  )) || null;
};

const solRows = solicitudes.map((s) => {
  const q = s.quoteId ? quoteById.get(s.quoteId) : null;
  const pedido = q ? null : orderOfSolicitud(s);
  const coste = s.priceCents != null ? s.priceCents / 100 : null;
  const sugerido = coste != null ? coste * (1 + MARGIN_PCT / 100) : null;
  let situacion = s.status;
  let accion = null;
  const builder = `${SITE}/zona-traductor/presupuesto?lead=${encodeURIComponent(s.ref)}`;
  if (s.status === "SENT") {
    const h = hours(s.createdAt);
    situacion = `SENT hace ${h} h · ${s.candidatos.length} candidato(s)`;
    if (h >= 24) {
      accion = `sin precio del jurado tras ${h} h → reclamar al jurado por lavori o cambiar de candidato (builder)`;
      act((s.words || 400) * 0.1, 3, `Solicitud ${s.ref} ${s.par} (${s.customerHint || "?"}) lleva ${h} h sin precio → reclamar/cambiar candidato`, builder);
    }
  } else if (s.status === "PRICED" && pedido) {
    situacion = `PRICED ${eur(coste)} por ${s.miembroNombre || "?"} → atada al pedido ${pedido.reference} (${pedido.status})`;
  } else if (s.status === "PRICED" && !q) {
    situacion = `PRICED ${eur(coste)} por ${s.miembroNombre || "?"} el ${fmt(s.updatedAt)} · SIN PRESUPUESTO`;
    accion = `montar presupuesto: coste ${eur(coste)} + ${MARGIN_PCT} % = ${eur(sugerido)} neto → ${eur(sugerido * VAT)} con IVA`;
    act(sugerido, 4, `Presupuesto a ${s.customerHint || s.ref} (${s.par}): coste ${eur(coste)} de ${s.miembroNombre || "?"} → ${eur(sugerido)} +IVA = ${eur(sugerido * VAT)}`, builder);
  } else if (s.status === "PRICED" && q) {
    situacion = `PRICED ${eur(coste)} → presupuesto ${q.quoteNumber} ${q.status} (${eur(q.total)})`;
  }
  return {
    ref: s.ref, par: s.par, status: s.status, creada: fmt(s.createdAt), cliente: s.customerHint || "", docs: s.docsCount, palabras: s.words,
    jurado: s.miembroNombre || (s.candidatos.length ? `${s.candidatos.length} cand.` : "carril"), coste, quote: q?.quoteNumber || null, pedido: pedido?.reference || null, situacion, accion, builder,
  };
});

/* ───────────────────────── 2. Leads de la puerta ───────────────────────── */
const [leadDocs, paidEmails, quoteEmails] = await Promise.all([
  prisma.documentAnalysis.findMany({
    where: {
      createdAt: { gte: SINCE }, clientEmail: { not: null }, orderId: null,
      NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }],
    },
    orderBy: { createdAt: "asc" },
    select: { clientEmail: true, clientName: true, clientPhone: true, fileName: true, documentType: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, quoteAmount: true, sessionToken: true, createdAt: true, marketingConsent: true },
  }),
  prisma.order.findMany({ where: { createdAt: { gte: SINCE }, paymentStatus: "PAID" }, select: { clientEmail: true } }),
  prisma.quote.findMany({ where: { createdAt: { gte: SINCE }, deletedAt: null }, select: { customerEmail: true, quoteNumber: true, status: true } }),
]);
const paidSet = new Set(paidEmails.map((o) => o.clientEmail.toLowerCase()));
const quoteByEmail = new Map();
for (const q of quoteEmails) quoteByEmail.set(q.customerEmail.toLowerCase(), q);
const solBySession = new Map(solicitudes.filter((s) => s.expedienteRef?.startsWith("puerta:")).map((s) => [s.expedienteRef.slice(7), s]));

const leadMap = new Map();
for (const d of leadDocs) {
  const email = d.clientEmail.toLowerCase();
  if (paidSet.has(email)) continue; // ya compró en la ventana: no es un lead (falso positivo del digest de 26-ago)
  if (/yopmail\.com$|mailinator\.com$|^prueba@|^test@/.test(email)) continue; // pruebas
  const e = leadMap.get(email) || { email, name: d.clientName, phone: d.clientPhone, first: d.createdAt, docs: [], solicitud: null, quote: quoteByEmail.get(email) || null, consent: false, session: d.sessionToken };
  e.name ||= d.clientName; e.phone ||= d.clientPhone; e.consent ||= d.marketingConsent;
  e.docs.push({ file: d.fileName, tipo: d.documentType, par: pairOf(d.sourceLanguage, d.targetLanguage), palabras: d.estimatedWords, motor: d.quoteAmount == null ? null : Number(d.quoteAmount) });
  if (d.sessionToken && solBySession.has(d.sessionToken)) e.solicitud = solBySession.get(d.sessionToken);
  leadMap.set(email, e);
}
const leads = [...leadMap.values()].map((l) => {
  const total = l.docs.reduce((s, d) => s + (d.motor || 0), 0);
  const fr = l.docs.every((d) => /fr/.test(d.par));
  const sinDestino = l.docs.some((d) => /unknown|\?/.test(d.par));
  const phone = phoneOf(l.phone, l.email);
  const pares = [...new Set(l.docs.map((d) => d.par))].join(", ");
  let accion;
  if (l.quote) accion = `ya tiene presupuesto ${l.quote.quoteNumber} (${l.quote.status}) → ver bloque presupuestos`;
  else if (l.solicitud) accion = `solicitud ${l.solicitud.ref} ${l.solicitud.status}${l.solicitud.priceCents != null ? ` · jurado ${eur(l.solicitud.priceCents / 100)}` : ""} → ver bloque lavori`;
  else if (sinDestino) accion = `falta el idioma de destino (o el análisis falló) → preguntar al cliente ANTES de pedir precio a nadie`;
  else if (fr) accion = `FR, precio del motor ${eur(total)} ya visto → un toque humano (email/WhatsApp): "¿te ayudo a cerrarlo?"`;
  else accion = `no-FR sin solicitud al colectivo → mandar solicitud desde el builder (?session=) y avisar al cliente`;
  if (!l.quote && !l.solicitud) act(total, sinDestino ? 2 : fr ? 2 : 3, `Lead ${l.email}${phone ? ` · ${phone}` : ""} (${pares}, motor ${eur(total)}): ${sinDestino ? "preguntar idioma de destino" : fr ? "toque humano" : "mandar solicitud a lavori"}`, `${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(l.session || "")}`);
  return { ...l, phone, wa: waLink(phone), smsMuerto: smsDead(phone), total, fr, accion, first: fmt(l.first), session: l.session };
});

/* ───────────────────────── 3. Presupuestos sin pagar ───────────────────────── */
const openQuotes = await prisma.quote.findMany({
  where: { deletedAt: null, status: { in: ["SENT", "OPENED", "ACCEPTED"] } },
  orderBy: { sentAt: "asc" },
  include: { messageLogs: { select: { channel: true, type: true, status: true, createdAt: true } } },
});
const quotes = openQuotes.map((q) => {
  const phone = phoneOf(q.customerPhone, q.customerEmail);
  const sent = q.sentAt || q.createdAt;
  const d = days(sent);
  const logs = q.messageLogs;
  const reminders = logs.filter((m) => m.type === "REMINDER" && m.status === "SENT").length;
  const smsFailed = logs.some((m) => m.channel === "SMS" && m.status === "FAILED");
  const opened = q.status === "OPENED" || !!q.openedAt;
  const caducado = q.validUntil && new Date(q.validUntil) < NOW;
  let accion;
  if (caducado) accion = `caducado el ${fmt(q.validUntil)} → último toque por WhatsApp o marcar "No aceptado"`;
  else if (smsFailed || smsDead(phone)) accion = `SMS muerto (Twilio Geo) → recordatorio a mano por WhatsApp${q.customerEmail.endsWith("@whatsapp.local") ? "" : " o email"}`;
  else if (d >= 3 && !opened) accion = `${d} días sin abrir → WhatsApp corto: "¿lo recibiste?"`;
  else if (d >= 3 && opened) accion = `abierto y sin pagar ${d} días → preguntar qué le frena (precio/plazo)`;
  else accion = `reciente (${d} d) → esperar; el cron recuerda solo`;
  if (d >= 2) act(Number(q.total), caducado ? 1 : 2, `Presupuesto ${q.quoteNumber} ${eur(q.total)} (${q.customerName}, ${pairOf(q.sourceLang, q.targetLang)}): ${accion.split("→")[1]?.trim() || accion}`, waLink(phone) || `${SITE}/admin/quotes/${q.id}`);
  return { numero: q.quoteNumber, cliente: q.customerName, email: q.customerEmail, phone, wa: waLink(phone), par: pairOf(q.sourceLang, q.targetLang), total: Number(q.total), status: q.status, enviado: fmt(sent), dias: d, abierto: opened, recordatorios: reminders, smsFallido: smsFailed, caducado: !!caducado, accion, link: `${SITE}/admin/quotes/${q.id}` };
});
const lost = await prisma.quote.findMany({ where: { deletedAt: null, status: "EXPIRED", updatedAt: { gte: SINCE } }, select: { quoteNumber: true, total: true, customerName: true, lostReason: true, lostReasonNote: true, sourceLang: true, targetLang: true } });

/* ───────────────────────── 4. Pedidos ───────────────────────── */
const orders = await prisma.order.findMany({
  where: { status: { in: ["PENDING_PAYMENT", "PAID", "IN_PROGRESS"] }, createdAt: { gte: new Date(NOW.getTime() - 60 * 864e5) } },
  orderBy: { createdAt: "asc" },
  include: { collaboratorAssignments: { select: { status: true, isWinning: true, quotedPriceCents: true, collaborator: { select: { fullName: true } } } }, events: { where: { OR: [{ type: { startsWith: "lavori." } }, { type: { in: ["order.archived", "order.unarchived"] } }] }, select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 6 } },
});
const pedidos = [];
let archivados = 0;
for (const o of orders) {
  // Archivado a mano = cerrado fuera del sistema (entregado por otra vía, factura del
  // traductor a fin de mes…). Julia/Kashif 26-ago: no es nada que recuperar.
  const arch = o.events.find((e) => e.type === "order.archived" || e.type === "order.unarchived");
  if (arch?.type === "order.archived") { archivados++; continue; }
  const win = o.collaboratorAssignments.find((a) => a.isWinning || a.status === "ACCEPTED");
  const asignado = o.assignedTo || win?.collaborator.fullName || null;
  const fr = isFr(o.langPair);
  const lav = o.events.find((e) => e.type.startsWith("lavori."))?.type || null;
  const link = `${SITE}/zona-traductor/pedido/${o.reference}`;
  let accion = null;
  if (o.status === "PENDING_PAYMENT") {
    if (hours(o.createdAt) >= 24) { accion = `pendiente de pago ${days(o.createdAt)} d → reenviar enlace de pago / preguntar`; act(o.amountCents / 100, 2, `Pedido ${o.reference} ${eur(o.amountCents / 100)} sin pagar ${days(o.createdAt)} d → reenviar enlace de pago`, link); }
  } else if (o.status === "PAID" && !asignado && !fr) {
    accion = `PAGADO SIN TRADUCTOR${lav ? ` (${lav})` : " y sin rastro del puente"} → asignar o solicitar en lavori`;
    act(o.amountCents / 100, 5, `Pedido ${o.reference} ${eur(o.amountCents / 100)} ${o.langPair} pagado hace ${days(o.paidAt || o.createdAt)} d SIN TRADUCTOR → asignar/lavori`, link);
  } else if (o.status === "PAID" && !asignado && fr) {
    if (days(o.paidAt || o.createdAt) >= 2) { accion = `FR pagado hace ${days(o.paidAt || o.createdAt)} d, sin empezar → es tuyo`; act(o.amountCents / 100, 4, `Pedido FR ${o.reference} ${eur(o.amountCents / 100)} pagado hace ${days(o.paidAt || o.createdAt)} d sin empezar → traducir/entregar`, link); }
  } else if (o.status === "IN_PROGRESS" || (o.status === "PAID" && asignado)) {
    const vencido = o.dueDate && new Date(o.dueDate) < NOW;
    const viejo = days(o.paidAt || o.createdAt) >= 5;
    if (vencido || viejo) { accion = `${vencido ? `VENCIDO (${fmt(o.dueDate)})` : `${days(o.paidAt || o.createdAt)} d en curso`} con ${asignado} → reclamar entrega`; act(o.amountCents / 100, vencido ? 5 : 3, `Pedido ${o.reference} ${eur(o.amountCents / 100)} ${vencido ? "VENCIDO" : `${days(o.paidAt || o.createdAt)} d en curso`} (${asignado}) → reclamar entrega`, link); }
  }
  pedidos.push({ ref: o.reference, cliente: o.clientName || o.clientEmail, par: o.langPair, importe: o.amountCents / 100, status: o.status, pagado: fmt(o.paidAt), asignado, coste: win?.quotedPriceCents != null ? win.quotedPriceCents / 100 : o.supplierCostCents != null ? o.supplierCostCents / 100 : null, puente: lav, vence: fmt(o.dueDate), accion, link });
}

/* ───────────────────────── Salida ───────────────────────── */
actions.sort((a, b) => b.urgencia * 1e6 + b.stake - (a.urgencia * 1e6 + a.stake));
const out = { generado: NOW.toISOString(), ventanaDias: DAYS, solicitudes: solRows, leads, presupuestos: quotes, perdidos: lost.map((l) => ({ ...l, total: Number(l.total) })), pedidos, acciones: actions };
await prisma.$disconnect();
if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const H = (t) => console.log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
console.log(`VIGÍA DE PEDIDOS · ${NOW.toISOString().slice(0, 16).replace("T", " ")} UTC · ventana ${DAYS} días`);
console.log(`solicitudes lavori ${solRows.length} · leads ${leads.length} · presupuestos abiertos ${quotes.length} · perdidos ${lost.length} · pedidos vivos ${pedidos.length} · ACCIONES ${actions.length}`);

H(`1 · SOLICITUDES A LAVORI (${solRows.length})`);
for (const s of solRows) {
  console.log(`• ${s.ref} ${s.par} · ${s.creada} · ${s.cliente || "?"} · ${s.docs} doc · ${s.palabras ?? "?"} pal · ${s.jurado}`);
  console.log(`    ${s.situacion}${s.accion ? `\n    ⚠ ${s.accion}\n    ${s.builder}` : ""}`);
}

H(`2 · LEADS DE LA PUERTA SIN PEDIDO (${leads.length})`);
for (const l of leads) {
  console.log(`• ${l.email}${l.phone ? ` · ${l.phone}${l.smsMuerto ? " (SMS muerto)" : ""}` : ""}${l.name ? ` · ${l.name}` : ""} · ${l.first}${l.consent ? " · consentimiento mkt" : ""}`);
  for (const d of l.docs) console.log(`    ${d.file} (${d.par}, ${d.tipo || "?"}, ${d.palabras ?? "?"} pal) · motor ${d.motor != null ? eur(d.motor) : "—"}`);
  console.log(`    → ${l.accion}${l.wa ? `\n    ${l.wa}` : ""}`);
}

H(`3 · PRESUPUESTOS ENVIADOS SIN PAGAR (${quotes.length})`);
for (const q of quotes) {
  console.log(`• ${q.numero} · ${eur(q.total)} · ${q.par} · ${q.cliente} · ${q.email}${q.phone ? ` · ${q.phone}` : ""}`);
  console.log(`    ${q.status} · enviado ${q.enviado} (${q.dias} d) · ${q.abierto ? "abierto" : "NO abierto"} · ${q.recordatorios} recordatorio(s)${q.smsFallido ? " · SMS FALLIDO" : ""}${q.caducado ? " · CADUCADO" : ""}`);
  console.log(`    → ${q.accion}${q.wa ? `\n    ${q.wa}` : ""}`);
}
if (lost.length) {
  console.log(`\n  Perdidos en la ventana (${lost.length}): ${lost.map((l) => `${l.quoteNumber} ${eur(l.total)} ${pairOf(l.sourceLang, l.targetLang)} [${l.lostReason || "sin motivo"}]`).join(" · ")}`);
}

H(`4 · PEDIDOS VIVOS (${pedidos.length}${archivados ? ` · ${archivados} archivado(s) fuera` : ""})`);
for (const p of pedidos) {
  console.log(`• ${p.ref} · ${eur(p.importe)} · ${p.par} · ${p.cliente} · ${p.status} · pagado ${p.pagado} · ${p.asignado ? `→ ${p.asignado}${p.coste != null ? ` (coste ${eur(p.coste)})` : ""}` : "SIN TRADUCTOR"}${p.puente ? ` · ${p.puente}` : ""}${p.vence !== "—" ? ` · vence ${p.vence}` : ""}`);
  if (p.accion) console.log(`    ⚠ ${p.accion}\n    ${p.link}`);
}

H(`ACCIONES, por urgencia y dinero (${actions.length})`);
actions.forEach((a, i) => console.log(`${String(i + 1).padStart(2)}. [${"!".repeat(a.urgencia)}${" ".repeat(5 - a.urgencia)} ${eur(a.stake).padStart(10)}] ${a.que}\n    ${a.link}`));
