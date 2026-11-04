// lib/agente-bandeja.ts — AGENTE DE BANDEJA: emails NUEVOS de hola@ (InboundEmail) →
// lee los adjuntos, pone precio SOLO desde tarifa aprobada (FR: motor por documento de
// Juan; resto: tarifario aprendido) y responde en el MISMO hilo con el enlace de pago y
// el PDF del presupuesto. Todo lo demás: borrador en /admin/inbox + SMS al staff.
// Interruptor AGENTE_BANDEJA: off (por defecto) | draft (nada sale al cliente) | on.
// Decisiones puras en lib/agente-bandeja-math.ts.

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import { buildExpedienteFromInbound, isIgnoredSender, matchClientContext } from "@/lib/inbox";
import { analyzeExpedienteDocument } from "@/lib/expediente-analyze";
import { createAutoQuote, autoQuoteFromPuertaSession, isLearnedAutosendOn, AUTO_QUOTE_MAX_CENTS_WITH_VAT } from "@/lib/learned-rates";
import { evaluateDraftAutoSend } from "@/lib/cierre";
import { replyToInboxMessage } from "@/lib/azure-mail-read";
import { renderClientMessageHtml } from "@/lib/email";
import { fetchFileAsAttachment } from "@/lib/delivery-attachments";
import { sendStaffAlertSMS } from "@/lib/sms";
import {
  agenteBandejaMode,
  bandejaAction,
  buildHoldingDraft,
  buildNoDocDraft,
  buildQuoteReply,
  checkSegments,
  greetingName,
  isHouseAddress,
  looksAutomated,
  looksLikePaymentOrInvoice,
  mentionsDeadline,
  splitOrRepeatedReason,
  priceFrSegments,
  replyLang,
  segmentFromAnalysis,
  CANDIDATE_WINDOW_HOURS,
  CLAIM_SUBJECT,
  ERROR_SUBJECT,
  STALE_SUBJECT,
  STALE_CLAIM_MINUTES,
  START_MIN_REMAINING_MS,
  SEND_MIN_REMAINING_MS,
  FR_DELIVERY_TERM,
  FR_TRANSLATOR,
  MAX_DOCS,
  MAX_EMAILS_PER_RUN,
  type AgenteBandejaMode,
  type Segment,
} from "@/lib/agente-bandeja-math";

const SITE = "https://www.traduccionesjuradas.net";
const ACTOR = "system:agente-bandeja";

type Inbound = NonNullable<Awaited<ReturnType<typeof prisma.inboundEmail.findUnique>>>;

export type BandejaOutcome = { id: string; from: string; result: "sent" | "drafted" | "skipped" | "error"; detail: string };

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function sms(text: string, context: string) {
  return sendStaffAlertSMS(short(text, 300), context).catch((e) => console.error("[agente-bandeja] SMS staff falló", e));
}

async function saveDraft(row: Inbound, subject: string, body: string, quoteId?: string | null) {
  await prisma.inboundEmail.update({
    where: { id: row.id },
    data: { status: "DRAFTED", draftSubject: subject, draftBody: body, draftedAt: new Date(), ...(quoteId ? { quoteId } : {}) },
  });
}

/** Filas que una pasada dejó a medias (más de 10 min con la marca): un SMS por fila y quedan para Juan. */
async function flagStaleClaims() {
  const stale = await prisma.inboundEmail.findMany({
    where: { status: "DRAFTED", draftSubject: CLAIM_SUBJECT, draftedAt: { lt: new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000) } },
    select: { id: true, fromEmail: true, quoteId: true },
    take: 20,
  });
  for (const r of stale) {
    const marked = await prisma.inboundEmail.updateMany({ where: { id: r.id, draftSubject: CLAIM_SUBJECT }, data: { draftSubject: STALE_SUBJECT } });
    if (marked.count === 0) continue;
    await sms(
      `Agente bandeja: el email de ${r.fromEmail} quedó a medias${r.quoteId ? " (con presupuesto en borrador)" : ""}. Revísalo a mano en ${SITE}/admin/inbox`,
      `agente_bandeja_interrumpido ${r.id}`
    );
  }
  return stale.length;
}

