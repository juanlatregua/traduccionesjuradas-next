// Informe horario «clientes a medias» (CLIENTES_A_MEDIAS_INFORME=on). Un email al staff (mismo
// destinatario que lead-sla) + SMS corto, SOLO si hay algo nuevo desde los informes de hoy.
// Rastro y dedupe: FunnelEvent step «clientes_a_medias», sessionId «clientes-a-medias:{día}T{hora}»,
// metadata.states = estados ya contados. Selección pura en lib/clientes-a-medias-core.ts.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";
import { sendStaffAlertSMS } from "@/lib/sms";
import { getStaffEmails } from "@/lib/staff-access";
import { paidSince } from "@/lib/paid-orders";
import { madridMidnightUtc, parseYmd, todayMadrid, madridParts } from "@/lib/panel-period";
import {
  INFORME_WINDOW_HOURS,
  informeHourOk,
  informeOn,
  newStates,
  renderInforme,
  selectClientesAMedias,
  itemState,
  type DayCounter,
  type HeldDraft,
} from "@/lib/clientes-a-medias-core";

const STEP = "clientes_a_medias";
export const UPLOAD_STARTED_STEP = "upload_started";
const EXCLUDED_SESSION = [{ sessionToken: { startsWith: "staff:" } }, { sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "entrada:" } }];
const NOT_LECTOR = { OR: [{ source: null }, { source: { notIn: ["lector", "prueba"] } }] };

/** Primera subida de una sesión (puerta vieja o entrada): fila anónima, contada una vez. Nunca lanza. */
export function recordUploadStarted(sessionId: string, puerta: "puerta" | "entrada", withEmail: boolean): void {
  if (!informeOn() || !sessionId) return;
  prisma.funnelEvent
    .create({ data: { sessionId, reference: puerta, step: UPLOAD_STARTED_STEP, metadata: { puerta, withEmail } } })
    .catch(() => {});
}

export const staffEmailList = () =>
  [...getStaffEmails(), process.env.PRESUPUESTO_TO, process.env.ADMIN_EMAIL, process.env.EMAIL_FROM, "info@traduccionesjuradas.net"].filter((e): e is string => !!e);

async function dayCounter(dayStart: Date): Promise<DayCounter> {
  const [sesiones, entradas, uploads, enviados, pagados] = await Promise.all([
    prisma.documentAnalysis.findMany({
      where: { createdAt: { gte: dayStart }, sessionToken: { not: null }, NOT: EXCLUDED_SESSION, AND: [NOT_LECTOR] },
      select: { sessionToken: true, clientEmail: true, clientPhone: true },
    }),
    prisma.entrada.findMany({ where: { createdAt: { gte: dayStart }, estado: { not: "prueba" } }, select: { email: true, phone9: true } }).catch(() => []),
    prisma.funnelEvent.findMany({ where: { step: UPLOAD_STARTED_STEP, createdAt: { gte: dayStart } }, select: { metadata: true } }),
    prisma.quote.count({ where: { deletedAt: null, sentAt: { gte: dayStart } } }),
    prisma.order.count({ where: { paymentStatus: "PAID", paidAt: { gte: dayStart } } }),
  ]);
  const ses = new Map<string, boolean>();
  for (const s of sesiones) ses.set(s.sessionToken!, ses.get(s.sessionToken!) || !!(s.clientEmail || s.clientPhone));
  return {
    entradas: ses.size + entradas.length,
    leads: [...ses.values()].filter(Boolean).length + entradas.filter((e) => e.email || e.phone9).length,
    subidasSinEmail: uploads.filter((u) => (u.metadata as any)?.withEmail === false).length,
    enviados,
    pagados,
  };
}

