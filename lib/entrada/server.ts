import { createHash, randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL, assertNotRefused } from "@/lib/ai/models";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { sendMail } from "@/lib/azure-mail";
import { escapeHtml } from "@/lib/collaborator-emails";
import { fetchLavoriCartera, lavoriManualRoute } from "@/lib/lavori-bridge";
import { aliasDesdeEnv } from "@/lib/caso/identidad";
import { apiDeps as lecturaApi, download as lecturaDownload, lecturaStore, startDeps } from "@/lib/lectura-constructor/server.ts";
import { startReading } from "@/lib/lectura-constructor/run.ts";
import type { EntradaApiDeps } from "./api.ts";
import { puertaV2On } from "./flag.ts";
import { joinedExisting, type Aviso, type FlowDeps, type Jurado } from "./flow.ts";
import { entradaResumen, idiomasTexto, plazoTexto, routingPair, staffLinks, staffTo } from "./aviso.ts";
import { resolverEntrada, type GateDeps } from "./puerta.ts";
import { filesWithoutHash, prismaEntradaStore, prismaGateTx, readingExtras, reusableLote } from "./prisma-store.ts";
import { langName } from "./view.ts";
import { codeEmail } from "./codigo.ts";
import { DEFAULT_LIMITS, prepareBatch } from "@/lib/lectura/index.ts";
import { explicitRssCeilingMb } from "@/lib/lectura-constructor/flag.ts";
import { sessionKeyOf, type EntradaRow } from "./store.ts";
import { runFrAuto, type FrAutoData, type FrAutoIO } from "./fr-auto.ts";
import { puertaFrMode } from "../puerta-fr-math.ts";

const own = (url: string) => isOwnBlobUrl(url, process.env.BLOB_READ_WRITE_TOKEN);
const download = (url: string) => lecturaDownload({ name: decodeURIComponent(url.split("?")[0].split("/").pop() || "archivo"), url, mimeType: null });

export const gateDeps: GateDeps = {
  get alias() {
    return aliasDesdeEnv();
  },
  propios: [process.env.EMAIL_FROM, process.env.ADMIN_EMAIL],
  sinHuella: (q) => filesWithoutHash(prisma, q, own),
  download,
  run: (fn) => prisma.$transaction((tx) => fn(prismaGateTx(tx)), { timeout: 15_000 }),
};

async function hasJurado(sourceLang: string, targetLang: string): Promise<Jurado> {
  const s = sourceLang.toLowerCase();
  const t = targetLang.toLowerCase();
  if (s !== "es" && t !== "es") return "no";
  const other = s === "es" ? t : s;
  if (other === "fr") return "si";
  const cartera = await fetchLavoriCartera(other);
  const route = lavoriManualRoute(`${s}->${t}`, cartera.miembros);
  if (route && route.candidatos.length > 0) return "si";
  return cartera.live ? "no" : "desconocido";
}

const SITE = "https://www.traduccionesjuradas.net";
let client: Anthropic | null = null;
const conserjeClient = () => (client ??= new Anthropic({ maxRetries: 2, timeout: 30_000 }));

