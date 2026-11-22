// Autoenvío a las 2,5 h (AUTOENVIO_150=on). Cron cada 10 min, solo de 08:00 a 22:00 Madrid.
// Reclamo atómico ANTES de enviar (FunnelEvent «autoenvio_150», sessionId «autoenvio-150:{quoteId}»):
// un presupuesto se intenta UNA vez, salga o falle. Retenidos: «autoenvio_150_hold» (lo lee el informe).
// Decisión pura en lib/autoenvio-150-core.ts; el envío pasa por finalizeAndSendQuote con requireDraft.
import { prisma } from "@/lib/prisma";
import { sendStaffAlertSMS } from "@/lib/sms";
import { decimalToNumber } from "@/lib/quotes";
import { assessAutoPriceRisk } from "@/lib/ai/price-risk";
import { madridParts } from "@/lib/panel-period";
import { AUTOENVIO_MAX_HOURS, AUTOENVIO_ORIGINS, autoenvio150On, autoenvioHourOk, autoenvioVerdict, type AutoenvioInput, type AutoenvioVerdict } from "@/lib/autoenvio-150-core";
import { HOLD_STEP, loadHolds } from "@/lib/autoenvio-150-holds";
import { isEncargoCerradoAutosend } from "@/lib/encargo-cerrado-math";
import { abs, hrefPresupuesto } from "./staff-links.ts";

const STEP = "autoenvio_150";
const ACTOR = "system:autoenvio-150";
const SITE = "https://www.traduccionesjuradas.net";
const MAX_PER_RUN = 5;

type Origin = { leadAt: Date | null; consent: boolean; readingDoubt: string | null };

/** Interruptor de rodaje del carril: AUTOENVIO_150 solo adelanta lo que el carril ya enviaría solo. */
async function carrilOnFor(adminCreatedBy: string | null): Promise<AutoenvioInput["carrilOn"]> {
  if (adminCreatedBy === "system:tarifario") {
    const { isLearnedAutosendOn } = await import("@/lib/learned-rates");
    return isLearnedAutosendOn() ? { ok: true } : { ok: false, reason: "rodaje: LEARNED_RATES_AUTOSEND apagado o tarifario no vivo" };
  }
  if (adminCreatedBy === "system:encargo-cerrado") {
    return isEncargoCerradoAutosend(process.env.ENCARGO_CERRADO_AUTOSEND) ? { ok: true } : { ok: false, reason: "rodaje: ENCARGO_CERRADO_AUTOSEND apagado" };
  }
  return { ok: true };
}

/** Tarifario: las LearnedRate con las que se montó (muestras auto_quote) siguen APPROVED. */
async function rateApprovedFor(q: { id: string; adminCreatedBy: string | null }): Promise<boolean | null> {
  if (q.adminCreatedBy !== "system:tarifario") return null;
  const samples = await prisma.learnedRateSample.findMany({ where: { quoteId: q.id, kind: "auto_quote" }, select: { rate: { select: { status: true } } } });
  return samples.length > 0 && samples.every((s) => s.rate.status === "APPROVED");
}

/** Solicitud a lavori atada al borrador: «lo llevo yo», duplicado por contenido y par de la solicitud. */
async function leadGuards(quoteId: string) {
  const lead = await prisma.lavoriPriceRequest.findFirst({ where: { quoteId }, orderBy: { createdAt: "desc" } });
  if (!lead) return { lead: null, heldByJuan: false, duplicate: null as string | null, leadPar: null as string | null };
  const { findLiveLavoriDuplicate } = await import("@/lib/lavori-dup-guard");
  const dup = await findLiveLavoriDuplicate({ par: lead.par, contentKey: lead.contentKey, expedienteRef: lead.expedienteRef, excludeRef: lead.ref });
  return { lead, heldByJuan: Boolean(lead.heldByJuanAt), duplicate: dup ? `ya hay otro encargo vivo para estos documentos (${dup.ref}, ${dup.status})` : null, leadPar: lead.par };
}

