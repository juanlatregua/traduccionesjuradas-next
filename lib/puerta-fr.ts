// lib/puerta-fr.ts — PUERTA FR (orden de Juan, 16-nov-2026: «ningún cliente de francés se
// va sin presupuesto o sin pagar»). Lead de la puerta con documentos FR→ES, ≥60 min sin pagar
// y sin presupuesto vivo → presupuesto con la tarifa por documento (el mismo carril que el
// agente de bandeja, quoteFr). Con PUERTA_FR=fr y todo en verde sale solo por email; si no,
// borrador + aviso a Juan. Kill-switch PUERTA_FR = off (defecto) | draft | fr.
// Idempotencia: una fila FunnelEvent (puerta_fr, puerta-fr:{sesión}) se reclama ANTES de actuar.
// Decisiones puras en lib/puerta-fr-math.ts. Lo llama lib/lead-sla.ts (cron cada 10 min).

import { prisma } from "@/lib/prisma";
import { isStaffEmail } from "@/lib/staff-access";
import { sendStaffAlertSMS } from "@/lib/sms";
import { findClientSaidNo, findLiveBlock } from "@/lib/respuesta-guard-db";
import { presupuestoVivoDelCaso, solicitudesVivasDelHilo } from "@/lib/caso/hilo-db";
import { hasPaidOrder, personPaidOrdersWhere } from "@/lib/paid-orders";
import { loadQuoteHashes } from "@/lib/vigia-graph-db";
import { quoteFr } from "@/lib/quote-fr";
import { buildQuoteReply, checkSegments, greetingName, isHouseAddress, splitOrRepeatedReason, FR_DELIVERY_TERM, type ReplyLang } from "@/lib/agente-bandeja-math";
import {
  dedupePuertaRows,
  isRealClientEmail,
  puertaFrAction,
  puertaFrMode,
  puertaSegmentsAreFrEs,
  puertaWaitVerdict,
  segmentsFromPuertaRows,
  PUERTA_FR_WINDOW_HOURS,
  type PuertaFrMode,
  type PuertaRow,
} from "@/lib/puerta-fr-math";

const SITE = "https://www.traduccionesjuradas.net";
const ACTOR = "system:puerta-fr";
const STEP = "puerta_fr";

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const sms = (text: string, context: string) => sendStaffAlertSMS(short(text, 300), context).catch((e) => console.error("[puerta-fr] SMS staff falló", e));

export type PuertaFrOutcome = { session: string; email: string; result: "sent" | "drafted" | "manual" | "skipped" | "error"; detail: string };

const MAX_SESSIONS_PER_RUN = 3;
const STALE_CLAIM_MS = 10 * 60_000;