export async function loadClientesAMedias(now: Date) {
  const since = new Date(now.getTime() - INFORME_WINDOW_HOURS * 36e5);
  const quotesSince = new Date(now.getTime() - (INFORME_WINDOW_HOURS + 24) * 36e5);
  const [docs, entradas, quotes, paid, held] = await Promise.all([
    prisma.documentAnalysis.findMany({
      where: { createdAt: { gte: since }, sessionToken: { not: null }, orderId: null, NOT: EXCLUDED_SESSION, AND: [NOT_LECTOR] },
      select: { sessionToken: true, createdAt: true, clientEmail: true, clientName: true, clientPhone: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, quoteAmount: true, status: true, casoId: true, fileHash: true },
      take: 500,
    }),
    prisma.entrada.findMany({ where: { createdAt: { gte: since }, estado: { not: "prueba" } }, take: 300 }).catch(() => []),
    prisma.quote.findMany({
      where: { deletedAt: null, OR: [{ createdAt: { gte: quotesSince } }, { sentAt: { gte: quotesSince } }] },
      select: { id: true, quoteNumber: true, sentAt: true, createdAt: true, customerEmail: true, expedienteRef: true, casoId: true },
    }),
    prisma.order.findMany({ where: { paymentStatus: "PAID", paidAt: { gte: paidSince(now) } }, select: { clientEmail: true, clientPhone: true, paidAt: true, documentAnalyses: { select: { fileHash: true } } } }),
    prisma.funnelEvent.findMany({ where: { step: "autoenvio_150_hold", createdAt: { gte: quotesSince } }, select: { metadata: true } }),
  ]);
  const files = entradas.length
    ? await prisma.documentAnalysis.findMany({ where: { sessionToken: { in: entradas.map((e) => `entrada:${e.id}`) } }, select: { sessionToken: true, fileHash: true } })
    : [];
  const lotes = entradas.some((e) => e.loteId) ? new Set(entradas.filter((e) => e.loteId).map((e) => e.id)) : new Set<string>();
  return selectClientesAMedias({
    now,
    docs: docs.map((d) => ({ ...d, sessionToken: d.sessionToken!, status: String(d.status), quoteAmount: d.quoteAmount == null ? null : Number(d.quoteAmount) })),
    entradas: entradas.map((e) => {
      const fs = files.filter((f) => f.sessionToken === `entrada:${e.id}`);
      return {
        id: e.id, estado: e.estado, createdAt: e.createdAt, email: e.email, emailVerified: !!e.emailVerifiedAt, phone9: e.phone9, nombre: e.nombre,
        sourceLang: e.sourceLang, targetLang: e.targetLang ?? e.targetLangs[0] ?? null, casoId: e.casoId, files: fs.length, leida: lotes.has(e.id), fileHash: fs.find((f) => f.fileHash)?.fileHash ?? null,
      };
    }),
    quotes,
    paidOrders: paid.map((o) => ({ clientEmail: o.clientEmail, clientPhone: o.clientPhone, paidAt: o.paidAt!, fileHashes: o.documentAnalyses.map((d) => d.fileHash) })),
    staffEmails: staffEmailList(),
    held: held.map((h) => h.metadata as unknown as HeldDraft).filter((h) => h && h.quoteId),
  });
}

/** Cron horario (0 6-20 * * * UTC). Solo de 08:00 a 21:00 Madrid y solo si hay algo nuevo. */
export async function runClientesAMedias(now = new Date()) {
  if (!informeOn()) return { mode: "off" as const };
  if (!informeHourOk(now)) return { mode: "on" as const, skipped: "fuera de 08-21 Madrid" };
  const dayStart = madridMidnightUtc(parseYmd(todayMadrid(now))!);
  const items = await loadClientesAMedias(now);
  const prev = await prisma.funnelEvent.findMany({ where: { step: STEP, createdAt: { gte: dayStart } }, select: { metadata: true } });
  const sent = prev.flatMap((p) => ((p.metadata as any)?.states as string[] | undefined) || []);
  const fresh = newStates(items, sent);
  if (!fresh.length) return { mode: "on" as const, items: items.length, nuevos: 0, email: "none", sms: "none" };

  const p = madridParts(now);
  const id = `clientes-a-medias:${todayMadrid(now)}T${String(p.h).padStart(2, "0")}`;
  try {
    await prisma.funnelEvent.create({ data: { sessionId: id, reference: "clientes-a-medias", step: STEP, metadata: { states: items.map(itemState), email: "pending", sms: "pending" } } });
  } catch {
    return { mode: "on" as const, items: items.length, nuevos: fresh.length, skipped: "ya informado esta hora" };
  }
  const day = await dayCounter(dayStart);
  const { subject, html, sms: smsText } = renderInforme(items, day, new Set(fresh));
  const to = process.env.PRESUPUESTO_TO || "hola@traduccionesjuradas.net";
  const email = await sendMail({ to, subject, html: wrapClientEmailHtml(html) }).then(() => "ok", (e) => { console.error("[clientes-a-medias] email", e); return "fail"; });
  const sms = await sendStaffAlertSMS(smsText, "clientes_a_medias").then(() => "ok", (e) => { console.error("[clientes-a-medias] sms", e); return "fail"; });
  await prisma.funnelEvent
    .update({ where: { sessionId_step: { sessionId: id, step: STEP } }, data: { metadata: { states: items.map(itemState), email, sms } } })
    .catch((e) => console.error("[clientes-a-medias] rastro", e));
  return { mode: "on" as const, items: items.length, nuevos: fresh.length, email, sms };
}
