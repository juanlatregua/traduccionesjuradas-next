// VIGÍA DE PEDIDOS + AGENDA DE HOY — radiografía determinista de lo que hay que
// recuperar y de lo que Juan tiene que traducir/seguir. Solo lectura.
// La consumen: scripts/vigia-pedidos.ts (CLI del agente vigia-pedidos) y el cron
// /api/cron/vigia-agenda (email de las 8:00). Una sola fuente de verdad.
import { prisma } from "@/lib/prisma";
import { isCreditOutstanding, creditDaysToDue, isMonthlySecured, isPeriodClosed, periodLabel } from "@/lib/credit-terms";
import { PersonIndex, chaseState, consolidate, duplicateOf, intermediaryEmails, personKeys, primaryKey, textKeys, normEmail, MAX_TOUCHES, type ActionRow, type ChaseMark, type ContactLog, type RawAction } from "@/lib/vigia-persona";
import { vigiaMarkUrl } from "@/lib/vigia-mark";

const SITE = "https://www.traduccionesjuradas.net";
const MARGIN_PCT = 12; // horquilla de Juan 10-15 % sobre el coste del jurado (24-ago-2026)
const VAT = 1.21;
const WORDS_PER_HOUR = 300; // ritmo de jurada de Juan para estimar horas
const DAILY_HOURS = 4; // horas de traducción al día que la agenda da por buenas
// Twilio Geo Permissions cerradas a 25-ago-2026: el SMS rebota, hay que ir por WhatsApp/email.
const SMS_DEAD_PREFIXES = ["+55", "+52", "+46", "+49", "+33", "+351", "+31"];
const TZ_OFFSET_MS = 2 * 3600e3; // Madrid en verano (CEST); el cron corre en UTC