/** `deadlineAt`: hora límite de la ejecución (inicio del cron + maxDuration). */
export async function runAgenteBandeja(opts: { deadlineAt: number }): Promise<{ mode: AgenteBandejaMode; stale: number; outcomes: BandejaOutcome[] }> {
  const mode = agenteBandejaMode(process.env.AGENTE_BANDEJA);
  if (mode === "off") return { mode, stale: 0, outcomes: [] };
  const stale = await flagStaleClaims();
  const now = Date.now();
  const rows = await prisma.inboundEmail.findMany({
    where: {
      status: "NEW",
      channel: "EMAIL",
      receivedAt: { gte: new Date(now - CANDIDATE_WINDOW_HOURS * 3_600_000) },
      quoteId: null,
      orderReference: null,
      NOT: { graphId: { startsWith: "manual:" } },
    },
    orderBy: { receivedAt: "asc" },
    take: 30,
  });
  const collaborators = new Set(
    (await prisma.collaborator.findMany({ select: { email: true } })).map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const candidates = rows
    .filter(
      (r) =>
        !isIgnoredSender(r.fromEmail) &&
        !isHouseAddress(r.fromEmail) &&
        !collaborators.has(r.fromEmail.trim().toLowerCase()) &&
        !looksAutomated({ fromEmail: r.fromEmail, subject: r.subject, body: r.bodyText || r.bodyPreview }) &&
        !looksLikePaymentOrInvoice({ subject: r.subject, body: r.bodyText || r.bodyPreview, proofJson: r.proofJson })
    )
    .slice(0, MAX_EMAILS_PER_RUN);

  const outcomes: BandejaOutcome[] = [];
  for (const row of candidates) {
    if (opts.deadlineAt - Date.now() < START_MIN_REMAINING_MS) break;
    try {
      outcomes.push(await processInbound(row, mode, opts.deadlineAt));
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      console.error("[agente-bandeja]", row.id, msg);
      // Se marca (tomada o no) para no reintentar ni repetir el SMS cada 15 minutos.
      const body = `El agente de bandeja falló con este email (${short(msg, 300)}). Respóndelo a mano.`;
      await prisma.inboundEmail
        .updateMany({
          where: { id: row.id, OR: [{ status: "NEW" }, { draftSubject: CLAIM_SUBJECT }] },
          data: { status: "DRAFTED", draftSubject: ERROR_SUBJECT, draftBody: body, draftedAt: new Date() },
        })
        .catch(() => {});
      await sms(`Agente bandeja: error con el email de ${row.fromEmail} (${short(msg, 100)}). Revisar en ${SITE}/admin/inbox`, `agente_bandeja_error ${row.id}`);
      outcomes.push({ id: row.id, from: row.fromEmail, result: "error", detail: short(msg, 200) });
    }
  }
  return { mode, stale, outcomes };
}

/** Quita del expediente los archivos repetidos (mismo contenido, sha256) y sella fileHash. */
async function dedupeByHash(docs: { id: string; fileName: string; fileUrl: string; mimeType: string; fileHash: string | null }[]) {
  const seen = new Set<string>();
  const kept: typeof docs = [];
  for (const d of docs) {
    let hash = d.fileHash;
    if (!hash) {
      const res = await fetch(d.fileUrl);
      if (!res.ok) throw new Error(`no se pudo bajar ${d.fileName} (${res.status})`);
      hash = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
      await prisma.documentAnalysis.update({ where: { id: d.id }, data: { fileHash: hash } });
    }
    if (seen.has(hash)) {
      await prisma.documentAnalysis.delete({ where: { id: d.id } });
      continue;
    }
    seen.add(hash);
    kept.push({ ...d, fileHash: hash });
  }
  return kept;
}

async function processInbound(row: Inbound, mode: AgenteBandejaMode, deadlineAt: number): Promise<BandejaOutcome> {
  const out = (result: BandejaOutcome["result"], detail: string): BandejaOutcome => ({ id: row.id, from: row.fromEmail, result, detail });

  // Adjuntos aún sin bajar de Graph (la sincronización los reintenta): a la próxima pasada.
  if (row.mediaJson == null) return out("skipped", "adjuntos pendientes de sincronizar");
  const hasMedia = Array.isArray(row.mediaJson) && row.mediaJson.length > 0;

  // Hilo: con presupuesto o pedido → Juan. Si ya contestamos (agente o Juan, p. ej. pidiendo
  // el documento) y el cliente responde CON adjuntos, se procesa: es el caso más común. Un
  // hilo que Juan empezó desde Outlook no tiene fila previa y se procesa como nuevo.
  if (row.conversationId) {
    const previos = await prisma.inboundEmail.findMany({
      where: { id: { not: row.id }, conversationId: row.conversationId },
      select: { status: true, quoteId: true, orderReference: true },
    });
    if (previos.some((p) => p.quoteId || p.orderReference)) return out("skipped", "hilo con presupuesto o pedido");
    if (previos.length > 0 && !hasMedia) return out("skipped", "mensaje de un hilo ya abierto, sin adjuntos");
  }
  // Solo leads nuevos: si desde la sincronización el remitente ya tiene presupuesto o pedido
  // (p. ej. otro email suyo procesado antes en esta misma pasada), se casa y se deja a Juan.
  const match = await matchClientContext(row.fromEmail);
  if (match.quoteId || match.orderReference) {
    await prisma.inboundEmail.update({
      where: { id: row.id },
      data: { customerId: row.customerId || match.customerId, quoteId: match.quoteId, orderReference: match.orderReference },
    });
    return out("skipped", "cliente con presupuesto o pedido");
  }

  // Candado: NEW → DRAFTED con marca. Solo una pasada se queda con el email; si la
  // ejecución muere a medias, la marca queda a la vista en la bandeja.
  const claim = await prisma.inboundEmail.updateMany({
    where: { id: row.id, status: "NEW", quoteId: null },
    data: { status: "DRAFTED", draftSubject: CLAIM_SUBJECT, draftBody: "El agente de bandeja empezó con este email y no terminó: respóndelo a mano.", draftedAt: new Date() },
  });
  if (claim.count === 0) return out("skipped", "ya lo tomó otra pasada");

  const text = `${row.subject}\n${row.bodyText || row.bodyPreview}`;
  const lang = replyLang(text);
  const name = greetingName(row.fromName);
  const askDeadline = !mentionsDeadline(text);
  const subject = `RE: ${row.subject}`.slice(0, 250);
  const who = row.fromName ? `${row.fromName} (${row.fromEmail})` : row.fromEmail;

  // 1. Adjuntos → expediente exp:<ref>.
  const exp = await buildExpedienteFromInbound(row);
  if (!exp.ref) {
    await saveDraft(row, subject, buildNoDocDraft({ lang, name }));
    await sms(`Email de ${who} sin documento${exp.skipped.length ? ` (adjuntos no válidos: ${exp.skipped.join(", ")})` : ""}: borrador listo en ${SITE}/admin/inbox`, `agente_bandeja_sin_doc ${row.id}`);
    return out("drafted", "sin documento");
  }
  const ref = exp.ref;
  const builderUrl = `${SITE}/zona-traductor/presupuesto?inbox=${row.id}&exp=${ref}`;
  const manual = async (reason: string): Promise<BandejaOutcome> => {
    await saveDraft(row, subject, buildHoldingDraft({ lang, name, askDeadline }));
    await sms(`Agente bandeja: email de ${who} sin precio automático (${short(reason, 120)}). Sin solicitud a lavori (fuera de alcance). Presupuesto: ${builderUrl}`, `agente_bandeja_manual ${row.id}`);
    return out("drafted", reason);
  };

  // 2. Presupuesto ya existente para este expediente (builder o pasada anterior): no se crea otro.
  const previo = await prisma.quote.findFirst({
    where: { deletedAt: null, expedienteRef: { in: [ref, `puerta:exp:${ref}`] } },
    select: { quoteNumber: true },
  });
  if (previo) return manual(`el expediente ya tiene el presupuesto ${previo.quoteNumber}`);

  // 3. Leer los documentos (sin repetidos: el mismo archivo adjunto dos veces cuenta una).
  const allDocs = await prisma.documentAnalysis.findMany({
    where: { sessionToken: `exp:${ref}` },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, fileUrl: true, mimeType: true, fileHash: true },
  });
  if (allDocs.length > MAX_DOCS) return manual(`${allDocs.length} archivos (más de ${MAX_DOCS})`);
  const docs = await dedupeByHash(allDocs);
  const segments: (Segment & { fileUrl: string })[] = [];
  let split = false;
  for (const d of docs) {
    const r = await analyzeExpedienteDocument(d.id);
    if (!r.ok) return manual(`no se pudo leer ${d.fileName}: ${r.error}`);
    if (r.run.degraded) return manual(`segmentación dudosa en ${d.fileName}`);
    if (r.split) split = true;
    for (const s of r.run.documents) segments.push({ ...segmentFromAnalysis(s.analysis, d.fileName), fileUrl: d.fileUrl });
  }
  const check = checkSegments(segments);
  if (!check.ok) return manual(check.reason);
  const repeated = splitOrRepeatedReason(docs, segments);
  if (repeated) return manual(repeated);

  // 4. Precio.
  let quoteId: string;
  let items: { label: string; labelFr?: string | null; pages: number | null }[] = [];
  if (check.lane === "fr") {
    const fr = priceFrSegments(segments);
    if (!fr.ok) return manual(fr.reason);
    const created = await createAutoQuote({
      lines: fr.lines.map((l, i) => ({ description: l.description, quantity: 1, unitPrice: l.unitPrice, supplierUnitCost: 0, sourceFileUrl: segments[i].fileUrl })),
      deliveryTerm: FR_DELIVERY_TERM,
      sourceLang: "fr",
      targetLang: "es",
      marginPct: 0,
      autoPricedBy: "agente-bandeja",
      adminCreatedBy: ACTOR,
      channelPriceSource: "fr-tarifa",
      miembro: { id: null, nombre: null },
      translator: FR_TRANSLATOR,
      expedienteRef: ref,
      contacto: { email: row.fromEmail, name: row.fromName },
      locale: lang,
      send: false,
      onQuoteCreated: async (id) => {
        await prisma.inboundEmail.update({ where: { id: row.id }, data: { quoteId: id } });
      },
    });
    if (!created.ok) return manual(created.reason);
    quoteId = created.quoteId;
    items = fr.lines.map((l, i) => ({ label: l.label, labelFr: segments[i].labelFr, pages: l.pages }));
  } else {
    // El tarifario lee la fila del archivo, no los segmentos: un PDF con varios documentos va a mano.
    if (split) return manual("un archivo trae varios documentos: el tarifario no los separa");
    const auto = await autoQuoteFromPuertaSession({
      sessionToken: `exp:${ref}`,
      contactEmail: row.fromEmail,
      contactPhone: "",
      contactName: row.fromName,
      locale: lang,
      autoSend: false,
    });
    if (!auto.ok) return manual(auto.reason);
    quoteId = auto.quoteId;
    await prisma.inboundEmail.update({ where: { id: row.id }, data: { quoteId } });
  }

  // 5. ¿Sale solo? Mismas guardas que el tarifario; FR con opt-in explícito.
  const ev = await evaluateDraftAutoSend(quoteId, { frAllowed: check.lane === "fr" });
  const quote = ev.quote;
  if (!quote) return manual("presupuesto no disponible tras crearlo");
  // Tarifario: lo que se traduce, tal cual las líneas del presupuesto.
  if (check.lane === "tarifario") items = quote.lines.map((l) => ({ label: l.description, pages: null }));
  const totalEur = decimalToNumber(quote.total);
  const netEur = Math.round((decimalToNumber(quote.subtotal) - decimalToNumber(quote.discountAmount)) * 100) / 100;
  const decision =
    ev.decision.action === "send" && Math.round(totalEur * 100) > AUTO_QUOTE_MAX_CENTS_WITH_VAT
      ? { action: "alert" as const, reasons: [`${totalEur.toFixed(2)} € con IVA superan el tope de envío solo (${AUTO_QUOTE_MAX_CENTS_WITH_VAT / 100} €)`] }
      : ev.decision;
  const isFr = check.lane === "fr";
  let action = bandejaAction(mode, decision, { fr: isFr, learnedAutosend: isLearnedAutosendOn() });
  if (action.action === "send" && deadlineAt - Date.now() < SEND_MIN_REMAINING_MS) {
    action = { action: "draft", reasons: ["sin tiempo para enviar en esta pasada"] };
  }
  const reviewUrl = `${SITE}/zona-traductor/presupuestos/${quote.id}`;
  const replyInput = {
    lang,
    name,
    items,
    netEur,
    totalEur,
    deliveryTerm: quote.deliveryTerm || FR_DELIVERY_TERM,
    isFr,
    payUrl: `${SITE}/q/${quote.publicToken}`,
    askDeadline,
  };

  if (action.action === "draft") {
    await saveDraft(row, subject, buildQuoteReply({ ...replyInput, draftOf: { quoteNumber: quote.quoteNumber } }), quote.id);
    const head = mode === "draft" ? "Agente bandeja (borrador)" : "Agente bandeja: NO sale solo";
    await sms(
      `${head}: presupuesto ${quote.quoteNumber} (${totalEur.toFixed(2)} €) para ${row.fromEmail}${mode === "on" ? ` — ${short(action.reasons[0] || "", 100)}` : ""}. Ficha: ${reviewUrl} · respuesta en ${SITE}/admin/inbox`,
      `agente_bandeja_borrador ${quote.quoteNumber}`
    );
    return out("drafted", `${quote.quoteNumber}: ${action.reasons.join("; ")}`);
  }

  // 6. Enviar: sella el presupuesto sin el email estándar y responde por el hilo.
  const { finalizeAndSendQuote } = await import("@/lib/quote-send");
  const sent = await finalizeAndSendQuote({
    quoteId: quote.id,
    actorEmail: ACTOR,
    skipEmail: true,
    requireDraft: true,
    ...(!isFr ? { channelPriceSource: "learned-rate" as const } : {}),
  });
  const pdfName = `Presupuesto-${quote.quoteNumber}.pdf`;
  const pdf = (await fetchFileAsAttachment(sent.pdfUrl, pdfName)) || (await fetchFileAsAttachment(sent.pdfUrl, pdfName));
  const body = buildQuoteReply({ ...replyInput, pdfLink: pdf ? null : sent.pdfUrl });
  try {
    await replyToInboxMessage(row.graphId, { html: renderClientMessageHtml(body, { houseSignature: !isFr }), subject, attachments: pdf ? [pdf] : [] });
  } catch (err) {
    await saveDraft(row, subject, body, quote.id);
    await sms(
      `URGENTE agente bandeja: ${quote.quoteNumber} quedó ENVIADO pero la respuesta a ${row.fromEmail} falló. Responde a mano desde ${SITE}/admin/inbox (borrador listo)`,
      `agente_bandeja_reply_fallo ${quote.quoteNumber}`
    );
    return out("error", `${quote.quoteNumber} enviado sin respuesta en el hilo: ${short(String((err as Error)?.message || err), 150)}`);
  }

  const now = new Date();
  await prisma.inboundEmail.update({
    where: { id: row.id },
    data: { status: "REPLIED", replySubject: subject, replyBody: body, repliedAt: now, repliedBy: ACTOR, quoteId: quote.id },
  });
  await prisma.messageLog
    .create({
      data: { quoteId: quote.id, channel: "EMAIL", type: "INBOX_REPLY", recipient: row.fromEmail, subject, body, sentAt: now, status: "SENT" },
    })
    .catch((e) => console.error("[agente-bandeja] messageLog falló", e));
  await sms(`Agente bandeja: presupuesto ${quote.quoteNumber} (${totalEur.toFixed(2)} €) enviado a ${row.fromEmail}`, `agente_bandeja_enviado ${quote.quoteNumber}`);
  return out("sent", quote.quoteNumber);
}