async function notify(a: Aviso): Promise<void> {
  if (!a.entrada.casoId) return;
  const to = staffTo(process.env);
  const e = a.entrada;
  const links = staffLinks(e);
  const link = links.caso!;
  const who = escapeHtml([e.nombre, e.email, e.phone9].filter(Boolean).join(" · "));
  const subject = a.kind === "confirmada"
    ? `Entrada web confirmada — ${a.casoRef ?? e.casoId} (${a.documentos} doc.)`
    : `Entrada web sin jurado (${langName(a.idioma)}) — ${a.casoRef ?? e.casoId}`;
  const idiomas = idiomasTexto(e);
  const respuestas = (e.respuestas ?? []).map((r) => `<li>${escapeHtml(r.pregunta)}: <strong>${escapeHtml(r.respuesta)}</strong></li>`).join("");
  const plazo = plazoTexto(e);
  const excluidos = a.kind === "confirmada" && a.excluidos?.length ? `<p>${a.excluidos.length} documento(s) fuera del presupuesto: ${escapeHtml(a.excluidos.join("; "))}</p>` : "";
  const revisar = a.kind === "confirmada" && a.revisar ? `<p><strong>⚠ NO se ha pedido precio a lavori: ${escapeHtml(a.revisar)}.</strong> Presupuéstalo tú (o pide precio desde el constructor con los archivos que sí van).</p>` : "";
  const html = a.kind === "confirmada"
    ? `<h2>El cliente ha confirmado sus documentos</h2><p>${who}</p>${revisar}${a.presupuesto ? `<p><strong>Presupuesto automático ${escapeHtml(a.presupuesto)}</strong> (PUERTA_FR): revísalo en el caso.</p>` : ""}<p>${a.documentos} documento(s) · ${escapeHtml(idiomas)} · plazo: ${escapeHtml(plazo)}${e.organismo ? ` · organismo: ${escapeHtml(e.organismo)}` : ""}${e.pais ? ` (${escapeHtml(e.pais)})` : ""}</p>${respuestas ? `<ul>${respuestas}</ul>` : ""}${e.notas ? `<p>«${escapeHtml(e.notas)}»</p>` : ""}${excluidos}${e.regla === "dudoso" ? "<p><strong>¿Mismo cliente que otro caso?</strong> Revísalo en el caso.</p>" : ""}${e.relacionados.length ? "<p><strong>Relacionado</strong> con un caso ya encargado o cerrado (mismo archivo).</p>" : ""}${e.source ? `<p>Origen: ${escapeHtml(e.source)}</p>` : ""}${e.lang && e.lang !== "es" ? `<p>Idioma del cliente: ${escapeHtml(e.lang)}</p>` : ""}<p><a href="${link}">Abrir el caso (archivos y respuestas)</a> · <a href="${links.builder}">Montar el presupuesto con los documentos dentro</a></p>`
    : `<h2>Idioma sin jurado: ${escapeHtml(langName(a.idioma))}</h2><p>${who}</p><p>Al cliente se le ha dado el buscador del MAEC y el caso queda en «Sin jurado» (no cuenta como perdido) si no tenía nada más.</p><p><a href="${link}">Ver el caso</a></p>`;
  const mail = sendMail({ to, subject, html });
  // frAuto ya manda su SMS cuando monta un presupuesto; si no, el SMS es el segundo canal del aviso.
  const sms = a.kind === "confirmada" && !a.presupuesto
    ? import("@/lib/sms")
        .then(({ sendStaffAlertSMS }) => sendStaffAlertSMS(`${a.kind === "confirmada" && a.revisar ? `⚠ ${a.revisar} · ` : ""}Entrada web ${a.casoRef ?? ""} · ${idiomas} · ${a.documentos} doc · ${plazo} · ${e.email || e.phone9 || ""} · ${link}`.slice(0, 300), "entrada_confirmada"))
        .catch((err) => console.error("[entrada] SMS staff falló", err))
    : Promise.resolve();
  await Promise.all([mail, sms]);
}

/** The old puerta router (lib/puerta-request-quote) on the entrada's own files (DocumentAnalysis «entrada:<id>»). */
async function routeQuote(e: EntradaRow, data: FrAutoData | null, x: { casoRef: string | null; documentos: number; excluidos: string[] }) {
  const session = sessionKeyOf(e.id);
  const pair = routingPair(e, data ? { documents: data.documents, targetLang: data.lote.targetLang } : null);
  if (pair) await prisma.documentAnalysis.updateMany({ where: { sessionToken: session, orderId: null }, data: { sourceLanguage: pair.sourceLang, targetLanguage: pair.targetLang } });
  const { routePuertaQuoteRequest } = await import("@/lib/puerta-request-quote");
  const urgency = e.urgency === "ASAP" || e.urgency === "DATE" || e.urgency === "FLEXIBLE" ? e.urgency : null;
  const r = await routePuertaQuoteRequest({
    sessionToken: session,
    email: e.email ?? "",
    phone: e.phone9 ?? "",
    locale: e.lang,
    deadline: urgency && !joinedExisting(e) ? { urgency, neededBy: e.neededBy } : null,
    extraLines: entradaResumen(e, x),
    skipTariff: true,
  });
  const quote = r.body.quote as { sent?: boolean } | undefined;
  return { handled: r.status < 400 && r.body.ok === true, quoteSent: quote?.sent === true };
}

