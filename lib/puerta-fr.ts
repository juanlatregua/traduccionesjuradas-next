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
import { presupuestoVivoDelCaso } from "@/lib/caso/hilo-db";
import { quoteFr } from "@/lib/quote-fr";
import { buildQuoteReply, checkSegments, greetingName, splitOrRepeatedReason, FR_DELIVERY_TERM } from "@/lib/agente-bandeja-math";
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

export async function runPuertaFr(now = new Date()): Promise<{ mode: PuertaFrMode; outcomes: PuertaFrOutcome[] }> {
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
      NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }],
      AND: [{ OR: [{ source: null }, { source: { not: "lector" } }] }],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true, fileName: true, fileUrl: true, mimeType: true, fileHash: true, pageCount: true, estimatedWords: true,
      sourceLanguage: true, targetLanguage: true, analysisJson: true, status: true, createdAt: true,
      sessionToken: true, clientEmail: true, clientName: true, clientPhone: true, casoId: true, urgency: true, neededBy: true,
    },
  });
  const bySession = new Map<string, typeof rows>();
  for (const r of rows) bySession.set(r.sessionToken!, [...(bySession.get(r.sessionToken!) || []), r]);

  const outcomes: PuertaFrOutcome[] = [];
  for (const [token, list] of bySession) {
    const email = String(list.find((r) => r.clientEmail)?.clientEmail || "").trim().toLowerCase();
    // Filtros baratos: sin claim, se reintentan en la próxima pasada (o caducan a las 24 h).
    if (!isRealClientEmail(email) || isStaffEmail(email)) continue;
    if (!list.every((r) => (r.sourceLanguage || "").toLowerCase() === "fr")) continue;
    if (puertaWaitVerdict(list.map((r) => r.createdAt), now) !== "ready") continue;
    if (!list.every((r) => r.status === "QUOTE_GENERATED" || r.status === "PAYMENT_PENDING")) continue;
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
  const day = new Date(now.getTime() - 24 * 3_600_000);

  // Quien ya pagó o ya tiene presupuesto vivo en su caso/par no es un lead (la misma comprobación que lead-nudge).
  const [paid, existing] = await Promise.all([
    prisma.order.findFirst({ where: { clientEmail: { equals: email, mode: "insensitive" }, paymentStatus: "PAID", paidAt: { gte: day } }, select: { id: true } }),
    prisma.quote.findFirst({ where: { deletedAt: null, expedienteRef }, select: { id: true } }),
  ]);
  if (paid || existing) return null;
  const casoId = list.find((r: any) => r.casoId)?.casoId || null;
  if (casoId && (await presupuestoVivoDelCaso(casoId, "FR>ES"))) return null;
  const leadAt = new Date(Math.min(...list.map((r: any) => r.createdAt.getTime())));
  if (await findLiveBlock({ email, phone }, { leadAt })) return null;
  // Ya habló o dijo que no: no se le empuja (si la guarda lanza, cae al catch y no se envía).
  if (await findClientSaidNo({ email, phone })) return null;

  // Reclamo atómico: una pasada por sesión, aunque dos ejecuciones se pisen.
  try {
    await prisma.funnelEvent.create({ data: { sessionId: `puerta-fr:${token}`, reference: "puerta-fr", step: STEP, metadata: { mode, result: "claimed" } } });
  } catch {
    return null;
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
  const action = puertaFrAction({ mode, allTariffed: true, decision: q.decision });
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
  const body = buildQuoteReply({
    lang: "es",
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
    customSubject: `Presupuesto ${quote.quoteNumber} · traducción jurada`,
    customBody: body,
  });
  await patchTrace(token, { mode, result: "sent", quote: quote.quoteNumber });
  await sms(`Puerta FR: presupuesto ${quote.quoteNumber} (${q.totalEur.toFixed(2)} €) enviado a ${email}`, `puerta_fr_enviado ${quote.quoteNumber}`);
  return out("sent", quote.quoteNumber);
}