/** `deadlineAt`: hora límite (ms). Pasada, no se empieza ninguna sesión más. */
export async function runPuertaFr(now = new Date(), opts: { deadlineAt?: number; max?: number } = {}): Promise<{ mode: PuertaFrMode; outcomes: PuertaFrOutcome[] }> {
  const max = opts.max ?? MAX_SESSIONS_PER_RUN;
  const mode = puertaFrMode(process.env.PUERTA_FR);
  if (mode === "off") return { mode, outcomes: [] };

  const since = new Date(now.getTime() - PUERTA_FR_WINDOW_HOURS * 3_600_000);
  const rows = await prisma.documentAnalysis.findMany({
    where: {
      createdAt: { gte: since },
      clientEmail: { not: null },
      sessionToken: { not: null },
      orderId: null,
      fileUrl: { not: "" },
      gdprConsent: true,
      NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }, { sessionToken: { startsWith: "entrada:" } }],
      AND: [{ OR: [{ source: null }, { source: { notIn: ["lector", "prueba"] } }] }],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true, fileName: true, fileUrl: true, mimeType: true, fileHash: true, pageCount: true, estimatedWords: true,
      sourceLanguage: true, targetLanguage: true, analysisJson: true, status: true, createdAt: true, orderReference: true, marketingConsent: true,
      sessionToken: true, clientEmail: true, clientName: true, clientPhone: true, casoId: true, urgency: true, neededBy: true,
    },
  });
  const bySession = new Map<string, typeof rows>();
  for (const r of rows) bySession.set(r.sessionToken!, [...(bySession.get(r.sessionToken!) || []), r]);

  const colabEmails = new Set(
    (await prisma.collaborator.findMany({ select: { email: true } })).map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const outcomes: PuertaFrOutcome[] = [];
  for (const [token, list] of bySession) {
    if (outcomes.length >= max) break;
    if (opts.deadlineAt && Date.now() > opts.deadlineAt) break;
    const email = String(list.find((r) => r.clientEmail)?.clientEmail || "").trim().toLowerCase();
    // Filtros baratos: sin claim, se reintentan en la próxima pasada (o caducan a las 24 h).
    if (!isRealClientEmail(email) || isStaffEmail(email) || isHouseAddress(email) || colabEmails.has(email)) continue;
    if (!list.every((r) => (r.sourceLanguage || "").toLowerCase() === "fr" && (r.targetLanguage || "").toLowerCase() === "es")) continue;
    if (puertaWaitVerdict(list.map((r) => r.createdAt), now) !== "ready") continue;
    // Análisis sin terminar, checkout empezado (PAYMENT_PENDING/orderReference): fuera.
    if (!list.every((r) => r.status === "QUOTE_GENERATED" && !r.orderReference)) continue;
    try {
      const o = await processSession(token, email, list, mode, now);
      if (o) outcomes.push(o);
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      console.error("[puerta-fr]", token, msg);
      await patchTrace(token, { result: "error", detail: short(msg, 200) });
      await sms(`Puerta FR: error con el lead ${email} (${short(msg, 100)}). Revisar: ${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(token)}`, `puerta_fr_error ${token}`);
      outcomes.push({ session: token, email, result: "error", detail: short(msg, 200) });
    }
  }
  return { mode, outcomes };
}

const patchTrace = (token: string, data: Record<string, unknown>) =>
  prisma.funnelEvent
    .update({ where: { sessionId_step: { sessionId: `puerta-fr:${token}`, step: STEP } }, data: { metadata: data as any } })
    .catch((e) => console.error("[puerta-fr] rastro no actualizado", token, e));