const frAutoIO: FrAutoIO = {
  mode: () => puertaFrMode(process.env.PUERTA_FR),
  claim: async (entradaId) => {
    try {
      await prisma.funnelEvent.create({ data: { sessionId: `puerta-fr:entrada:${entradaId}`, reference: "puerta-fr", step: "puerta_fr", metadata: { result: "claimed" } } });
      return true;
    } catch {
      return false;
    }
  },
  liveBlock: async (e) => {
    const { findLiveBlock } = await import("@/lib/respuesta-guard-db");
    return (await findLiveBlock({ email: e.email, phone: e.phone9 }, { leadAt: e.createdAt })) ? "ya lo lleva alguien (bloqueo vivo)" : null;
  },
  createDraft: async (e, payload) => {
    const { createAutoQuote } = await import("@/lib/learned-rates");
    const { FR_DELIVERY_TERM, FR_TRANSLATOR } = await import("@/lib/agente-bandeja-math");
    const { evaluateCapped } = await import("@/lib/quote-fr");
    const { presupuestoVivoDelCaso } = await import("@/lib/caso/hilo-db");
    // Mismo candado que app/api/quotes/route.ts: un presupuesto vivo por caso y par. La transacción solo sostiene el candado.
    return prisma.$transaction(async (tx) => {
      if (e.casoId) {
        const [candado] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('hilo'), hashtext(${`${e.casoId}|FR>ES`})) AS ok`;
        if (!candado?.ok) return { skip: "otro presupuesto se está creando en este caso" };
        const vivo = await presupuestoVivoDelCaso(e.casoId, "FR>ES", tx);
        if (vivo) return { skip: `el caso ya tiene el presupuesto ${vivo.quoteNumber}` };
      }
      const q = await createAutoQuote({
        lines: payload.lines.map((l) => ({
          description: l.description, quantity: l.quantity, unitPrice: Number(l.unitPrice), supplierUnitCost: Number(l.supplierUnitCost ?? 0),
          sourceFileUrl: l.sourceFileUrl, pageStart: l.pageStart, pageEnd: l.pageEnd, docKind: l.docKind,
        })),
        deliveryTerm: FR_DELIVERY_TERM,
        sourceLang: payload.sourceLang,
        targetLang: payload.targetLang,
        marginPct: 0,
        autoPricedBy: "puerta-fr-entrada",
        adminCreatedBy: "system:puerta-fr",
        channelPriceSource: "fr-tarifa",
        miembro: { id: null, nombre: null },
        translator: FR_TRANSLATOR,
        expedienteRef: `entrada:${e.id}`,
        contacto: { email: e.email, phone: e.phone9, name: e.nombre },
        locale: e.lang === "fr" || e.lang === "en" ? e.lang : "es",
        send: false,
        casoId: e.casoId,
      });
      if (!q.ok) return { error: q.reason };
      const ev = await evaluateCapped(q.quoteId, true);
      if (!ev.quote) return { error: "presupuesto no disponible tras crearlo" };
      return { quoteId: q.quoteId, quoteNumber: ev.quote.quoteNumber, netEur: ev.netEur, totalEur: ev.totalEur, decision: ev.decision };
    }, { timeout: 30_000, maxWait: 5_000 });
  },
  link: async (e, data, draft, payload) => {
    const ok = await lecturaStore.confirm(data.lote.id, "system:puerta-fr", { payload, quoteId: draft.quoteId }, data.lote.updatedAt);
    if (ok) await lecturaStore.linkQuote(data.lote.id, draft.quoteId);
  },
  send: async (e, draft, payload) => {
    const { buildQuoteReply, greetingName, FR_DELIVERY_TERM } = await import("@/lib/agente-bandeja-math");
    const { finalizeAndSendQuote } = await import("@/lib/quote-send");
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: draft.quoteId }, select: { publicToken: true, quoteNumber: true, deliveryTerm: true } });
    const lang = e.lang === "fr" || e.lang === "en" ? e.lang : "es";
    const body = buildQuoteReply({
      lang,
      name: greetingName(e.nombre),
      items: payload.lines.map((l) => ({ label: l.description, labelFr: null, pages: null })),
      netEur: draft.netEur,
      totalEur: draft.totalEur,
      deliveryTerm: quote.deliveryTerm || FR_DELIVERY_TERM,
      isFr: true,
      payUrl: `${SITE}/q/${quote.publicToken}`,
      askDeadline: !e.urgency,
    });
    await finalizeAndSendQuote({
      quoteId: draft.quoteId,
      actorEmail: "system:puerta-fr",
      skipEmail: false,
      requireDraft: true,
      customSubject: lang === "fr" ? `Devis ${quote.quoteNumber} · traduction assermentée` : lang === "en" ? `Quote ${quote.quoteNumber} · sworn translation` : `Presupuesto ${quote.quoteNumber} · traducción jurada`,
      customBody: body,
    });
  },
  staff: async (text) => {
    const { sendStaffAlertSMS } = await import("@/lib/sms");
    await sendStaffAlertSMS(text.slice(0, 300), "puerta_fr_entrada").catch((err) => console.error("[puerta-fr] SMS staff falló", err));
  },
};

export const flowDeps: FlowDeps = {
  store: prismaEntradaStore(prisma),
  gate: (input) => resolverEntrada(gateDeps, input),
  download,
  lectura: {
    ready: () => lecturaApi.readyToRead(),
    store: lecturaStore,
    start: (input, files) => startReading({ ...startDeps, listFiles: async () => files.map((f) => ({ name: f.name, url: f.url, mimeType: f.mimeType })) }, input),
    extras: (loteId) => readingExtras(prisma, loteId),
    reusable: (casoId, hashes) => reusableLote(prisma, casoId, hashes),
  },
  hasJurado,
  caso: {
    ref: async (casoId) => (await prisma.caso.findUnique({ where: { id: casoId }, select: { ref: true } }))?.ref ?? null,
    evento: async (casoId, tipo, actor, payload) => {
      await prisma.casoEvento.create({ data: { casoId, tipo, actor, payload: payload as never } });
    },
    plazo: async (casoId, urgency, neededBy) => {
      await prisma.caso.update({ where: { id: casoId }, data: { urgency, neededBy } });
    },
    cerrarSinJurado: async (casoId, entradaId) => {
      const [quotes, orders, requests, entradas, files, inbound] = await Promise.all([
        prisma.quote.count({ where: { casoId, deletedAt: null } }),
        prisma.order.count({ where: { casoId } }),
        prisma.lavoriPriceRequest.count({ where: { casoId } }),
        prisma.entrada.count({ where: { casoId, id: { not: entradaId } } }),
        prisma.documentAnalysis.count({ where: { casoId, OR: [{ sessionToken: null }, { sessionToken: { not: sessionKeyOf(entradaId) } }] } }),
        prisma.inboundEmail.count({ where: { casoId } }),
      ]);
      if (quotes + orders + requests + entradas + files + inbound > 0) return false;
      const r = await prisma.caso.updateMany({ where: { id: casoId, estado: "ABIERTO" }, data: { estado: "SIN_JURADO", closedAt: new Date() } });
      return r.count === 1;
    },
  },
  notify,
  frAuto: (e, data) => runFrAuto(frAutoIO, e, data),
  routeQuote,
  ackClient: async (e, { enMarcha }) => {
    const { sendPriceRequestAckToClient } = await import("@/lib/quote-email");
    await sendPriceRequestAckToClient({ name: e.nombre, email: e.email, phone: e.phone9, locale: e.lang, translatorLangName: null, askDeadline: !e.urgency, inReview: !enMarcha });
  },
  funnel: async (e, step) => {
    await prisma.funnelEvent
      .create({ data: { sessionId: sessionKeyOf(e.id), reference: (e.source ?? "entrada").slice(0, 60), step, metadata: { canal: e.canal, lang: e.lang, casoId: e.casoId } } })
      .catch(() => {});
  },
  inspect: async (file) => {
    const ceiling = explicitRssCeilingMb();
    if (ceiling === null) return null;
    const r = await prepareBatch([{ name: file.name, mimeType: file.mimeType, bytes: file.bytes }], { ...DEFAULT_LIMITS, rssCeilingMb: ceiling });
    if (r.status === "ok") return { pages: r.batch.files[0]?.pageCount ?? null, problem: r.batch.skipped[0]?.reasonEs ?? null };
    if (r.status === "empty") return { pages: 0, problem: r.skipped[0]?.reasonEs ?? "no se puede abrir" };
    return null;
  },
  sendCode: async (to, code, lang, link) => {
    const { subject, html, text } = codeEmail(lang, code, `${SITE}/entrada/confirmar?k=${encodeURIComponent(link)}`);
    await sendMail({ to, subject, html, text });
  },
  now: () => new Date(),
  newId: randomUUID,
};

export const entradaApiDeps: EntradaApiDeps = {
  ...flowDeps,
  enabled: () => puertaV2On(),
  rateLimit: (key, limit, windowMs) => checkRateLimit({ key, limit, windowMs }),
  conserje: async (system, user) => {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    const resp = await conserjeClient().messages.create({
      model: SONNET_MODEL,
      max_tokens: 1500,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low" },
    } as Anthropic.MessageCreateParamsNonStreaming);
    assertNotRefused(resp, "entrada/conserje");
    return resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
  },
  budget: async (key, amount, limit, windowMs) => {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const b = await tx.rateLimitBucket.findUnique({ where: { key }, select: { count: true, resetAt: true } });
      if (!b || b.resetAt <= now) {
        if (amount > limit) return false;
        await tx.rateLimitBucket.upsert({ where: { key }, create: { key, count: amount, resetAt: new Date(now.getTime() + windowMs) }, update: { count: amount, resetAt: new Date(now.getTime() + windowMs) } });
        return true;
      }
      if (b.count + amount > limit) return false;
      await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: amount } } });
      return true;
    });
  },
  alertStaff: async (subject, text) => {
    await sendMail({ to: staffTo(process.env), subject, html: `<p>${escapeHtml(text)}</p>` });
  },
  clientIp: getClientIp,
  ipHash: (ip) => createHash("sha256").update(ip).digest("hex").slice(0, 16),
  isOwnBlobUrl: own,
};