async function originOf(q: { id: string; expedienteRef: string | null }): Promise<Origin> {
  const ref = q.expedienteRef || "";
  // Consentimiento: se exige marketingConsent (el mismo que la puerta FR, LSSI) aunque un presupuesto
  // pedido no sea publicidad; la puerta vieja lo pide siempre antes de subir, así que casi nunca frena.
  if (ref.startsWith("puerta:") && !ref.startsWith("puerta:exp:")) {
    const rows = await prisma.documentAnalysis.findMany({
      where: { sessionToken: ref.slice("puerta:".length) },
      select: { fileName: true, createdAt: true, gdprConsent: true, marketingConsent: true, analysisJson: true },
    });
    if (rows.length) {
      const doubts: string[] = [];
      for (const r of rows) {
        const a = r.analysisJson as any;
        const persisted = Array.isArray(a?.price_risk?.reasons) ? a.price_risk.reasons : [];
        const re = a?.document_type ? assessAutoPriceRisk({ analysis: a, fileName: r.fileName }) : { risky: false, reasons: [] };
        if (persisted.length || a?.price_risk?.risky || re.risky || re.reasons.length) doubts.push(`${r.fileName} (${[...new Set([...persisted, ...re.reasons])].join(", ") || "riesgo"})`);
        if (a?.document_metrics?.is_legible === false) doubts.push(`${r.fileName} poco legible`);
      }
      return {
        leadAt: new Date(Math.min(...rows.map((r) => r.createdAt.getTime()))),
        consent: rows.some((r) => r.gdprConsent && r.marketingConsent === true),
        readingDoubt: doubts.length ? doubts.join("; ") : null,
      };
    }
  }
  if (ref.startsWith("entrada:")) {
    const e = await prisma.entrada.findUnique({ where: { id: ref.slice("entrada:".length) }, select: { createdAt: true, emailVerifiedAt: true, marketingConsentAt: true } });
    // La lectura nueva solo da «limpio» en francés: fuera de FR, sin revisar = dudosa.
    if (e) return { leadAt: e.createdAt, consent: !!(e.emailVerifiedAt && e.marketingConsentAt), readingDoubt: "lectura de la entrada nueva sin revisar (fuera de FR nunca es limpia)" };
  }
  const inbound = await prisma.inboundEmail.findFirst({ where: { quoteId: q.id }, orderBy: { receivedAt: "asc" }, select: { receivedAt: true, channel: true } });
  if (inbound) return { leadAt: inbound.receivedAt, consent: String(inbound.channel) === "EMAIL", readingDoubt: null };
  return { leadAt: null, consent: false, readingDoubt: null };
}

async function otherLiveOf(q: { id: string; casoId: string | null; expedienteRef: string | null; customerEmail: string; sourceLang: string; targetLang: string }, leadAt: Date | null): Promise<string | null> {
  const from = new Date((leadAt ?? new Date()).getTime() - 2 * 36e5);
  const pair = { sourceLang: q.sourceLang, targetLang: q.targetLang };
  const who = [
    ...(q.expedienteRef ? [{ expedienteRef: q.expedienteRef }] : []),
    ...(q.casoId ? [{ casoId: q.casoId, ...pair }] : []),
    ...(q.customerEmail ? [{ customerEmail: { equals: q.customerEmail, mode: "insensitive" as const }, ...pair }] : []),
  ];
  if (who.length) {
    const sent = await prisma.quote.findFirst({
      where: { id: { not: q.id }, deletedAt: null, OR: who, AND: [{ OR: [{ sentAt: { gte: from } }, { status: { not: "DRAFT" }, createdAt: { gte: from } }] }] },
      select: { quoteNumber: true },
    });
    if (sent) return `ya hay otro presupuesto enviado (${sent.quoteNumber})`;
  }
  if (q.casoId) {
    const { presupuestoVivoDelCaso } = await import("@/lib/caso/hilo-db");
    const vivo = await presupuestoVivoDelCaso(q.casoId, `${q.sourceLang}>${q.targetLang}`);
    if (vivo && vivo.id !== q.id) return `el caso ya tiene el presupuesto vivo ${vivo.quoteNumber}`;
  }
  const order = await prisma.order.findFirst({
    where: { createdAt: { gte: from }, OR: [...(q.casoId ? [{ casoId: q.casoId }] : []), ...(q.customerEmail ? [{ clientEmail: { equals: q.customerEmail, mode: "insensitive" as const } }] : [])] },
    select: { reference: true },
  });
  return order ? `ya hay un pedido (${order.reference})` : null;
}

export async function hold(q: { id: string; quoteNumber: string }, reasons: string[]) {
  const data = { quoteId: q.id, quoteNumber: q.quoteNumber, reasons };
  await prisma.funnelEvent
    .upsert({ where: { sessionId_step: { sessionId: `autoenvio-150:${q.id}`, step: HOLD_STEP } }, create: { sessionId: `autoenvio-150:${q.id}`, reference: "autoenvio-150", step: HOLD_STEP, metadata: data }, update: { metadata: data } })
    .catch((e) => console.error("[autoenvio-150] rastro retenido", q.id, e));
}

