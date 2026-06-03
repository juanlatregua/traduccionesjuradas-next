// lib/funnel-digest.ts — Fuente compartida del funnel + digest diario a staff.
// La página /admin/funnel y el cron /api/cron/staff-digest consumen funnelForWindow.
// El cron arma el resumen (intentos, pedidos pagados, idiomas, emails fallidos)
// que Juan recibe cada mañana — sirve además de heartbeat: si deja de llegar,
// algo de la automatización se rompió.

import { prisma } from "@/lib/prisma";

export const FUNNEL_STAGES = [
  { key: "analizado", label: "Documento analizado" },
  { key: "presupuesto", label: "Presupuesto generado" },
  { key: "lead", label: "Email capturado (lead)" },
  { key: "pedido", label: "Pedido creado" },
  { key: "pagado", label: "Pedido pagado" },
] as const;

export type StageKey = (typeof FUNNEL_STAGES)[number]["key"];
export type StageCounts = Record<StageKey, number>;

export async function funnelForWindow(days: number, source?: string): Promise<StageCounts> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const base = { createdAt: { gte: since }, ...(source ? { source } : {}) };
  const [analizado, presupuesto, lead, pedido, pagado] = await Promise.all([
    prisma.documentAnalysis.count({ where: base }),
    prisma.documentAnalysis.count({ where: { ...base, quoteAmount: { not: null } } }),
    prisma.documentAnalysis.count({ where: { ...base, clientEmail: { not: null } } }),
    prisma.documentAnalysis.count({ where: { ...base, orderId: { not: null } } }),
    prisma.documentAnalysis.count({ where: { ...base, order: { is: { paymentStatus: "PAID" } } } }),
  ]);
  return { analizado, presupuesto, lead, pedido, pagado };
}

export type StaffDigest = {
  windowHours: number;
  day: StageCounts;
  week: StageCounts;
  paidOrders: { reference: string; amountEur: number; langPair: string | null; clientEmail: string | null; source: string | null }[];
  topLanguages: { lang: string; count: number }[];
  failedEmails: { error: string; attempt: number; at: string }[];
};

export async function buildStaffDigest(windowHours = 24): Promise<StaffDigest> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [day, week, paid, recentAnalyses, failed] = await Promise.all([
    funnelForWindow(windowHours / 24),
    funnelForWindow(7),
    prisma.order.findMany({
      where: { paidAt: { gte: since } },
      orderBy: { paidAt: "desc" },
      select: { reference: true, amountCents: true, langPair: true, clientEmail: true, source: true },
    }),
    prisma.documentAnalysis.findMany({
      where: { createdAt: { gte: since }, sourceLanguage: { not: null } },
      select: { sourceLanguage: true },
    }),
    prisma.failedEmail.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { error: true, attempt: true, createdAt: true },
    }),
  ]);

  const langTally = new Map<string, number>();
  for (const a of recentAnalyses) {
    const l = a.sourceLanguage || "?";
    langTally.set(l, (langTally.get(l) || 0) + 1);
  }
  const topLanguages = [...langTally.entries()]
    .map(([lang, count]) => ({ lang, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    windowHours,
    day,
    week,
    paidOrders: paid.map((o) => ({
      reference: o.reference,
      amountEur: (o.amountCents ?? 0) / 100,
      langPair: o.langPair,
      clientEmail: o.clientEmail,
      source: o.source,
    })),
    topLanguages,
    failedEmails: failed.map((f) => ({ error: f.error.slice(0, 200), attempt: f.attempt, at: f.createdAt.toISOString() })),
  };
}

function stageRows(counts: StageCounts): string {
  const base = counts.analizado || 0;
  return FUNNEL_STAGES.map((s) => {
    const n = counts[s.key];
    const pctStr = base > 0 ? `${((n / base) * 100).toFixed(0)} %` : "—";
    return `<tr><td style="padding:3px 12px 3px 0;">${s.label}</td><td style="padding:3px 12px 3px 0; text-align:right; font-weight:600;">${n}</td><td style="padding:3px 0; text-align:right; color:#6b7280;">${pctStr}</td></tr>`;
  }).join("");
}

export function buildDigestHtml(d: StaffDigest): string {
  const paidHtml = d.paidOrders.length
    ? `<ul style="margin:6px 0; padding-left:18px;">${d.paidOrders
        .map((o) => `<li><strong>${o.reference}</strong> · ${o.amountEur.toFixed(2)} € · ${o.langPair || "—"} · ${o.clientEmail || "—"}${o.source ? ` · <em>${o.source}</em>` : ""}</li>`)
        .join("")}</ul>`
    : `<p style="color:#6b7280; margin:6px 0;">Sin pedidos pagados en las últimas ${d.windowHours} h.</p>`;

  const langsHtml = d.topLanguages.length
    ? d.topLanguages.map((l) => `${l.lang}: ${l.count}`).join(" · ")
    : "—";

  const failHtml = d.failedEmails.length
    ? `<div style="margin:10px 0; padding:10px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px;">
        <p style="margin:0 0 6px; font-weight:600; color:#991b1b;">⚠ ${d.failedEmails.length} email(s) fallaron en 24 h</p>
        <ul style="margin:0; padding-left:18px; font-size:13px; color:#7f1d1d;">${d.failedEmails.map((f) => `<li>${f.at.slice(0, 16)} — ${f.error}</li>`).join("")}</ul>
      </div>`
    : `<p style="color:#059669; margin:6px 0;">✓ Sin emails fallidos en 24 h.</p>`;

  return `
    <h2 style="margin:0 0 4px;">Resumen diario · traduccionesjuradas.net</h2>
    <p style="color:#6b7280; margin:0 0 16px; font-size:13px;">Si dejas de recibir este correo, algo de la automatización se ha parado.</p>

    <h3 style="margin:16px 0 4px;">Pedidos pagados (últimas ${d.windowHours} h)</h3>
    ${paidHtml}

    ${failHtml}

    <h3 style="margin:16px 0 4px;">Embudo — últimas ${d.windowHours} h</h3>
    <table style="border-collapse:collapse; font-size:14px;"><tbody>${stageRows(d.day)}</tbody></table>

    <h3 style="margin:16px 0 4px;">Embudo — últimos 7 días</h3>
    <table style="border-collapse:collapse; font-size:14px;"><tbody>${stageRows(d.week)}</tbody></table>

    <h3 style="margin:16px 0 4px;">Idiomas de los intentos (24 h)</h3>
    <p style="margin:6px 0;">${langsHtml}</p>

    <p style="margin:18px 0 0;"><a href="https://www.traduccionesjuradas.net/admin/funnel" style="display:inline-block; background:#0891b2; color:#fff; padding:9px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Ver funnel completo</a></p>
  `;
}
