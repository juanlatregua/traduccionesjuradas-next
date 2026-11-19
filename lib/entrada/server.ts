import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { sendMail } from "@/lib/azure-mail";
import { escapeHtml } from "@/lib/collaborator-emails";
import { fetchLavoriCartera, lavoriManualRoute } from "@/lib/lavori-bridge";
import { aliasDesdeEnv } from "@/lib/caso/identidad";
import { apiDeps as lecturaApi, download as lecturaDownload, lecturaStore, startDeps } from "@/lib/lectura-constructor/server.ts";
import { startReading } from "@/lib/lectura-constructor/run.ts";
import { fmtNeededBy } from "@/lib/needed-by";
import type { EntradaApiDeps } from "./api.ts";
import { puertaV2On } from "./flag.ts";
import type { Aviso, FlowDeps, Jurado } from "./flow.ts";
import { resolverEntrada, type GateDeps } from "./puerta.ts";
import { filesWithoutHash, prismaEntradaStore, prismaGateTx, readingExtras, reusableLote } from "./prisma-store.ts";
import { langName } from "./view.ts";
import { codeEmail } from "./codigo.ts";
import { sessionKeyOf } from "./store.ts";

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

async function notify(a: Aviso): Promise<void> {
  const to = process.env.PRESUPUESTO_TO;
  if (!to || !a.entrada.casoId) return;
  const e = a.entrada;
  const link = `${SITE}/zona-traductor/lectura?caso=${encodeURIComponent(e.casoId!)}`;
  const who = escapeHtml([e.nombre, e.email, e.phone9].filter(Boolean).join(" · "));
  const subject = a.kind === "confirmada"
    ? `Entrada web confirmada — ${a.casoRef ?? e.casoId} (${a.documentos} doc.)`
    : `Entrada web sin jurado (${langName(a.idioma)}) — ${a.casoRef ?? e.casoId}`;
  const plazo = e.urgency === "DATE" && e.neededBy ? `para el ${fmtNeededBy(e.neededBy)}` : e.urgency === "ASAP" ? "lo antes posible" : e.urgency === "FLEXIBLE" ? "sin prisa" : "sin indicar";
  const html = a.kind === "confirmada"
    ? `<h2>El cliente ha confirmado sus documentos</h2><p>${who}</p><p>${a.documentos} documento(s) · plazo: ${escapeHtml(plazo)}${e.organismo ? ` · organismo: ${escapeHtml(e.organismo)}` : ""}</p>${e.notas ? `<p>«${escapeHtml(e.notas)}»</p>` : ""}${e.regla === "dudoso" ? "<p><strong>¿Mismo cliente que otro caso?</strong> Revísalo en el caso.</p>" : ""}${e.relacionados.length ? "<p><strong>Relacionado</strong> con un caso ya encargado o cerrado (mismo archivo).</p>" : ""}${e.source ? `<p>Origen: ${escapeHtml(e.source)}</p>` : ""}${e.lang && e.lang !== "es" ? `<p>Idioma del cliente: ${escapeHtml(e.lang)}</p>` : ""}<p><a href="${link}">Abrir la lectura y presupuestar</a></p>`
    : `<h2>Idioma sin jurado: ${escapeHtml(langName(a.idioma))}</h2><p>${who}</p><p>Al cliente se le ha dado el buscador del MAEC y el caso queda en «Sin jurado» (no cuenta como perdido) si no tenía nada más.</p><p><a href="${link}">Ver el caso</a></p>`;
  await sendMail({ to, subject, html });
}

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
  sendCode: async (to, code, lang) => {
    const { subject, html } = codeEmail(lang, code);
    await sendMail({ to, subject, html });
  },
  now: () => new Date(),
  newId: randomUUID,
};

export const entradaApiDeps: EntradaApiDeps = {
  ...flowDeps,
  enabled: () => puertaV2On(),
  rateLimit: (key, limit, windowMs) => checkRateLimit({ key, limit, windowMs }),
  alertStaff: async (subject, text) => {
    const to = process.env.PRESUPUESTO_TO;
    if (to) await sendMail({ to, subject, html: `<p>${escapeHtml(text)}</p>` });
  },
  clientIp: getClientIp,
  ipHash: (ip) => createHash("sha256").update(ip).digest("hex").slice(0, 16),
  isOwnBlobUrl: own,
};
