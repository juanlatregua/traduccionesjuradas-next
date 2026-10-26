// Aviso de lead sin presupuesto (regla de Juan, 22-oct-2026): a 1 h y a 2,5 h de la
// llegada, un solo mensaje agrupado por dos transportes independientes (email siempre,
// SMS de 08:00 a 22:00 Madrid). La selección pura vive en lib/lead-sla-core.ts.
// Rastro y dedupe: FunnelEvent (step «lead_sla», sessionId «lead-sla:{persona}:{1|2}»).
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";
import { formatPhoneSpain, sendSMS } from "@/lib/sms";
import { getStaffEmails } from "@/lib/staff-access";
import { loadQuoteHashes } from "@/lib/vigia-graph-db";
import { deadlineLine, urgentSubjectPrefix } from "@/lib/needed-by";
import { SLA_WINDOW_HOURS, dedupeId, selectLeadSla, smsAllowed, type SlaLead } from "@/lib/lead-sla-core";

const STEP = "lead_sla";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const waiting = (min: number) => (min < 120 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`);

export async function loadLeadSla(now: Date): Promise<SlaLead[]> {
  const since = new Date(now.getTime() - SLA_WINDOW_HOURS * 36e5);
  const quotesSince = new Date(now.getTime() - 90 * 864e5);
  const [docs, inbound, solicitudes, quotes, paidOrders] = await Promise.all([
    prisma.documentAnalysis.findMany({
      where: { createdAt: { gte: since }, clientEmail: { not: null }, orderId: null, NOT: [{ sessionToken: { startsWith: "staff:" } }], AND: [{ OR: [{ source: null }, { source: { not: "lector" } }] }] },
      select: { clientEmail: true, clientName: true, clientPhone: true, sessionToken: true, fileHash: true, fileName: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, quoteAmount: true, createdAt: true, urgency: true, neededBy: true },
    }),
    prisma.inboundEmail.findMany({
      where: { receivedAt: { gte: since } },
      select: { fromEmail: true, fromName: true, fromPhone: true, subject: true, receivedAt: true, status: true, quoteId: true, repliedAt: true, channel: true },
    }),
    prisma.lavoriPriceRequest.findMany({ where: { createdAt: { gte: quotesSince } }, select: { ref: true, customerHint: true, expedienteRef: true, quoteId: true, status: true, priceCents: true, par: true, createdAt: true } }),
    prisma.quote.findMany({
      where: { deletedAt: null, OR: [{ createdAt: { gte: quotesSince } }, { sentAt: { gte: quotesSince } }] },
      select: { id: true, customerEmail: true, customerPhone: true, expedienteRef: true, holderNames: true, sentAt: true, createdAt: true },
    }),
    prisma.order.findMany({ where: { paymentStatus: "PAID", paidAt: { gte: since } }, select: { clientEmail: true, clientName: true, clientPhone: true } }),
  ]);
  const hashesOfQuote = await loadQuoteHashes(quotes.map((q) => q.id));
  const staffEmails = [...getStaffEmails(), process.env.PRESUPUESTO_TO, process.env.ADMIN_EMAIL, process.env.EMAIL_FROM, "info@traduccionesjuradas.net"].filter((e): e is string => !!e);
  return selectLeadSla({
    now,
    docs: docs.map((d) => ({ ...d, quoteAmount: d.quoteAmount == null ? null : Number(d.quoteAmount) })),
    inbound: inbound.map((m) => ({ ...m, channel: String(m.channel), status: String(m.status) })),
    solicitudes,
    quotes: quotes.map((q) => ({ id: q.id, email: q.customerEmail, phone: q.customerPhone, expRef: q.expedienteRef, holder: q.holderNames, sentAt: q.sentAt, createdAt: q.createdAt })),
    paidOrders,
    hashesOfQuote,
    staffEmails,
  });
}

function renderEmail(leads: SlaLead[]): { subject: string; html: string } {
  const oldest = leads[0];
  // Plazo corto (lo antes posible o ≤3 días) = urgente desde el primer aviso.
  const byDeadline = leads.map((l) => urgentSubjectPrefix(l.deadline)).find(Boolean);
  const late = leads.some((l) => l.stage === 2);
  const subject = `${byDeadline || (late ? "URGENTE · " : "")}${leads.length} lead${leads.length > 1 ? "s" : ""} sin presupuesto · el más antiguo espera ${waiting(oldest.minutes)}`;
  const rows = leads
    .map((l) => {
      const who = [l.name, l.email, l.phone].filter(Boolean).map((x) => esc(String(x))).join(" · ") || "sin datos";
      const plazo = deadlineLine(l.deadline);
      return `<li style="margin-bottom:12px"><b>${esc(l.name || l.email || l.phone || "Lead")}</b> — espera <b>${waiting(l.minutes)}</b>${l.stage === 2 ? " (2.º aviso)" : ""}<br>${who}<br>${plazo ? `<b${l.urgent ? ' style="color:#b91c1c"' : ""}>${esc(plazo)}</b><br>` : ""}Par: ${esc(l.pairs.join(", ") || "sin par")}${l.motor != null ? ` · motor ${eur(l.motor)}` : ""} · vía ${esc(l.via.join("/"))}<br>${l.links.map((u) => `<a href="${esc(u)}">${u.includes("/admin/inbox") ? "Bandeja" : "Hacer presupuesto"}</a>`).join(" · ")}</li>`;
    })
    .join("");
  const html = wrapClientEmailHtml(`<p>Los clientes piden precio a varias agencias: hay que enviar presupuesto en 3-4 h.</p><ul style="padding-left:18px">${rows}</ul>`);
  return { subject, html };
}

function renderSms(leads: SlaLead[]): string {
  const parts = leads.slice(0, 4).map((l) => `${(l.name || l.email || l.phone || "lead").slice(0, 20)} ${waiting(l.minutes)}${l.pairs[0] ? ` ${l.pairs[0]}` : ""}`);
  return `${leads.some((l) => l.urgent) ? "URGENTE · " : ""}Lead sin presupuesto (${leads.length}): ${parts.join("; ")}${leads.length > 4 ? "…" : ""}. Detalle en el email.`.slice(0, 300);
}

/** Cron cada 10 min. Nunca lanza por un transporte caído: cada uno deja su resultado en el rastro. */
export async function runLeadSla(now = new Date()) {
  const leads = await loadLeadSla(now);
  const windowStart = new Date(now.getTime() - SLA_WINDOW_HOURS * 36e5);
  const basesOf = (l: SlaLead) => [l.keyBase, ...l.altBases];
  const matches = (l: SlaLead, id: string) => basesOf(l).some((b) => id.startsWith(`lead-sla:${b}:`));
  const canSms = smsAllowed(now);

  const ids = leads.flatMap((l) => basesOf(l).map((b) => dedupeId(b, l.stage)));
  const existing = ids.length ? await prisma.funnelEvent.findMany({ where: { step: STEP, createdAt: { gte: windowStart }, sessionId: { in: ids } }, select: { sessionId: true } }) : [];
  const done = new Set(existing.map((e) => e.sessionId));
  const fresh = leads.filter((l) => !basesOf(l).some((b) => done.has(dedupeId(b, l.stage))));

  // Avisos de madrugada que salieron solo por email: el SMS pendiente sale al abrirse la franja.
  const quiet = canSms && leads.length
    ? await prisma.funnelEvent.findMany({ where: { step: STEP, createdAt: { gte: windowStart }, metadata: { path: ["sms"], equals: "quiet" } }, select: { sessionId: true, metadata: true } }).catch(() => [])
    : [];

  const written: { id: string; lead: SlaLead }[] = [];
  for (const l of fresh) {
    const id = dedupeId(l.keyBase, l.stage);
    try {
      await prisma.funnelEvent.create({ data: { sessionId: id, reference: "lead-sla", step: STEP, metadata: { stage: l.stage, minutes: l.minutes, email: "pending", sms: canSms ? "pending" : "quiet" } } });
      written.push({ id, lead: l });
    } catch (err) {
      console.error("[lead-sla] dedupe row not written, skipping lead", id, err);
    }
  }
  const toAlert = written.map((w) => w.lead);

  let email = "none";
  if (toAlert.length) {
    const to = process.env.PRESUPUESTO_TO || "hola@traduccionesjuradas.net";
    const { subject, html } = renderEmail(toAlert);
    email = await sendMail({ to, subject, html }).then(() => "ok", (e) => { console.error("[lead-sla] email failed", e); return "fail"; });
  }

  const patch = (id: string, data: Record<string, unknown>) =>
    prisma.funnelEvent.update({ where: { sessionId_step: { sessionId: id, step: STEP } }, data: { metadata: data as any } }).catch((e) => console.error("[lead-sla] trace update failed", id, e));

  // Candidatos a SMS: los recién avisados y los diferidos. Cada uno tiene su propia fila «:sms», creada ANTES de enviar.
  const candidates: { main: string; lead: SlaLead; meta: Record<string, unknown> }[] = [];
  if (canSms) {
    for (const w of written) candidates.push({ main: w.id, lead: w.lead, meta: { stage: w.lead.stage, minutes: w.lead.minutes } });
    for (const row of quiet) {
      const lead = leads.find((l) => matches(l, row.sessionId));
      if (lead && !candidates.some((c) => c.main === row.sessionId)) candidates.push({ main: row.sessionId, lead, meta: (row.metadata as Record<string, unknown>) || {} });
    }
  }
  const claimed: typeof candidates = [];
  for (const c of candidates) {
    try {
      await prisma.funnelEvent.create({ data: { sessionId: `${c.main}:sms`, reference: "lead-sla", step: STEP, metadata: { sms: "pending" } } });
      claimed.push(c);
    } catch {
      await patch(c.main, { ...c.meta, sms: "done" });
    }
  }

  let sms = canSms ? "none" : "quiet";
  const staff = process.env.STAFF_PHONE;
  if (claimed.length) {
    if (!staff) sms = "off";
    else {
      sms = await sendSMS({ to: formatPhoneSpain(staff), body: renderSms([...new Map(claimed.map((c) => [c.lead.root, c.lead])).values()]), channel: "sms" }).then((r) => (r.ok ? "ok" : "fail"), () => "fail");
      if (sms === "fail") console.error("[lead-sla] sms failed");
    }
  }

  await Promise.all([
    ...written.map((w) => patch(w.id, { stage: w.lead.stage, minutes: w.lead.minutes, email, sms: canSms ? (claimed.some((c) => c.main === w.id) ? sms : "done") : "quiet" })),
    ...claimed.map((c) => patch(`${c.main}:sms`, { sms })),
    ...claimed.filter((c) => !written.some((w) => w.id === c.main)).map((c) => patch(c.main, { ...c.meta, sms, retried: true })),
  ]);
  return { leads: leads.length, avisados: toAlert.length, email, sms };
}