export async function runAutoenvio150(now = new Date()) {
  if (!autoenvio150On()) return { mode: "off" as const };
  if (!autoenvioHourOk(madridParts(now).h)) return { mode: "on" as const, skipped: "fuera de 08-22 Madrid" };
  const drafts = await prisma.quote.findMany({
    where: { status: "DRAFT", sentAt: null, deletedAt: null, adminCreatedBy: { in: Object.keys(AUTOENVIO_ORIGINS) }, createdAt: { gte: new Date(now.getTime() - AUTOENVIO_MAX_HOURS * 36e5) } },
    include: { lines: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (!drafts.length) return { mode: "on" as const, borradores: 0, resultados: [] };
  const claimed = new Set(
    (await prisma.funnelEvent.findMany({ where: { step: STEP, sessionId: { in: drafts.map((d) => `autoenvio-150:${d.id}`) } }, select: { sessionId: true } })).map((r) => r.sessionId)
  );
  const { evaluateDraftAutoSend, syncLeadTranslator } = await import("@/lib/cierre");
  const holds = await loadHolds(drafts.map((d) => d.id));
  const out: { quote: string; action: AutoenvioVerdict["action"]; detail?: string }[] = [];
  let sent = 0;
  for (const q of drafts) {
    if (sent >= MAX_PER_RUN) break;
    try {
      const origin = await originOf(q);
      const base = {
        now,
        quote: { ...q, customerEmail: q.customerEmail },
        lines: q.lines.map((l) => ({ quantity: Number(l.quantity) || 1, unitPrice: decimalToNumber(l.unitPrice), supplierUnitCost: l.supplierUnitCost == null ? null : decimalToNumber(l.supplierUnitCost) })),
        discountCents: Math.round(decimalToNumber(q.discountAmount) * 100),
        ...origin,
        claimed: claimed.has(`autoenvio-150:${q.id}`),
        carrilReasons: holds.get(q.id)?.carril ?? [],
        retained: holds.get(q.id)?.retenido ?? false,
        carrilOn: { ok: true } as AutoenvioInput["carrilOn"],
        rateApproved: null as boolean | null,
      };
      // Barato primero: lo que se ignora o espera no consulta guardas.
      const pre = autoenvioVerdict({ ...base, otherLive: null, guards: { action: "send" } });
      if (pre.action === "ignore" || pre.action === "wait") {
        if (pre.action === "wait") out.push({ quote: q.quoteNumber, action: "wait" });
        continue;
      }
      const lg = await leadGuards(q.id);
      const [otherLive, ev, carrilOn, rateApproved] = await Promise.all([
        otherLiveOf(q, origin.leadAt),
        evaluateDraftAutoSend(q.id, { heldByJuan: lg.heldByJuan, duplicate: lg.duplicate, leadPar: lg.leadPar }),
        carrilOnFor(q.adminCreatedBy),
        rateApprovedFor(q),
      ]);
      const v = autoenvioVerdict({ ...base, carrilOn, rateApproved, otherLive, guards: ev.decision as never });
      if (v.action === "hold") {
        await hold(q, v.reasons);
        out.push({ quote: q.quoteNumber, action: "hold", detail: v.reasons.join("; ").slice(0, 200) });
        continue;
      }
      if (v.action !== "send") continue;
      try {
        await prisma.funnelEvent.create({ data: { sessionId: `autoenvio-150:${q.id}`, reference: "autoenvio-150", step: STEP, metadata: { result: "claimed" } } });
      } catch {
        continue;
      }
      try {
        // El presupuesto nombra al jurado que cotizó antes de salir (igual que el cierre).
        if (lg.lead) await syncLeadTranslator(lg.lead, q.id);
        const { finalizeAndSendQuote } = await import("@/lib/quote-send");
        await finalizeAndSendQuote({ quoteId: q.id, actorEmail: ACTOR, requireDraft: true, channelPriceSource: v.channel });
        sent++;
        await prisma.funnelEvent.update({ where: { sessionId_step: { sessionId: `autoenvio-150:${q.id}`, step: STEP } }, data: { metadata: { result: "sent" } } }).catch(() => {});
        await sendStaffAlertSMS(`Autoenvío 2,5 h: ${q.quoteNumber} (${decimalToNumber(q.total).toFixed(2)} €) enviado a ${q.customerEmail}. Ficha: ${abs(hrefPresupuesto(q.id), SITE)}`, `autoenvio_150 ${q.quoteNumber}`).catch(() => {});
        out.push({ quote: q.quoteNumber, action: "send" });
      } catch (err) {
        const msg = String((err as Error)?.message || err).slice(0, 200);
        // 409 de requireDraft porque ya salió (Juan lo envió a mano): sin alarma.
        const now2 = await prisma.quote.findUnique({ where: { id: q.id }, select: { status: true, sentAt: true } }).catch(() => null);
        if ((err as { status?: number })?.status === 409 && now2 && (now2.sentAt || now2.status !== "DRAFT")) {
          await prisma.funnelEvent.update({ where: { sessionId_step: { sessionId: `autoenvio-150:${q.id}`, step: STEP } }, data: { metadata: { result: "ya_enviado" } } }).catch(() => {});
          out.push({ quote: q.quoteNumber, action: "ignore", detail: "ya enviado a mano" });
          continue;
        }
        await prisma.funnelEvent.update({ where: { sessionId_step: { sessionId: `autoenvio-150:${q.id}`, step: STEP } }, data: { metadata: { result: "error", detail: msg } } }).catch(() => {});
        await hold(q, [`el envío automático falló: ${msg}`]);
        await sendStaffAlertSMS(`Autoenvío 2,5 h: ${q.quoteNumber} NO salió (${msg.slice(0, 80)}). Queda en borrador: ${abs(hrefPresupuesto(q.id), SITE)}`, `autoenvio_150_error ${q.quoteNumber}`).catch(() => {});
        out.push({ quote: q.quoteNumber, action: "hold", detail: msg });
      }
    } catch (err) {
      console.error("[autoenvio-150]", q.id, err);
    }
  }
  return { mode: "on" as const, borradores: drafts.length, enviados: sent, resultados: out };
}