async function processSession(
  token: string,
  email: string,
  list: any[],
  mode: PuertaFrMode,
  now: Date
): Promise<PuertaFrOutcome | null> {
  const out = (result: PuertaFrOutcome["result"], detail: string): PuertaFrOutcome => ({ session: token, email, result, detail });
  const phone = list.find((r: any) => r.clientPhone)?.clientPhone || null;
  const name = list.find((r: any) => r.clientName)?.clientName || null;
  const expedienteRef = `puerta:${token}`;
  const leadAt = new Date(Math.min(...list.map((r: any) => r.createdAt.getTime())));
  const paidWhere = personPaidOrdersWhere({ email, phone }, now);

  // Quien ya pagó o ya tiene presupuesto vivo en su caso/par no es un lead (la misma comprobación que lead-nudge).
  const [paidOrders, existing] = await Promise.all([
    paidWhere ? prisma.order.findMany({ where: paidWhere, select: { clientEmail: true, clientPhone: true, paidAt: true, quoteId: true, documentAnalyses: { select: { fileHash: true } } } }) : [],
    prisma.quote.findFirst({ where: { deletedAt: null, expedienteRef }, select: { id: true } }),
  ]);
  const qHashes = paidOrders.some((o) => o.quoteId) ? await loadQuoteHashes([...new Set(paidOrders.map((o) => o.quoteId).filter((x): x is string => !!x))]) : new Map<string, string[]>();
  const paid = hasPaidOrder(
    { email, phone, at: leadAt, hashes: list.map((r: any) => r.fileHash) },
    paidOrders.map((o) => ({ ...o, paidAt: o.paidAt!, fileHashes: [...o.documentAnalyses.map((d) => d.fileHash), ...(o.quoteId ? qHashes.get(o.quoteId) || [] : [])] }))
  );
  if (paid || existing) return null;
  const casoId = list.find((r: any) => r.casoId)?.casoId || null;
  if (casoId && (await presupuestoVivoDelCaso(casoId, "FR>ES"))) return null;
  if (await findLiveBlock({ email, phone }, { leadAt })) return null;
  // Ya habló o dijo que no: no se le empuja (si la guarda lanza, cae al catch y no se envía).
  if (await findClientSaidNo({ email, phone })) return null;

  // Actividad del staff sobre esta persona: ya la lleva alguien, la puerta FR no se mete.
  if (await staffAlreadyOnIt(token, email, casoId)) return null;

  // Reclamo atómico: una pasada por sesión, aunque dos ejecuciones se pisen. Un reclamo que
  // quedó a medias (la ejecución murió) se retoma a los 10 min; si no, la sesión se perdería.
  try {
    await prisma.funnelEvent.create({ data: { sessionId: `puerta-fr:${token}`, reference: "puerta-fr", step: STEP, metadata: { mode, result: "claimed" } } });
  } catch {
    const prev = await prisma.funnelEvent.findUnique({ where: { sessionId_step: { sessionId: `puerta-fr:${token}`, step: STEP } } }).catch(() => null);
    const stale = prev && (prev.metadata as any)?.result === "claimed" && now.getTime() - prev.createdAt.getTime() > STALE_CLAIM_MS;
    if (!stale) return null;
    const took = await prisma.funnelEvent.updateMany({ where: { id: prev.id, createdAt: prev.createdAt }, data: { createdAt: now, metadata: { mode, result: "claimed", retaken: true } } });
    if (took.count === 0) return null;
  }

  const builderUrl = `${SITE}/zona-traductor/presupuesto?session=${encodeURIComponent(token)}`;
  const manual = async (reason: string): Promise<PuertaFrOutcome> => {
    await patchTrace(token, { mode, result: "manual", detail: short(reason, 200) });
    await sms(`Puerta FR (a mano): ${name || email} sin precio automático (${short(reason, 120)}). Presupuesto: ${builderUrl}`, `puerta_fr_manual ${token}`);
    return out("manual", reason);
  };

  const rows = dedupePuertaRows(list as PuertaRow[]);
  const seg = segmentsFromPuertaRows(rows);
  if (!seg.ok) return manual(seg.reason);
  const fr = puertaSegmentsAreFrEs(seg.segments);
  if (!fr.ok) return manual(fr.reason);
  const repeated = splitOrRepeatedReason(rows, seg.segments);
  if (repeated) return manual(repeated);
  if (!checkSegments(seg.segments).ok) return manual("segmentos no válidos");

  const q = await quoteFr({
    segments: seg.segments,
    contacto: { email, phone, name },
    expedienteRef,
    locale: "es",
    autoPricedBy: "puerta-fr",
    actor: ACTOR,
  });
  if (!q.ok) return manual(q.reason);

  // quoteFr solo devuelve ok si TODOS los documentos tienen tarifa por documento.
  const marketingConsent = list.some((r: any) => r.marketingConsent === true);
  const action = puertaFrAction({ mode, allTariffed: true, decision: q.decision, marketingConsent });
  const quote = q.quote;
  const reviewUrl = `${SITE}/zona-traductor/presupuestos/${quote.id}`;
  if (action.action !== "send") {
    const reasons = action.action === "draft" ? action.reasons : ["apagado"];
    await patchTrace(token, { mode, result: "drafted", quote: quote.quoteNumber, detail: short(reasons.join("; "), 200) });
    await sms(`Puerta FR (borrador): ${quote.quoteNumber} (${q.totalEur.toFixed(2)} €) para ${name || email} — ${short(reasons[0] || "", 100)}. Ficha: ${reviewUrl}`, `puerta_fr_borrador ${quote.quoteNumber}`);
    return out("drafted", `${quote.quoteNumber}: ${reasons.join("; ")}`);
  }

  // Envío: el presupuesto y la pregunta de la fecha; sin promoción (LSSI). finalizeAndSendQuote adjunta el PDF.
  const askDeadline = !list.some((r: any) => r.urgency || r.neededBy);
  const lang = await clientLang(email);
  const body = buildQuoteReply({
    lang,
    name: greetingName(name),
    items: q.items,
    netEur: q.netEur,
    totalEur: q.totalEur,
    deliveryTerm: quote.deliveryTerm || FR_DELIVERY_TERM,
    isFr: true,
    payUrl: `${SITE}/q/${quote.publicToken}`,
    askDeadline,
  });
  const { finalizeAndSendQuote } = await import("@/lib/quote-send");
  await finalizeAndSendQuote({
    quoteId: quote.id,
    actorEmail: ACTOR,
    skipEmail: false,
    requireDraft: true,
    customSubject: lang === "fr" ? `Devis ${quote.quoteNumber} · traduction assermentée` : lang === "en" ? `Quote ${quote.quoteNumber} · sworn translation` : `Presupuesto ${quote.quoteNumber} · traducción jurada`,
    customBody: body,
  });
  await patchTrace(token, { mode, result: "sent", quote: quote.quoteNumber });
  await sms(`Puerta FR: presupuesto ${quote.quoteNumber} (${q.totalEur.toFixed(2)} €) enviado a ${email}`, `puerta_fr_enviado ${quote.quoteNumber}`);
  return out("sent", quote.quoteNumber);
}

