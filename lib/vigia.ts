// VIGÍA DE PEDIDOS + AGENDA DE HOY — radiografía determinista de lo que hay que
// recuperar y de lo que Juan tiene que traducir/seguir. Solo lectura.
// La consumen: scripts/vigia-pedidos.ts (CLI del agente vigia-pedidos) y el cron
// /api/cron/vigia-agenda (email de las 8:00). Una sola fuente de verdad.
import { prisma } from "@/lib/prisma";
import { isCreditOutstanding, creditDaysToDue } from "@/lib/credit-terms";

const SITE = "https://www.traduccionesjuradas.net";
const MARGIN_PCT = 12; // horquilla de Juan 10-15 % sobre el coste del jurado (24-ago-2026)
const VAT = 1.21;
const WORDS_PER_HOUR = 300; // ritmo de jurada de Juan para estimar horas
const DAILY_HOURS = 4; // horas de traducción al día que la agenda da por buenas
// Twilio Geo Permissions cerradas a 25-ago-2026: el SMS rebota, hay que ir por WhatsApp/email.
const SMS_DEAD_PREFIXES = ["+55", "+52", "+46", "+49", "+33", "+351", "+31"];
const TZ_OFFSET_MS = 2 * 3600e3; // Madrid en verano (CEST); el cron corre en UTC

export type VigiaAction = { stake: number; urgencia: number; que: string; link: string };
export type AgendaItem = {
  ref: string;
  cliente: string;
  par: string;
  importe: number;
  docs: number;
  palabras: number | null;
  horas: number | null;
  vence: string | null;
  venceDias: number | null; // <0 vencido, 0 hoy, 1 mañana…
  quien: string;
  link: string;
};
export type Vigia = {
  generado: string;
  ventanaDias: number;
  agenda: {
    traducir: AgendaItem[]; // lo de Juan, por vencimiento
    seguir: AgendaItem[]; // colaboradores, por vencimiento
    entregar: AgendaItem[]; // el traductor ya entregó; falta el paso de Juan al cliente (papel/mensajería/verificar)
    sinFecha: AgendaItem[];
    palabrasSemana: number;
    horasSemana: number;
    diasNecesarios: number;
  };
  solicitudes: any[];
  leads: any[];
  presupuestos: any[];
  perdidos: any[];
  pedidos: any[];
  archivados: number;
  acciones: VigiaAction[];
};

