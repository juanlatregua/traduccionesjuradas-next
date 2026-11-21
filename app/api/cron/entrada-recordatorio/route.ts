import { prisma } from "@/lib/prisma";
import { hasCronSecret } from "@/lib/cron-auth";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { isStaffEmail } from "@/lib/staff-access";
import { puertaV2On } from "@/lib/entrada/flag";
import { sessionKeyOf } from "@/lib/entrada/store";
import { RECORDATORIO_HASTA_MS, RECORDATORIO_STEP, RECORDATORIO_TRAS_MS, recordatorioEmail, recordatorioHourOk, selectRecordatorios } from "@/lib/entrada/recordatorio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_PUERTA = "https://www.traduccionesjuradas.net/presupuesto-instantaneo";

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  // Con la puerta nueva apagada, el enlace abre la vieja: el cliente no encontraría su solicitud.
  if (!puertaV2On()) return Response.json({ ok: true, skipped: "PUERTA_V2 off" });
  if (!recordatorioHourOk(now)) return Response.json({ ok: true, skipped: "fuera de 8-22 h Madrid" });

  const rows = await prisma.entrada.findMany({
    where: {
      estado: { in: ["abierta", "leida"] },
      canal: "web",
      email: { not: null },
      emailVerifiedAt: { not: null },
      marketingConsentAt: { not: null },
      updatedAt: { lte: new Date(now.getTime() - RECORDATORIO_TRAS_MS), gte: new Date(now.getTime() - RECORDATORIO_HASTA_MS) },
    },
    take: 100,
    select: { id: true, estado: true, canal: true, email: true, emailVerifiedAt: true, marketingConsentAt: true, updatedAt: true, lang: true, casoId: true },
  });
  if (rows.length === 0) return Response.json({ ok: true, sent: 0 });

  const sessions = rows.map((e) => sessionKeyOf(e.id));
  const emails = [...new Set(rows.map((e) => e.email!.toLowerCase()))];
  const since = new Date(now.getTime() - 3 * 864e5);
  const [files, done, confirmed, quotes] = await Promise.all([
    prisma.documentAnalysis.groupBy({ by: ["sessionToken"], where: { sessionToken: { in: sessions } }, _count: { _all: true } }),
    prisma.funnelEvent.findMany({ where: { step: RECORDATORIO_STEP, sessionId: { in: sessions } }, select: { sessionId: true } }),
    prisma.entrada.findMany({ where: { email: { in: emails, mode: "insensitive" }, estado: { in: ["confirmada", "sin_jurado"] }, updatedAt: { gte: since } }, select: { email: true } }),
    prisma.quote.findMany({ where: { customerEmail: { in: emails, mode: "insensitive" }, deletedAt: null, createdAt: { gte: since } }, select: { customerEmail: true } }),
  ]);
  const n = new Map(files.map((f) => [f.sessionToken, f._count._all]));
  const finished = new Set([...confirmed.map((c) => c.email!.toLowerCase()), ...quotes.map((q) => q.customerEmail.toLowerCase())]);
  const due = selectRecordatorios(
    rows.map((e) => ({ ...e, files: n.get(sessionKeyOf(e.id)) ?? 0 })),
    now,
    { done: new Set(done.map((d) => d.sessionId.slice("entrada:".length))), finished, staff: (email) => isStaffEmail(email) },
  );

  let sent = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const e of due) {
    const to = e.email!.toLowerCase();
    if (seen.has(to)) continue;
    seen.add(to);
    // Reclamo antes de enviar (único por entrada): dos ejecuciones a la vez no mandan dos.
    const claimed = await prisma.funnelEvent
      .create({ data: { sessionId: sessionKeyOf(e.id), reference: "entrada", step: RECORDATORIO_STEP, metadata: { lang: rows.find((r) => r.id === e.id)?.lang ?? null } } })
      .then(() => true)
      .catch(() => false);
    if (!claimed) continue;
    const { subject, text } = recordatorioEmail(rows.find((r) => r.id === e.id)?.lang ?? null, URL_PUERTA);
    try {
      await sendMail({ to: e.email!, subject, html: renderSimpleEmailHtml(text), text });
      sent++;
    } catch (err) {
      failed++;
      console.error("[entrada-recordatorio] envío falló", e.id, err);
      await prisma.funnelEvent.deleteMany({ where: { sessionId: sessionKeyOf(e.id), step: RECORDATORIO_STEP } }).catch(() => {});
    }
  }
  return Response.json({ ok: true, candidates: rows.length, due: due.length, sent, failed });
}