// Una fila = una persona (o un pedido) con su acción más importante; ver lib/vigia-persona.ts.
export type VigiaAction = ActionRow;
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
  ocultos: { quien: string; motivo: string }[]; // tratado/pospuesto/ya avisado: no sale en acciones
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

  const actions: RawAction[] = [];
  const ocultos: { quien: string; motivo: string }[] = [];
  const act = (stake: number, urgencia: number, que: string, link: string, extra: Partial<RawAction> = {}) => actions.push({ stake: Math.round(stake), urgencia, que, link, ...extra });

  /* ───────── 0. Datos y grafo de PERSONAS ───────── */
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
  const [leadDocs, windowQuotes, openQuotes, marcasDb] = await Promise.all([
    prisma.documentAnalysis.findMany({
      // El Lector de requerimientos pide email (24-sep) pero no es un lead de traducción.
      where: { createdAt: { gte: SINCE }, clientEmail: { not: null }, orderId: null, NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }], AND: [{ OR: [{ source: null }, { source: { not: "lector" } }] }] },
      orderBy: { createdAt: "asc" },
      select: { clientEmail: true, clientName: true, clientPhone: true, fileName: true, documentType: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, quoteAmount: true, sessionToken: true, createdAt: true, marketingConsent: true, fileHash: true },
    }),
    prisma.quote.findMany({ where: { createdAt: { gte: SINCE }, deletedAt: null }, select: { id: true, customerEmail: true, customerPhone: true, quoteNumber: true, status: true, sourceLang: true, targetLang: true, expedienteRef: true, holderNames: true, createdAt: true } }),
    prisma.quote.findMany({
      // Sin pedido: los de carril de crédito ya tienen pedido y se persiguen por su factura.
      where: { deletedAt: null, status: { in: ["SENT", "OPENED", "ACCEPTED"] }, orders: { none: {} } },
      orderBy: { sentAt: "asc" },
      include: { messageLogs: { where: { createdAt: { gte: new Date(NOW.getTime() - 90 * 864e5) } }, select: { channel: true, type: true, status: true, subject: true, sentAt: true, createdAt: true } }, _count: { select: { accessEvents: true } } },
    }),
    // Marcas «Ya lo traté» / «Posponer» (app/api/vigia/marca): FunnelEvent «vigia:<clave>».
    prisma.funnelEvent.findMany({ where: { step: { in: ["vigia_tratado", "vigia_posponer"] }, createdAt: { gte: new Date(NOW.getTime() - 8 * 864e5) } }, select: { sessionId: true, step: true, createdAt: true, metadata: true } }).catch(() => []),
  ]);
  type QLite = { holder: string | null; name: string; id: string; email: string; phone: string | null; numero: string; status: string; par: string; expRef: string | null; createdAt: Date };
  const quoteMap = new Map<string, QLite>();
  for (const q of [...windowQuotes, ...openQuotes]) quoteMap.set(q.id, { holder: (q as any).holderNames ?? null, name: (q as any).customerName ?? "", id: q.id, email: q.customerEmail, phone: (q as any).customerPhone ?? null, numero: q.quoteNumber, status: q.status, par: pairOf(q.sourceLang, q.targetLang), expRef: q.expedienteRef, createdAt: q.createdAt });
  const allQuotes = [...quoteMap.values()];
  // Huellas de los documentos de cada presupuesto (misma vía que lavori-dup-guard).
  const qLines = allQuotes.length ? await prisma.quoteLine.findMany({ where: { quoteId: { in: allQuotes.map((q) => q.id) }, sourceFileUrl: { not: null } }, select: { quoteId: true, sourceFileUrl: true } }).catch(() => []) : [];
  const lineUrls = [...new Set(qLines.map((l) => l.sourceFileUrl!))];
  const hashRows = lineUrls.length ? await prisma.documentAnalysis.findMany({ where: { fileUrl: { in: lineUrls }, fileHash: { not: null } }, select: { fileUrl: true, fileHash: true } }).catch(() => []) : [];
  const hashOfUrl = new Map(hashRows.map((r) => [r.fileUrl, r.fileHash!]));
  const hashesOfQuote = new Map<string, string[]>();
  for (const l of qLines) { const h = hashOfUrl.get(l.sourceFileUrl!); if (h) hashesOfQuote.set(l.quoteId, [...(hashesOfQuote.get(l.quoteId) || []), h]); }

  const multi = intermediaryEmails(allQuotes);
  const quoteKeys = (q: QLite) => multi.has(normEmail(q.email)) ? personKeys({ refs: [q.expRef], hashes: hashesOfQuote.get(q.id), quoteIds: [q.id] }) : personKeys({ emails: [q.email], phones: [q.phone], refs: [q.expRef], hashes: hashesOfQuote.get(q.id), quoteIds: [q.id] });
  const solKeys = (s: (typeof solicitudes)[number]) => [...textKeys(s.customerHint), ...personKeys({ refs: [s.expedienteRef], quoteIds: [s.quoteId] }), `r:${s.ref}`];
  const leadKeys = (d: (typeof leadDocs)[number]) => personKeys({ emails: [d.clientEmail], phones: [d.clientPhone], sessions: [d.sessionToken], hashes: [d.fileHash] });
  const orderKeys = (o: { clientEmail: string | null; clientPhone: string | null }) => personKeys({ emails: [o.clientEmail], phones: [o.clientPhone] });
  // Huella del documento: une lead↔solicitud↔presupuesto de quien no ha comprado; nunca arrastra
  // a otra persona a quien ya pagó (otro email y otro teléfono con el mismo PDF).
  const graphItems: { keys: string[]; name?: string | null }[] = [
    ...allQuotes.map((q) => ({ keys: quoteKeys(q), name: q.name })),
    ...solicitudes.map((x) => ({ keys: solKeys(x) })),
    ...leadDocs.map((d) => ({ keys: leadKeys(d), name: d.clientName })),
    ...paidOrdersWindow.map((o) => ({ keys: orderKeys(o), name: o.clientName })),
  ];
  const idx0 = new PersonIndex(graphItems.map((i) => ({ ...i, keys: i.keys.filter((k) => !k.startsWith("h:")) })));
  const paid0 = new Set(paidOrdersWindow.map((o) => idx0.rootOf(orderKeys(o))).filter((r): r is string => !!r));
  const idx = new PersonIndex(graphItems.map((i) => { const r0 = idx0.rootOf(i.keys.filter((k) => !k.startsWith("h:"))); return r0 && paid0.has(r0) ? { ...i, keys: i.keys.filter((k) => !k.startsWith("h:")) } : i; }));
  const rootOf = (keys: string[]) => idx.rootOf(keys) ?? keys[0] ?? null;
  const quotesOfRoot = new Map<string, QLite[]>();
  for (const q of allQuotes) { const r = rootOf(quoteKeys(q)); if (r) quotesOfRoot.set(r, [...(quotesOfRoot.get(r) || []), q]); }
  const solsOfRoot = new Map<string, (typeof solicitudes)[number][]>();
  for (const s of solicitudes) { const r = rootOf(solKeys(s)); if (r) solsOfRoot.set(r, [...(solsOfRoot.get(r) || []), s]); }
  const paidRoots = new Set(paidOrdersWindow.map((o) => rootOf(orderKeys(o))).filter((r): r is string => !!r));

  // Qué se le ha dicho ya a cada persona (MessageLog de todos sus presupuestos + marcas).
  const marksByKey = new Map<string, ChaseMark[]>();
  for (const m of marcasDb) {
    const k = m.sessionId.replace(/^vigia:/, "");
    marksByKey.set(k, [...(marksByKey.get(k) || []), { kind: m.step === "vigia_posponer" ? "posponer" : "tratado", at: m.createdAt, mirrored: !!(m.metadata as any)?.quoteId }]);
  }
  const logsOfRoot = new Map<string, ContactLog[]>();
  const opensOfRoot = new Map<string, number>();
  for (const q of openQuotes) {
    const r = rootOf(quoteKeys(quoteMap.get(q.id)!));
    if (!r) continue;
    logsOfRoot.set(r, [...(logsOfRoot.get(r) || []), ...q.messageLogs.map((m) => ({ channel: m.channel, type: m.type, status: m.status, at: m.sentAt ?? m.createdAt, body: m.subject }))]);
    opensOfRoot.set(r, (opensOfRoot.get(r) || 0) + q._count.accessEvents);
  }
  const chaseMemo = new Map<string, ReturnType<typeof chaseState>>();
  const chaseOf = (root: string | null) => {
    const k = root || "";
    if (!chaseMemo.has(k)) {
      const keys = root ? [root, ...idx.keysOf(root)] : [];
      chaseMemo.set(k, chaseState(root ? logsOfRoot.get(root) || [] : [], keys.flatMap((x) => marksByKey.get(x) || []), NOW, root ? opensOfRoot.get(root) || 0 : 0));
    }
    return chaseMemo.get(k)!;
  };
  const personExtra = (root: string | null, quoteId?: string | null, own?: { key: string; line: string }): Partial<RawAction> =>
    root ? { key: `p:${root}`, persona: { key: own?.key || primaryKey([...idx.keysOf(root)].sort()) || root, quoteId: quoteId ?? null }, estado: own ? own.line : chaseOf(root).line } : {};
  const hiddenSeen = new Set<string>();
  /** true = tratado/pospuesto/ya avisado hace poco: la acción no sale (y queda anotado en «ocultos»). */
  const isHidden = (root: string | null, quien: string, force?: string) => {
    const c = chaseOf(root);
    const motivo = force || c.reason;
    if (!motivo) return false;
    const k = `${root}|${quien}`;
    if (!hiddenSeen.has(k)) { hiddenSeen.add(k); ocultos.push({ quien, motivo }); }
    return true;
  };

  /* ───────── 1. Solicitudes a lavori ───────── */
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
    const root = rootOf(solKeys(s));
    const px = personExtra(root, null);
    // ¿La persona ya tiene presupuesto del mismo par posterior a la solicitud? (Yannick, Susana)
    const dup = duplicateOf(s, root ? solsOfRoot.get(root) || [] : [], root ? quotesOfRoot.get(root) || [] : []);
    const qPersona = q ? null : dup.quote;
    const hermana = dup.hermana;
    const coste = s.priceCents != null ? s.priceCents / 100 : null;
    const sugerido = coste != null ? coste * (1 + MARGIN_PCT / 100) : null;
    let situacion: string = s.status;
    let accion: string | null = null;
    const builder = q ? `${SITE}/zona-traductor/presupuestos/${q.id}` : `${SITE}/zona-traductor/presupuesto?lead=${encodeURIComponent(s.ref)}`;
    if (s.status === "SENT") {
      const h = hoursAgo(s.createdAt) ?? 0;
      situacion = `SENT hace ${h} h · ${s.candidatos.length} candidato(s)`;
      if (h >= 24) {
        if (hermana || qPersona) {
          const de = hermana ? `la solicitud ${hermana.ref} (${hermana.status})` : `el presupuesto ${qPersona!.numero}`;
          accion = `duplicada: la misma persona y par ya tiene ${de} → retirar esta solicitud en lavori`;
          act(0, 1, `Solicitud ${s.ref} ${s.par} (${s.customerHint || "?"}) DUPLICADA de ${hermana ? hermana.ref : qPersona!.numero} → retirarla en lavori`, builder, px);
        } else {
          accion = `sin precio del jurado tras ${h} h → reclamar al jurado por lavori o cambiar de candidato (builder)`;
          act((s.words || 400) * 0.1, 3, `Solicitud ${s.ref} ${s.par} (${s.customerHint || "?"}) lleva ${h} h sin precio → reclamar/cambiar candidato`, builder, px);
        }
      }
    } else if (s.status === "PRICED" && pedido) {
      situacion = `PRICED ${eur(coste!)} por ${s.miembroNombre || "?"} → atada al pedido ${pedido.reference} (${pedido.status})`;
    } else if ((s.status === "PRICED" || s.status === "ACCEPTED") && !q && qPersona) {
      situacion = `${s.status} ${coste != null ? eur(coste) : "sin cifra"} → la persona ya tiene el presupuesto ${qPersona.numero} (${qPersona.status})`;
    } else if ((s.status === "PRICED" || s.status === "ACCEPTED") && !q && coste != null) {
      situacion = `${s.status} ${eur(coste!)} por ${s.miembroNombre || "?"} el ${madrid(s.updatedAt)} · SIN PRESUPUESTO`;
      accion = `montar presupuesto: coste ${eur(coste!)} + ${MARGIN_PCT} % = ${eur(sugerido!)} neto → ${eur(sugerido! * VAT)} con IVA`;
      if (!isHidden(root, `solicitud ${s.ref}`)) act(sugerido!, 4, `Presupuesto a ${s.customerHint || s.ref} (${s.par}): coste ${eur(coste!)} de ${s.miembroNombre || "?"} → ${eur(sugerido!)} +IVA = ${eur(sugerido! * VAT)}`, builder, px);
    } else if (s.status === "ACCEPTED" && !q && coste == null) {
      situacion = `ACCEPTED SIN CIFRA por ${s.miembroNombre || "?"} el ${madrid(s.updatedAt)} · SIN PRESUPUESTO`;
      accion = `el jurado aceptó sin pasar precio → acordar coste con ${s.miembroNombre || "el jurado"} y montar presupuesto`;
      if (!isHidden(root, `solicitud ${s.ref}`)) act((s.words || 400) * 0.1, 4, `Solicitud ${s.ref} ${s.par} (${s.customerHint || "?"}): ${s.miembroNombre || "el jurado"} aceptó SIN cifra → acordar coste y montar presupuesto`, builder, px);
    } else if ((s.status === "PRICED" || s.status === "ACCEPTED") && q) {
      situacion = `${s.status} ${coste != null ? eur(coste) : "sin cifra"} → presupuesto ${q.quoteNumber} ${q.status} (${eur(Number(q.total))})`;
    }
    return {
      ref: s.ref, par: s.par, status: s.status, creada: madrid(s.createdAt), cliente: s.customerHint || "", docs: s.docsCount, palabras: s.words,
      jurado: s.miembroNombre || (s.candidatos.length ? `${s.candidatos.length} cand.` : "carril"), coste, quote: q?.quoteNumber || qPersona?.numero || null, pedido: pedido?.reference || null, situacion, accion, builder,
    };
  });

  /* ───────── 2. Leads de la puerta (una fila por PERSONA) ───────── */
  const leadMap = new Map<string, any>();
  for (const d of leadDocs) {
    const email = normEmail(d.clientEmail);
    const root = rootOf(leadKeys(d));
    if (!root || paidRoots.has(root)) continue;
    if (/yopmail\.com$|mailinator\.com$|^prueba@|^test@/.test(email)) continue;
    const covering = quotesOfRoot.get(root) || [];
    const sols = solsOfRoot.get(root) || [];
    const e = leadMap.get(root) || { email, emails: new Set<string>(), root, name: d.clientName, phone: d.clientPhone, first: d.createdAt, docs: [], solicitud: sols[0] || null, quote: covering.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null, consent: false, session: d.sessionToken };
    e.emails.add(email);
    e.name ||= d.clientName; e.phone ||= d.clientPhone; e.consent ||= d.marketingConsent;
    e.docs.push({ file: d.fileName, tipo: d.documentType, par: pairOf(d.sourceLanguage, d.targetLanguage), palabras: d.estimatedWords, motor: d.quoteAmount == null ? null : Number(d.quoteAmount) });
    leadMap.set(root, e);
  }
  const leads = [...leadMap.values()].map((l) => {
    // La misma PDF subida dos veces (dos sesiones/emails) cuenta una vez.
    const seen = new Set<string>();
    l.docs = l.docs.filter((d: any) => { const k = `${d.file}|${d.par}|${d.palabras}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const total = l.docs.reduce((s: number, d: any) => s + (d.motor || 0), 0);
    const fr = l.docs.every((d: any) => /fr/.test(d.par));
    const sinDestino = l.docs.some((d: any) => /unknown|\?/.test(d.par));
    const phone = phoneOf(l.phone, l.email);
    const pares = [...new Set(l.docs.map((d: any) => d.par))].join(", ");
    let accion: string;
    if (l.quote) accion = `ya tiene presupuesto ${l.quote.numero} (${l.quote.status}) → ver bloque presupuestos`;
    else if (l.solicitud) accion = `solicitud ${l.solicitud.ref} ${l.solicitud.status}${l.solicitud.priceCents != null ? ` · jurado ${eur(l.solicitud.priceCents / 100)}` : ""} → ver bloque lavori`;
    else if (sinDestino) accion = `falta el idioma de destino (o el análisis falló) → preguntar al cliente ANTES de pedir precio a nadie`;
    else if (fr) accion = `FR, precio del motor ${eur(total)} ya visto → un toque humano (email/WhatsApp): "¿te ayudo a cerrarlo?"`;
    else accion = `no-FR sin solicitud al colectivo → mandar solicitud desde el builder (?session=) y avisar al cliente`;
    const otros = l.emails.size > 1 ? ` (+${[...l.emails].filter((x: string) => x !== l.email).join(", ")})` : "";
    if (!l.quote && !l.solicitud && !isHidden(l.root, `lead ${l.email}`)) {
      act(total, sinDestino ? 2 : fr ? 2 : 3, `Lead ${l.email}${otros}${phone ? ` · ${phone}` : ""} (${pares}, motor ${eur(total)}): ${sinDestino ? "preguntar idioma de destino" : fr ? "toque humano" : "mandar solicitud a lavori"}`, `${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(l.session || "")}`, personExtra(l.root, null));
    }
    const { emails, root, ...rest } = l;
    return { ...rest, phone, wa: waLink(phone), smsMuerto: smsDead(phone), total, fr, accion, first: madrid(l.first) };
  });

  /* ───────── 3. Presupuestos sin pagar (una acción por PERSONA) ───────── */
  const presupuestos = openQuotes.map((q) => {
    const phone = phoneOf(q.customerPhone, q.customerEmail);
    const sent = q.sentAt || q.createdAt;
    const d = daysAgo(sent) ?? 0;
    const root = rootOf(quoteKeys(quoteMap.get(q.id)!));
    // Estado de seguimiento de ESTE presupuesto (sus MessageLog y sus marcas): un intermediario con varios
    // presupuestos no mezcla toques ni ocultaciones entre ellos.
    const chase = chaseState(q.messageLogs.map((m) => ({ channel: m.channel, type: m.type, status: m.status, at: m.sentAt ?? m.createdAt, body: m.subject })), marksByKey.get(`q:${q.id}`) || [], NOW, q._count.accessEvents);
    const reminders = q.messageLogs.filter((m) => m.type === "REMINDER" && m.status === "SENT").length;
    const smsFailed = q.messageLogs.some((m) => m.channel === "SMS" && m.status === "FAILED");
    const opened = q.status === "OPENED" || !!q.openedAt;
    const caducado = !!q.validUntil && new Date(q.validUntil) < NOW;
    const avisadoCaducado = chase.touches >= 1 || q.messageLogs.some((m) => m.type === "EXPIRED_NOTICE" && m.status === "SENT");
    let accion: string;
    if (caducado) accion = avisadoCaducado ? `caducado el ${madrid(q.validUntil)} y ya avisado → dejarlo o marcar "No aceptado"` : `caducado el ${madrid(q.validUntil)} → último toque por WhatsApp o marcar "No aceptado"`;
    else if (q.status === "ACCEPTED") accion = `ya aceptó y no ha pagado → reenviar enlace de pago`;
    else if (chase.touches >= MAX_TOUCHES) accion = `ya tocado ${chase.touches} veces sin respuesta → marcar "No aceptado"`;
    else if (smsFailed || smsDead(phone)) accion = `SMS muerto (Twilio Geo) → recordatorio a mano por WhatsApp${q.customerEmail.endsWith("@whatsapp.local") ? "" : " o email"}`;
    else if (d >= 3 && !opened) accion = `${d} días sin abrir → WhatsApp corto: "¿lo recibiste?"`;
    else if (d >= 3 && opened) accion = `abierto y sin pagar ${d} días → preguntar qué le frena (precio/plazo)`;
    else accion = `reciente (${d} d) → esperar; el cron recuerda solo`;
    if (d >= 2 || q.status === "ACCEPTED") {
      const quien = `presupuesto ${q.quoteNumber}`;
      if (caducado && avisadoCaducado) ocultos.push({ quien, motivo: "caducado, ya avisado" });
      else if (chase.hidden) ocultos.push({ quien, motivo: chase.reason! });
      else {
        const urg = caducado ? 1 : q.status === "ACCEPTED" ? 4 : chase.touches >= MAX_TOUCHES ? 1 : 2;
        act(Number(q.total), urg, `Presupuesto ${q.quoteNumber} ${eur(Number(q.total))} (${q.customerName}, ${pairOf(q.sourceLang, q.targetLang)}): ${accion.split("→")[1]?.trim() || accion}`, waLink(phone) || `${SITE}/zona-traductor/presupuestos/${q.id}`, personExtra(root, q.id, { key: `q:${q.id}`, line: chase.line }));
      }
    }
    return { numero: q.quoteNumber, cliente: q.customerName, email: q.customerEmail, phone, wa: waLink(phone), par: pairOf(q.sourceLang, q.targetLang), total: Number(q.total), status: q.status, enviado: madrid(sent), dias: d, abierto: opened, recordatorios: reminders, smsFallido: smsFailed, caducado, accion, estado: chase.line, link: `${SITE}/zona-traductor/presupuestos/${q.id}` };
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
      monthlyInvoice: { select: { number: true, status: true, docKind: true, periodKey: true, dueDate: true, paidAt: true, annulledAt: true } },
      events: { where: { OR: [{ type: { startsWith: "lavori." } }, { type: { in: ["order.archived", "order.unarchived", "order.source_document_uploaded", "order.extension_prepared"] } }] }, select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 16 },
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
    // Factura AGRUPADA del mes (4-sep-2026): el borrador ya asegura el trabajo;
    // el dinero se persigue solo cuando la del mes está emitida, por su vencimiento.
    const mensualBorrador = o.monthlyInvoice?.status === "DRAFT" && isMonthlySecured(o.monthlyInvoice);
    const facturaCredito = isCreditOutstanding(o.clientInvoice) ? o.clientInvoice : isCreditOutstanding(o.monthlyInvoice) ? o.monthlyInvoice : null;
    const credito = Boolean(facturaCredito) || mensualBorrador;
    const paid = o.status === "PAID" || o.status === "IN_PROGRESS" || credito;
    const actO = (stake: number, urg: number, que: string, link: string) => act(stake, urg, que, link, { key: `o:${o.reference}`, tier: paid ? 0 : 1 });
    // El traductor ya entregó (sobre de lavori, asignación o campo del pedido) pero el
    // pedido no está DELIVERED: lo que falta es de Juan (papel por mensajería, verificar,
    // enviar al cliente). Caso Stephan 26_DFAA55: Maria entregó el 18-ago, papel sin enviar.
    const entregaTraductor = o.events.find((e) => e.type === "lavori.entrega_subida")?.createdAt || win?.deliveredAt || o.translatorDeliveredAt || null;
    if (paid && entregaTraductor) {
      const dias = daysAgo(entregaTraductor) ?? 0;
      entregar.push({ ...item, quien: `${asignado || quien} entregó ${madrid(entregaTraductor)}` });
      actO(item.importe, dias >= 2 ? 5 : 4, `Pedido ${o.reference} ${eur(item.importe)} ${o.langPair}: ${asignado || "el traductor"} entregó hace ${dias} d y el cliente sigue sin recibirlo → ${o.deliveryType === "paper" ? "enviar el PAPEL por mensajería" : "verificar y entregar"}`, link);
    } else if (paid) {
      if (esDeJuan || /juan silva|^juan$/i.test(asignado || "")) traducir.push(item);
      else if (asignado) seguir.push(item);
      if (!due) { sinFecha.push(item); actO(item.importe, 4, `Pedido ${o.reference} ${eur(item.importe)} ${o.langPair} (${quien}) SIN FECHA DE ENTREGA → ponerla en la ficha`, link); }
    }
    let accion: string | null = null;
    const vencido = !!due && new Date(due) < NOW;
    // Ampliación (3-sep-2026): documento subido DESPUÉS de pagar y sin presupuesto
    // hermano preparado → si nadie actúa, se traduce gratis.
    if (paid && o.paidAt) {
      const paidMs = new Date(o.paidAt).getTime();
      const lastExt = o.events.filter((e) => e.type === "order.extension_prepared").reduce((m, e) => Math.max(m, new Date(e.createdAt).getTime()), 0);
      const nuevos = o.events.filter((e) => e.type === "order.source_document_uploaded" && new Date(e.createdAt).getTime() > paidMs && new Date(e.createdAt).getTime() > lastExt).length;
      if (nuevos > 0) actO(item.importe, 3, `Pedido ${o.reference} ${eur(item.importe)}: ${nuevos} documento(s) subido(s) DESPUÉS del pago → "Ampliar el pedido" (presupuesto hermano, mismo trámite)`, link);
    }
    if (mensualBorrador) {
      accion = `a crédito, en la factura agrupada de ${periodLabel(o.monthlyInvoice?.periodKey)} (borrador)`;
    } else if (facturaCredito) {
      // Sin cobrar pero asegurado: solo se persigue el DINERO cerca del vencimiento.
      const faltan = creditDaysToDue(facturaCredito, NOW) ?? 0;
      const fac = facturaCredito.number || "(sin nº)";
      if (faltan < 0) { accion = `CRÉDITO VENCIDO hace ${-faltan} d (factura ${fac}) → reclamar el cobro`; actO(item.importe, 5, `Pedido ${o.reference} ${eur(item.importe)} a crédito VENCIDO hace ${-faltan} d (factura ${fac}) → reclamar`, link); }
      else if (faltan <= 3) { accion = `a crédito, factura ${fac} vence en ${faltan} d → recordar el pago`; actO(item.importe, 3, `Pedido ${o.reference} ${eur(item.importe)} a crédito vence en ${faltan} d (factura ${fac}) → recordar el pago`, link); }
      else accion = `a crédito, factura ${fac} vence ${madrid(facturaCredito.dueDate)}`;
    } else if (o.status === "PENDING_PAYMENT") {
      if ((hoursAgo(o.createdAt) ?? 0) >= 24) { accion = `pendiente de pago ${daysAgo(o.createdAt)} d → reenviar enlace de pago / preguntar`; const rootO = rootOf(orderKeys(o)); if (!isHidden(rootO, `pedido ${o.reference}`)) act(item.importe, 2, `Pedido ${o.reference} ${eur(item.importe)} sin pagar ${daysAgo(o.createdAt)} d → reenviar enlace de pago`, link, personExtra(rootO, null)); }
    } else if (o.status === "PAID" && !asignado && !fr) {
      accion = `PAGADO SIN TRADUCTOR${lav ? ` (${lav})` : " y sin rastro del puente"} → asignar o solicitar en lavori`;
      actO(item.importe, 5, `Pedido ${o.reference} ${eur(item.importe)} ${o.langPair} pagado hace ${daysAgo(o.paidAt || o.createdAt)} d SIN TRADUCTOR → asignar/lavori`, link);
    } else if (esDeJuan && (vencido || (daysAgo(o.paidAt || o.createdAt) ?? 0) >= 2)) {
      accion = vencido ? `FR VENCIDO (${madrid(due)}) → es tuyo, entregar` : `FR pagado hace ${daysAgo(o.paidAt || o.createdAt)} d, sin entregar → es tuyo`;
      actO(item.importe, vencido ? 5 : 3, `Pedido FR ${o.reference} ${eur(item.importe)} ${vencido ? "VENCIDO" : `pagado hace ${daysAgo(o.paidAt || o.createdAt)} d`} → traducir/entregar (tuyo)`, link);
    } else if (asignado && !entregaTraductor) {
      const viejo = (daysAgo(o.paidAt || o.createdAt) ?? 0) >= 5;
      if (vencido || viejo) { accion = `${vencido ? `VENCIDO (${madrid(due)})` : `${daysAgo(o.paidAt || o.createdAt)} d en curso`} con ${asignado} → reclamar entrega`; actO(item.importe, vencido ? 5 : 3, `Pedido ${o.reference} ${eur(item.importe)} ${vencido ? "VENCIDO" : `${daysAgo(o.paidAt || o.createdAt)} d en curso`} (${asignado}) → reclamar entrega`, link); }
    }
    pedidos.push({ ref: o.reference, cliente: item.cliente, par: o.langPair, importe: item.importe, status: o.status, pagado: madrid(o.paidAt), asignado, quien, coste: win?.quotedPriceCents != null ? win.quotedPriceCents / 100 : o.supplierCostCents != null ? o.supplierCostCents / 100 : null, puente: lav, vence: madrid(due), accion, link });
  }
  /* ───────── 4b. Facturas del mes de un mes YA CERRADO sin emitir ───────── */
  const borradoresMes = await prisma.clientInvoice.findMany({
    where: { status: "DRAFT", docKind: "invoice", periodKey: { not: null } },
    select: { id: true, periodKey: true, fiscalName: true, email: true, totalCents: true, monthlyOrders: { select: { reference: true } } },
  });
  for (const b of borradoresMes) {
    if (!isPeriodClosed(b.periodKey, NOW) || b.monthlyOrders.length === 0) continue;
    act(b.totalCents / 100, 4, `Factura agrupada de ${periodLabel(b.periodKey)} de ${b.fiscalName} (${b.monthlyOrders.length} pedido(s), ${eur(b.totalCents / 100)}) sin emitir → emitirla en la ficha del cliente`, `${SITE}/zona-traductor/clientes/${encodeURIComponent(String(b.email || ""))}`, { key: `f:${b.id}`, tier: 1 });
  }

  const byDue = (a: AgendaItem, b: AgendaItem) => (a.venceDias ?? 99) - (b.venceDias ?? 99);
  traducir.sort(byDue); seguir.sort(byDue);
  const palabrasSemana = traducir.reduce((s, t) => s + (t.palabras || 0), 0);
  const horasSemana = Math.round((palabrasSemana / WORDS_PER_HOUR) * 10) / 10;

  const acciones = consolidate(actions);
  return {
    generado: NOW.toISOString(), ventanaDias: days,
    agenda: { traducir, seguir, entregar, sinFecha, palabrasSemana, horasSemana, diasNecesarios: Math.round((horasSemana / DAILY_HOURS) * 10) / 10 },
    solicitudes: solRows, leads, presupuestos, perdidos: lost.map((l) => ({ ...l, total: Number(l.total) })), pedidos, archivados, ocultos, acciones: acciones,
  };
}

/* ───────────────────────── Render texto (CLI / agente) ───────────────────────── */
const venceLabel = (i: AgendaItem) =>
  i.venceDias == null ? "SIN FECHA" : i.venceDias < 0 ? `VENCIDO ${-i.venceDias} d (${i.vence})` : i.venceDias === 0 ? `HOY (${i.vence})` : i.venceDias === 1 ? `mañana (${i.vence})` : `en ${i.venceDias} d (${i.vence})`;
const agendaLine = (i: AgendaItem) => `${i.ref} · ${i.cliente} · ${i.par} · ${eur(i.importe)} · ${i.docs} doc${i.palabras ? ` · ${i.palabras} pal ≈ ${i.horas} h` : ""} · vence ${venceLabel(i)}${/Juan/.test(i.quien) ? "" : ` · ${i.quien}`}`;

const accionText = (a: VigiaAction) => `${a.que}${a.extras?.length ? `\n    + ${a.extras.join("\n    + ")}` : ""}${a.estado ? `\n    [${a.estado}]` : ""}`;

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
  v.acciones.slice(0, 5).forEach((a, i) => out.push(`${i + 1}. ${accionText(a)}\n    ${a.link}`));

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
  v.acciones.forEach((a, i) => out.push(`${String(i + 1).padStart(2)}. [${"!".repeat(a.urgencia)}${" ".repeat(5 - a.urgencia)} ${eur(a.stake).padStart(10)}] ${accionText(a)}\n    ${a.link}`));
  if (v.ocultos.length) { H(`OCULTOS: ya tratados / pospuestos / avisados hace poco (${v.ocultos.length})`); v.ocultos.forEach((o) => out.push(`• ${o.quien} — ${o.motivo}`)); }
  return out.join("\n");
}

/* ───────────────────────── Render HTML (email 8:00) ───────────────────────── */
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const li = (html: string) => `<li style="margin:0 0 6px;">${html}</li>`;
const box = (title: string, color: string, body: string) =>
  `<div style="margin:12px 0; padding:10px 12px; border:1px solid ${color}55; background:${color}12; border-radius:8px;"><p style="margin:0 0 6px; font-weight:700; color:${color};">${title}</p>${body}</div>`;

const EMAIL_MAX_ROWS = 8;
const btn = (href: string | null, label: string) => (href ? ` <a href="${href}" style="font-size:12px; color:#475569; border:1px solid #cbd5e1; border-radius:4px; padding:1px 6px; text-decoration:none; white-space:nowrap;">${label}</a>` : "");

/** Filas de gestión (una por persona/pedido), con «Ya lo traté» y «Posponer 7 días» firmados. */
export function renderAccionesHtml(rows: VigiaAction[], max = rows.length): string {
  const shown = rows.slice(0, max);
  const items = shown.map((x) => {
    const k = x.persona?.key;
    const marks = k ? btn(vigiaMarkUrl(k, x.persona?.quoteId, "t"), "Ya lo traté") + btn(vigiaMarkUrl(k, x.persona?.quoteId, "p"), "Posponer 7 d") : "";
    const extras = x.extras?.length ? `<br/><span style="font-size:12px; color:#475569;">también: ${x.extras.map(esc).join(" · ")}</span>` : "";
    const estado = x.estado ? `<br/><span style="font-size:12px; color:#64748b;">${esc(x.estado)}</span>` : "";
    return li(`${esc(x.que)} — <a href="${x.link}" style="color:#1e3a8a;">abrir</a>${marks}${extras}${estado}`);
  });
  const rest = rows.length - shown.length;
  const more = rest > 0 ? `<p style="margin:6px 0 0; font-size:12px; color:#64748b;">+${rest} ocultos — <a href="${SITE}/zona-traductor/vigia" style="color:#1e3a8a;">verlos en la agenda</a></p>` : "";
  return `<ol style="margin:0; padding-left:18px; font-size:13px;">${items.join("")}</ol>${more}`;
}

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
  const gestion = renderAccionesHtml(v.acciones, EMAIL_MAX_ROWS);
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