const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} €`;
const madrid = (d: Date | string | null | undefined) =>
  d ? new Date(new Date(d).getTime() + TZ_OFFSET_MS).toISOString().slice(5, 16).replace("T", " ") : "—";
const dayOnly = (d: Date | string | null | undefined) =>
  d ? new Date(new Date(d).getTime() + TZ_OFFSET_MS).toISOString().slice(5, 10) : null;
const phoneOf = (phone: string | null | undefined, email: string | null | undefined) => {
  if (phone) return phone;
  const m = /^(\d{8,15})@whatsapp\.local$/.exec(email || "");
  return m ? `+${m[1]}` : null;
};
const waLink = (phone: string | null) => (phone ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : null);
const smsDead = (phone: string | null) => !!phone && SMS_DEAD_PREFIXES.some((p) => phone.replace(/\s/g, "").startsWith(p));
const normPair = (p: string | null | undefined) => String(p || "").toLowerCase().replace(/[^a-z]+/g, ">");
const isFr = (pair: string | null | undefined) => /(^|>)fr(>|$)/.test(normPair(pair));
const pairOf = (a: string | null | undefined, b: string | null | undefined) => `${a || "?"}→${b || "?"}`;
const digits = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-9);

export async function buildVigia(days = 7): Promise<Vigia> {
  const NOW = new Date();
  const SINCE = new Date(NOW.getTime() - days * 864e5);
  const dayDiff = (d: Date | null) => (d ? Math.floor((new Date(d).getTime() + TZ_OFFSET_MS) / 864e5) - Math.floor((NOW.getTime() + TZ_OFFSET_MS) / 864e5) : null);
  const daysAgo = (d: Date | null) => (d ? Math.floor((NOW.getTime() - new Date(d).getTime()) / 864e5) : null);
  const hoursAgo = (d: Date | null) => (d ? Math.floor((NOW.getTime() - new Date(d).getTime()) / 36e5) : null);

  const actions: VigiaAction[] = [];
  const act = (stake: number, urgencia: number, que: string, link: string) => actions.push({ stake: Math.round(stake), urgencia, que, link });

  /* ───────── 1. Solicitudes a lavori ───────── */
  const solicitudes = await prisma.lavoriPriceRequest.findMany({ where: { createdAt: { gte: SINCE } }, orderBy: { createdAt: "desc" } });
  const quoteIds = solicitudes.map((s) => s.quoteId).filter((x): x is string => !!x);
  const quotesOfSolicitudes = quoteIds.length
    ? await prisma.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, quoteNumber: true, status: true, total: true } })
    : [];
  const quoteById = new Map(quotesOfSolicitudes.map((q) => [q.id, q]));
  const bridgeEvents = await prisma.orderEvent.findMany({
    where: { type: { startsWith: "lavori." }, createdAt: { gte: SINCE } },
    select: { payload: true, order: { select: { reference: true, status: true } } },
  });
  const paidOrdersWindow = await prisma.order.findMany({
    where: { paymentStatus: "PAID", paidAt: { gte: SINCE } },
    select: { reference: true, status: true, clientEmail: true, clientName: true, clientPhone: true, langPair: true, paidAt: true },
  });
  const orderOfSolicitud = (s: (typeof solicitudes)[number]) => {
    const needles = [s.encargoId, s.ref].filter(Boolean) as string[];
    const hit = bridgeEvents.find((e) => { const p = JSON.stringify(e.payload || {}); return needles.some((n) => p.includes(n)); });
    if (hit) return hit.order;
    const hint = (s.customerHint || "").toLowerCase();
    if (!hint) return null;
    return (
      paidOrdersWindow.find(
        (o) =>
          o.paidAt! >= s.createdAt &&
          normPair(o.langPair) === normPair(s.par) &&
          (hint.includes(o.clientEmail.toLowerCase()) ||
            (o.clientPhone && digits(o.clientPhone).length >= 9 && digits(hint).includes(digits(o.clientPhone))) ||
            (o.clientName && o.clientName.length >= 6 && hint.includes(o.clientName.toLowerCase())))
      ) || null
    );
  };
  const solRows = solicitudes.map((s) => {
    const q = s.quoteId ? quoteById.get(s.quoteId) : null;
    const pedido = q ? null : orderOfSolicitud(s);
    const coste = s.priceCents != null ? s.priceCents / 100 : null;
    const sugerido = coste != null ? coste * (1 + MARGIN_PCT / 100) : null;
    let situacion: string = s.status;
    let accion: string | null = null;
    const builder = `${SITE}/zona-traductor/presupuesto?lead=${encodeURIComponent(s.ref)}`;
    if (s.status === "SENT") {
      const h = hoursAgo(s.createdAt) ?? 0;
      situacion = `SENT hace ${h} h · ${s.candidatos.length} candidato(s)`;
      if (h >= 24) {
        accion = `sin precio del jurado tras ${h} h → reclamar al jurado por lavori o cambiar de candidato (builder)`;
        act((s.words || 400) * 0.1, 3, `Solicitud ${s.ref} ${s.par} (${s.customerHint || "?"}) lleva ${h} h sin precio → reclamar/cambiar candidato`, builder);
      }
    } else if (s.status === "PRICED" && pedido) {
      situacion = `PRICED ${eur(coste!)} por ${s.miembroNombre || "?"} → atada al pedido ${pedido.reference} (${pedido.status})`;
    } else if (s.status === "PRICED" && !q) {
      situacion = `PRICED ${eur(coste!)} por ${s.miembroNombre || "?"} el ${madrid(s.updatedAt)} · SIN PRESUPUESTO`;
      accion = `montar presupuesto: coste ${eur(coste!)} + ${MARGIN_PCT} % = ${eur(sugerido!)} neto → ${eur(sugerido! * VAT)} con IVA`;
      act(sugerido!, 4, `Presupuesto a ${s.customerHint || s.ref} (${s.par}): coste ${eur(coste!)} de ${s.miembroNombre || "?"} → ${eur(sugerido!)} +IVA = ${eur(sugerido! * VAT)}`, builder);
    } else if (s.status === "PRICED" && q) {
      situacion = `PRICED ${eur(coste!)} → presupuesto ${q.quoteNumber} ${q.status} (${eur(Number(q.total))})`;
    }
    return {
      ref: s.ref, par: s.par, status: s.status, creada: madrid(s.createdAt), cliente: s.customerHint || "", docs: s.docsCount, palabras: s.words,
      jurado: s.miembroNombre || (s.candidatos.length ? `${s.candidatos.length} cand.` : "carril"), coste, quote: q?.quoteNumber || null, pedido: pedido?.reference || null, situacion, accion, builder,
    };
  });

  /* ───────── 2. Leads de la puerta ───────── */
  const [leadDocs, quoteEmails] = await Promise.all([
    prisma.documentAnalysis.findMany({
      where: { createdAt: { gte: SINCE }, clientEmail: { not: null }, orderId: null, NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }] },
      orderBy: { createdAt: "asc" },
      select: { clientEmail: true, clientName: true, clientPhone: true, fileName: true, documentType: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, quoteAmount: true, sessionToken: true, createdAt: true, marketingConsent: true },
    }),
    prisma.quote.findMany({ where: { createdAt: { gte: SINCE }, deletedAt: null }, select: { customerEmail: true, quoteNumber: true, status: true } }),
  ]);
  const paidSet = new Set(paidOrdersWindow.map((o) => o.clientEmail.toLowerCase()));
  const quoteByEmail = new Map(quoteEmails.map((q) => [q.customerEmail.toLowerCase(), q]));
  const solBySession = new Map(solicitudes.filter((s) => s.expedienteRef?.startsWith("puerta:")).map((s) => [s.expedienteRef!.slice(7), s]));
  const leadMap = new Map<string, any>();
  for (const d of leadDocs) {
    const email = d.clientEmail!.toLowerCase();
    if (paidSet.has(email)) continue;
    if (/yopmail\.com$|mailinator\.com$|^prueba@|^test@/.test(email)) continue;
    const e = leadMap.get(email) || { email, name: d.clientName, phone: d.clientPhone, first: d.createdAt, docs: [], solicitud: null, quote: quoteByEmail.get(email) || null, consent: false, session: d.sessionToken };
    e.name ||= d.clientName; e.phone ||= d.clientPhone; e.consent ||= d.marketingConsent;
    e.docs.push({ file: d.fileName, tipo: d.documentType, par: pairOf(d.sourceLanguage, d.targetLanguage), palabras: d.estimatedWords, motor: d.quoteAmount == null ? null : Number(d.quoteAmount) });
    if (d.sessionToken && solBySession.has(d.sessionToken)) e.solicitud = solBySession.get(d.sessionToken);
    leadMap.set(email, e);
  }
  const leads = [...leadMap.values()].map((l) => {
    const total = l.docs.reduce((s: number, d: any) => s + (d.motor || 0), 0);
    const fr = l.docs.every((d: any) => /fr/.test(d.par));
    const sinDestino = l.docs.some((d: any) => /unknown|\?/.test(d.par));
    const phone = phoneOf(l.phone, l.email);
    const pares = [...new Set(l.docs.map((d: any) => d.par))].join(", ");
    let accion: string;
    if (l.quote) accion = `ya tiene presupuesto ${l.quote.quoteNumber} (${l.quote.status}) → ver bloque presupuestos`;
    else if (l.solicitud) accion = `solicitud ${l.solicitud.ref} ${l.solicitud.status}${l.solicitud.priceCents != null ? ` · jurado ${eur(l.solicitud.priceCents / 100)}` : ""} → ver bloque lavori`;
    else if (sinDestino) accion = `falta el idioma de destino (o el análisis falló) → preguntar al cliente ANTES de pedir precio a nadie`;
    else if (fr) accion = `FR, precio del motor ${eur(total)} ya visto → un toque humano (email/WhatsApp): "¿te ayudo a cerrarlo?"`;
    else accion = `no-FR sin solicitud al colectivo → mandar solicitud desde el builder (?session=) y avisar al cliente`;
    if (!l.quote && !l.solicitud) act(total, sinDestino ? 2 : fr ? 2 : 3, `Lead ${l.email}${phone ? ` · ${phone}` : ""} (${pares}, motor ${eur(total)}): ${sinDestino ? "preguntar idioma de destino" : fr ? "toque humano" : "mandar solicitud a lavori"}`, `${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(l.session || "")}`);
    return { ...l, phone, wa: waLink(phone), smsMuerto: smsDead(phone), total, fr, accion, first: madrid(l.first) };
  });

  /* ───────── 3. Presupuestos sin pagar ───────── */
  const openQuotes = await prisma.quote.findMany({
    where: { deletedAt: null, status: { in: ["SENT", "OPENED", "ACCEPTED"] } },
    orderBy: { sentAt: "asc" },
    include: { messageLogs: { select: { channel: true, type: true, status: true } } },
  });
  const presupuestos = openQuotes.map((q) => {
    const phone = phoneOf(q.customerPhone, q.customerEmail);
    const sent = q.sentAt || q.createdAt;
    const d = daysAgo(sent) ?? 0;
    const reminders = q.messageLogs.filter((m) => m.type === "REMINDER" && m.status === "SENT").length;
    const smsFailed = q.messageLogs.some((m) => m.channel === "SMS" && m.status === "FAILED");
    const opened = q.status === "OPENED" || !!q.openedAt;
    const caducado = !!q.validUntil && new Date(q.validUntil) < NOW;
    let accion: string;
    if (caducado) accion = `caducado el ${madrid(q.validUntil)} → último toque por WhatsApp o marcar "No aceptado"`;
    else if (smsFailed || smsDead(phone)) accion = `SMS muerto (Twilio Geo) → recordatorio a mano por WhatsApp${q.customerEmail.endsWith("@whatsapp.local") ? "" : " o email"}`;
    else if (d >= 3 && !opened) accion = `${d} días sin abrir → WhatsApp corto: "¿lo recibiste?"`;
    else if (d >= 3 && opened) accion = `abierto y sin pagar ${d} días → preguntar qué le frena (precio/plazo)`;
    else accion = `reciente (${d} d) → esperar; el cron recuerda solo`;
    if (d >= 2) act(Number(q.total), caducado ? 1 : 2, `Presupuesto ${q.quoteNumber} ${eur(Number(q.total))} (${q.customerName}, ${pairOf(q.sourceLang, q.targetLang)}): ${accion.split("→")[1]?.trim() || accion}`, waLink(phone) || `${SITE}/zona-traductor/presupuestos/${q.id}`);
    return { numero: q.quoteNumber, cliente: q.customerName, email: q.customerEmail, phone, wa: waLink(phone), par: pairOf(q.sourceLang, q.targetLang), total: Number(q.total), status: q.status, enviado: madrid(sent), dias: d, abierto: opened, recordatorios: reminders, smsFallido: smsFailed, caducado, accion, link: `${SITE}/zona-traductor/presupuestos/${q.id}` };
  });
  const lost = await prisma.quote.findMany({ where: { deletedAt: null, status: "EXPIRED", updatedAt: { gte: SINCE } }, select: { quoteNumber: true, total: true, customerName: true, lostReason: true, sourceLang: true, targetLang: true } });

  /* ───────── 4. Pedidos vivos + AGENDA ───────── */
  const orders = await prisma.order.findMany({
    where: { status: { in: ["PENDING_PAYMENT", "PAID", "IN_PROGRESS"] }, createdAt: { gte: new Date(NOW.getTime() - 60 * 864e5) } },
    orderBy: { createdAt: "asc" },
    include: {
      collaboratorAssignments: { select: { status: true, isWinning: true, quotedPriceCents: true, quotedDeadline: true, deliveredAt: true, collaborator: { select: { fullName: true } } } },
      documentItems: { select: { words: true } },
      documentAnalyses: { select: { estimatedWords: true } },
      quote: { select: { lines: { select: { description: true } } } },
      clientInvoice: { select: { number: true, status: true, docKind: true, dueDate: true, paidAt: true } },
      events: { where: { OR: [{ type: { startsWith: "lavori." } }, { type: { in: ["order.archived", "order.unarchived"] } }] }, select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  const pedidos: any[] = [];
  const traducir: AgendaItem[] = [];
  const seguir: AgendaItem[] = [];
  const entregar: AgendaItem[] = [];
  const sinFecha: AgendaItem[] = [];
  let archivados = 0;
  for (const o of orders) {
    const arch = o.events.find((e) => e.type === "order.archived" || e.type === "order.unarchived");
    if (arch?.type === "order.archived") { archivados++; continue; }
    const win = o.collaboratorAssignments.find((a) => a.isWinning || a.status === "ACCEPTED");
    const fr = isFr(o.langPair);
    const asignado = o.assignedTo || win?.collaborator.fullName || null;
    const esDeJuan = !asignado && fr; // regla: francés es de Juan (24-ago)
    const quien = asignado || (fr ? "Juan (FR)" : "SIN TRADUCTOR");
    const lav = o.events.find((e) => e.type.startsWith("lavori."))?.type || null;
    const link = `${SITE}/zona-traductor/pedido/${o.reference}`;
    const wordsFromQuote = (o.quote?.lines || []).reduce((s, l) => s + (Number(/(\d[\d.]*)\s*palabras/.exec(l.description)?.[1]?.replace(/\./g, "")) || 0), 0);
    const palabras = o.words || o.documentItems.reduce((s, d) => s + (d.words || 0), 0) || o.documentAnalyses.reduce((s, d) => s + (d.estimatedWords || 0), 0) || wordsFromQuote || null;
    const due = o.dueDate || win?.quotedDeadline || null;
    const item: AgendaItem = {
      ref: o.reference, cliente: o.clientName || o.clientEmail, par: o.langPair || "?", importe: o.amountCents / 100,
      docs: Math.max(o.documentItems.length, o.documentAnalyses.length, o.quote?.lines.length || 0, 1),
      palabras, horas: palabras ? Math.round((palabras / WORDS_PER_HOUR) * 10) / 10 : null,
      vence: dayOnly(due), venceDias: dayDiff(due), quien, link,
    };
    // A crédito (factura emitida con vencimiento, sin cobrar) el trabajo entra en
    // la agenda como si estuviera pagado: es lo que Juan decidió el 2-sep-2026.
    const credito = isCreditOutstanding(o.clientInvoice);
    const paid = o.status === "PAID" || o.status === "IN_PROGRESS" || credito;
    // El traductor ya entregó (sobre de lavori, asignación o campo del pedido) pero el
    // pedido no está DELIVERED: lo que falta es de Juan (papel por mensajería, verificar,
    // enviar al cliente). Caso Stephan 26_DFAA55: Maria entregó el 18-ago, papel sin enviar.
    const entregaTraductor = o.events.find((e) => e.type === "lavori.entrega_subida")?.createdAt || win?.deliveredAt || o.translatorDeliveredAt || null;
    if (paid && entregaTraductor) {
      const dias = daysAgo(entregaTraductor) ?? 0;
      entregar.push({ ...item, quien: `${asignado || quien} entregó ${madrid(entregaTraductor)}` });
      act(item.importe, dias >= 2 ? 5 : 4, `Pedido ${o.reference} ${eur(item.importe)} ${o.langPair}: ${asignado || "el traductor"} entregó hace ${dias} d y el cliente sigue sin recibirlo → ${o.deliveryType === "paper" ? "enviar el PAPEL por mensajería" : "verificar y entregar"}`, link);
    } else if (paid) {
      if (esDeJuan || /juan silva|^juan$/i.test(asignado || "")) traducir.push(item);
      else if (asignado) seguir.push(item);
      if (!due) { sinFecha.push(item); act(item.importe, 4, `Pedido ${o.reference} ${eur(item.importe)} ${o.langPair} (${quien}) SIN FECHA DE ENTREGA → ponerla en la ficha`, link); }
    }
    let accion: string | null = null;
    const vencido = !!due && new Date(due) < NOW;
    if (credito) {
      // Sin cobrar pero asegurado: solo se persigue el DINERO cerca del vencimiento.
      const faltan = creditDaysToDue(o.clientInvoice, NOW) ?? 0;
      const fac = o.clientInvoice?.number || "(sin nº)";
      if (faltan < 0) { accion = `CRÉDITO VENCIDO hace ${-faltan} d (factura ${fac}) → reclamar el cobro`; act(item.importe, 5, `Pedido ${o.reference} ${eur(item.importe)} a crédito VENCIDO hace ${-faltan} d (factura ${fac}) → reclamar`, link); }
      else if (faltan <= 3) { accion = `a crédito, factura ${fac} vence en ${faltan} d → recordar el pago`; act(item.importe, 3, `Pedido ${o.reference} ${eur(item.importe)} a crédito vence en ${faltan} d (factura ${fac}) → recordar el pago`, link); }
      else accion = `a crédito, factura ${fac} vence ${madrid(o.clientInvoice!.dueDate)}`;
    } else if (o.status === "PENDING_PAYMENT") {
      if ((hoursAgo(o.createdAt) ?? 0) >= 24) { accion = `pendiente de pago ${daysAgo(o.createdAt)} d → reenviar enlace de pago / preguntar`; act(item.importe, 2, `Pedido ${o.reference} ${eur(item.importe)} sin pagar ${daysAgo(o.createdAt)} d → reenviar enlace de pago`, link); }
    } else if (o.status === "PAID" && !asignado && !fr) {
      accion = `PAGADO SIN TRADUCTOR${lav ? ` (${lav})` : " y sin rastro del puente"} → asignar o solicitar en lavori`;
      act(item.importe, 5, `Pedido ${o.reference} ${eur(item.importe)} ${o.langPair} pagado hace ${daysAgo(o.paidAt || o.createdAt)} d SIN TRADUCTOR → asignar/lavori`, link);
    } else if (esDeJuan && (vencido || (daysAgo(o.paidAt || o.createdAt) ?? 0) >= 2)) {
      accion = vencido ? `FR VENCIDO (${madrid(due)}) → es tuyo, entregar` : `FR pagado hace ${daysAgo(o.paidAt || o.createdAt)} d, sin entregar → es tuyo`;
      act(item.importe, vencido ? 5 : 3, `Pedido FR ${o.reference} ${eur(item.importe)} ${vencido ? "VENCIDO" : `pagado hace ${daysAgo(o.paidAt || o.createdAt)} d`} → traducir/entregar (tuyo)`, link);
    } else if (asignado && !entregaTraductor) {
      const viejo = (daysAgo(o.paidAt || o.createdAt) ?? 0) >= 5;
      if (vencido || viejo) { accion = `${vencido ? `VENCIDO (${madrid(due)})` : `${daysAgo(o.paidAt || o.createdAt)} d en curso`} con ${asignado} → reclamar entrega`; act(item.importe, vencido ? 5 : 3, `Pedido ${o.reference} ${eur(item.importe)} ${vencido ? "VENCIDO" : `${daysAgo(o.paidAt || o.createdAt)} d en curso`} (${asignado}) → reclamar entrega`, link); }
    }
    pedidos.push({ ref: o.reference, cliente: item.cliente, par: o.langPair, importe: item.importe, status: o.status, pagado: madrid(o.paidAt), asignado, quien, coste: win?.quotedPriceCents != null ? win.quotedPriceCents / 100 : o.supplierCostCents != null ? o.supplierCostCents / 100 : null, puente: lav, vence: madrid(due), accion, link });
  }
  const byDue = (a: AgendaItem, b: AgendaItem) => (a.venceDias ?? 99) - (b.venceDias ?? 99);
  traducir.sort(byDue); seguir.sort(byDue);
  const palabrasSemana = traducir.reduce((s, t) => s + (t.palabras || 0), 0);
  const horasSemana = Math.round((palabrasSemana / WORDS_PER_HOUR) * 10) / 10;

  actions.sort((a, b) => b.urgencia * 1e6 + b.stake - (a.urgencia * 1e6 + a.stake));
  return {
    generado: NOW.toISOString(), ventanaDias: days,
    agenda: { traducir, seguir, entregar, sinFecha, palabrasSemana, horasSemana, diasNecesarios: Math.round((horasSemana / DAILY_HOURS) * 10) / 10 },
    solicitudes: solRows, leads, presupuestos, perdidos: lost.map((l) => ({ ...l, total: Number(l.total) })), pedidos, archivados, acciones: actions,
  };
}

/* ───────────────────────── Render texto (CLI / agente) ───────────────────────── */
const venceLabel = (i: AgendaItem) =>
  i.venceDias == null ? "SIN FECHA" : i.venceDias < 0 ? `VENCIDO ${-i.venceDias} d (${i.vence})` : i.venceDias === 0 ? `HOY (${i.vence})` : i.venceDias === 1 ? `mañana (${i.vence})` : `en ${i.venceDias} d (${i.vence})`;
const agendaLine = (i: AgendaItem) => `${i.ref} · ${i.cliente} · ${i.par} · ${eur(i.importe)} · ${i.docs} doc${i.palabras ? ` · ${i.palabras} pal ≈ ${i.horas} h` : ""} · vence ${venceLabel(i)}${/Juan/.test(i.quien) ? "" : ` · ${i.quien}`}`;

export function renderVigiaText(v: Vigia): string {
  const out: string[] = [];
  const H = (t: string) => out.push("", "═".repeat(78), t, "═".repeat(78));
  out.push(`VIGÍA DE PEDIDOS · ${madrid(v.generado)} Madrid · ventana ${v.ventanaDias} días`);
  out.push(`solicitudes lavori ${v.solicitudes.length} · leads ${v.leads.length} · presupuestos abiertos ${v.presupuestos.length} · perdidos ${v.perdidos.length} · pedidos vivos ${v.pedidos.length} · ACCIONES ${v.acciones.length}`);

  H(`AGENDA DE HOY — TRADUCIR (Juan): ${v.agenda.traducir.length} pedido(s) · ${v.agenda.palabrasSemana} palabras ≈ ${v.agenda.horasSemana} h ≈ ${v.agenda.diasNecesarios} días a ${DAILY_HOURS} h/día`);
  for (const i of v.agenda.traducir) out.push(`• ${agendaLine(i)}\n    ${i.link}`);
  out.push("", `SEGUIR (colaboradores): ${v.agenda.seguir.length}`);
  for (const i of v.agenda.seguir) out.push(`• ${agendaLine(i)}`);
  if (v.agenda.entregar.length) {
    out.push("", `ENTREGAR AL CLIENTE (el traductor ya entregó): ${v.agenda.entregar.length}`);
    for (const i of v.agenda.entregar) out.push(`• ${i.ref} · ${i.cliente} · ${i.par} · ${eur(i.importe)} · ${i.quien}\n    ${i.link}`);
  }
  if (v.agenda.sinFecha.length) out.push("", `⚠ SIN FECHA DE ENTREGA: ${v.agenda.sinFecha.map((i) => i.ref).join(", ")} → ponerla en la ficha`);
  out.push("", `GESTIÓN (30 min) — las 5 primeras acciones:`);
  v.acciones.slice(0, 5).forEach((a, i) => out.push(`${i + 1}. ${a.que}\n    ${a.link}`));

  H(`1 · SOLICITUDES A LAVORI (${v.solicitudes.length})`);
  for (const s of v.solicitudes) { out.push(`• ${s.ref} ${s.par} · ${s.creada} · ${s.cliente || "?"} · ${s.docs} doc · ${s.palabras ?? "?"} pal · ${s.jurado}`); out.push(`    ${s.situacion}${s.accion ? `\n    ⚠ ${s.accion}\n    ${s.builder}` : ""}`); }
  H(`2 · LEADS DE LA PUERTA SIN PEDIDO (${v.leads.length})`);
  for (const l of v.leads) {
    out.push(`• ${l.email}${l.phone ? ` · ${l.phone}${l.smsMuerto ? " (SMS muerto)" : ""}` : ""}${l.name ? ` · ${l.name}` : ""} · ${l.first}`);
    for (const d of l.docs) out.push(`    ${d.file} (${d.par}, ${d.tipo || "?"}, ${d.palabras ?? "?"} pal) · motor ${d.motor != null ? eur(d.motor) : "—"}`);
    out.push(`    → ${l.accion}${l.wa ? `\n    ${l.wa}` : ""}`);
  }
  H(`3 · PRESUPUESTOS ENVIADOS SIN PAGAR (${v.presupuestos.length})`);
  for (const q of v.presupuestos) {
    out.push(`• ${q.numero} · ${eur(q.total)} · ${q.par} · ${q.cliente} · ${q.email}${q.phone ? ` · ${q.phone}` : ""}`);
    out.push(`    ${q.status} · enviado ${q.enviado} (${q.dias} d) · ${q.abierto ? "abierto" : "NO abierto"} · ${q.recordatorios} recordatorio(s)${q.smsFallido ? " · SMS FALLIDO" : ""}${q.caducado ? " · CADUCADO" : ""}`);
    out.push(`    → ${q.accion}${q.wa ? `\n    ${q.wa}` : ""}`);
  }
  if (v.perdidos.length) out.push("", `  Perdidos en la ventana (${v.perdidos.length}): ${v.perdidos.map((l) => `${l.quoteNumber} ${eur(l.total)} ${pairOf(l.sourceLang, l.targetLang)} [${l.lostReason || "sin motivo"}]`).join(" · ")}`);
  H(`4 · PEDIDOS VIVOS (${v.pedidos.length}${v.archivados ? ` · ${v.archivados} archivado(s) fuera` : ""})`);
  for (const p of v.pedidos) {
    out.push(`• ${p.ref} · ${eur(p.importe)} · ${p.par} · ${p.cliente} · ${p.status} · pagado ${p.pagado} · ${p.asignado ? `→ ${p.asignado}${p.coste != null ? ` (coste ${eur(p.coste)})` : ""}` : p.quien}${p.puente ? ` · ${p.puente}` : ""} · vence ${p.vence}`);
    if (p.accion) out.push(`    ⚠ ${p.accion}\n    ${p.link}`);
  }
  H(`ACCIONES, por urgencia y dinero (${v.acciones.length})`);
  v.acciones.forEach((a, i) => out.push(`${String(i + 1).padStart(2)}. [${"!".repeat(a.urgencia)}${" ".repeat(5 - a.urgencia)} ${eur(a.stake).padStart(10)}] ${a.que}\n    ${a.link}`));
  return out.join("\n");
}

/* ───────────────────────── Render HTML (email 8:00) ───────────────────────── */
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const li = (html: string) => `<li style="margin:0 0 6px;">${html}</li>`;
const box = (title: string, color: string, body: string) =>
  `<div style="margin:12px 0; padding:10px 12px; border:1px solid ${color}55; background:${color}12; border-radius:8px;"><p style="margin:0 0 6px; font-weight:700; color:${color};">${title}</p>${body}</div>`;

export function renderAgendaHtml(v: Vigia): string {
  const a = v.agenda;
  const item = (i: AgendaItem) => {
    const late = i.venceDias != null && i.venceDias < 0;
    const today = i.venceDias === 0;
    const badge = late ? `<b style="color:#b91c1c;">VENCIDO ${-i.venceDias!} d</b>` : today ? `<b style="color:#b45309;">HOY</b>` : i.venceDias == null ? `<b style="color:#b91c1c;">SIN FECHA</b>` : `en ${i.venceDias} d (${i.vence})`;
    return li(`<a href="${i.link}" style="font-weight:600; color:#1e3a8a;">${esc(i.ref)}</a> · ${esc(i.cliente)} · ${esc(i.par)} · ${esc(eur(i.importe))} · ${i.docs} doc${i.palabras ? ` · ${i.palabras} pal ≈ ${i.horas} h` : ""} · ${badge}${/Juan/.test(i.quien) ? "" : ` · ${esc(i.quien)}`}`);
  };
  const traducir = a.traducir.length ? `<ul style="margin:0; padding-left:18px; font-size:13px;">${a.traducir.map(item).join("")}</ul>` : `<p style="margin:0; font-size:13px;">Nada pendiente tuyo. 🎉</p>`;
  const seguir = a.seguir.length ? `<ul style="margin:0; padding-left:18px; font-size:13px;">${a.seguir.map(item).join("")}</ul>` : `<p style="margin:0; font-size:13px;">Sin entregas de colaboradores pendientes.</p>`;
  const entregar = a.entregar.length ? box("📦 ENTREGAR AL CLIENTE (el traductor ya entregó)", "#b91c1c", `<ul style="margin:0; padding-left:18px; font-size:13px;">${a.entregar.map((i) => li(`<a href="${i.link}" style="font-weight:600; color:#1e3a8a;">${esc(i.ref)}</a> · ${esc(i.cliente)} · ${esc(i.par)} · ${esc(eur(i.importe))} · ${esc(i.quien)}`)).join("")}</ul>`) : "";
  const gestion = `<ol style="margin:0; padding-left:18px; font-size:13px;">${v.acciones.slice(0, 6).map((x) => li(`${esc(x.que)} — <a href="${x.link}" style="color:#1e3a8a;">abrir</a>`)).join("")}</ol>`;
  const sinFecha = a.sinFecha.length ? `<p style="margin:8px 0 0; font-size:13px; color:#b91c1c;">⚠ Sin fecha de entrega: ${a.sinFecha.map((i) => esc(i.ref)).join(", ")} — ponla en la ficha.</p>` : "";
  return `
    <h2 style="margin:0 0 4px; font-size:18px;">Agenda de hoy · ${esc(madrid(v.generado).slice(0, 5))}</h2>
    <p style="margin:0 0 10px; font-size:13px; color:#475569;">Traducir: ${a.traducir.length} pedido(s) · ${a.palabrasSemana} palabras ≈ ${a.horasSemana} h ≈ ${a.diasNecesarios} días a ${DAILY_HOURS} h/día. Seguir: ${a.seguir.length}. Acciones de gestión: ${v.acciones.length}.</p>
    ${box("✍️ TRADUCIR (lo tuyo, por vencimiento)", "#1d4ed8", traducir + sinFecha)}
    ${box("👀 SEGUIR (colaboradores)", "#0f766e", seguir)}
    ${entregar}
    ${box("🗂 GESTIÓN — 30 minutos, en este orden", "#b45309", gestion)}
    <p style="margin:14px 0 0; font-size:12px; color:#64748b;">Lista completa (leads, presupuestos sin pagar, solicitudes lavori): en la sesión de Claude, agente <code>vigia-pedidos</code>.</p>`;
}