/** Idioma del cliente: el de su última sesión de la puerta (OrderSession.clientLocale); si no se sabe, español. */
async function clientLang(email: string): Promise<ReplyLang> {
  const os = await prisma.orderSession
    .findFirst({ where: { clientEmail: { equals: email, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, select: { clientLocale: true } })
    .catch(() => null);
  const l = String(os?.clientLocale || "").toLowerCase();
  return l === "fr" || l === "en" ? l : "es";
}

/** ¿Hay ya trabajo del staff sobre esta persona? (misma_persona, solicitud del caso, borrador/presupuesto del constructor, respuesta enviada). */
async function staffAlreadyOnIt(token: string, email: string, casoId: string | null): Promise<boolean> {
  const week = new Date(Date.now() - 7 * 864e5);
  const [misma, solicitudes, casoEv, inbound] = await Promise.all([
    prisma.funnelEvent.findFirst({ where: { sessionId: `puerta:${token}`, step: "misma_persona" }, select: { id: true } }),
    solicitudesVivasDelHilo(casoId, { expedienteRef: `puerta:${token}` }),
    casoId ? prisma.casoEvento.findFirst({ where: { casoId, tipo: { startsWith: "solicitud" } }, select: { id: true } }) : Promise.resolve(null),
    prisma.inboundEmail.findFirst({
      where: { fromEmail: { equals: email, mode: "insensitive" }, receivedAt: { gte: week }, OR: [{ repliedAt: { not: null } }, { status: { in: ["REPLIED", "DRAFTED"] } }, { quoteId: { not: null } }] },
      select: { id: true },
    }),
  ]);
  // Un presupuesto (borrador del constructor incluido) a nombre del mismo email o de la misma sesión.
  const quote = await prisma.quote.findFirst({
    where: { deletedAt: null, createdAt: { gte: week }, OR: [{ customerEmail: { equals: email, mode: "insensitive" } }, { expedienteRef: { in: [`puerta:${token}`, `puerta:exp:${token}`] } }] },
    select: { id: true },
  });
  return !!(misma || solicitudes.length || casoEv || inbound || quote);
}
