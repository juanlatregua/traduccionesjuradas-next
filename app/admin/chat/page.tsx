import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin · Chat AI",
  robots: { index: false, follow: false },
};

type ToolCallLog = {
  name: string;
  durationMs: number;
  iteration: number;
  hadError: boolean;
  input?: Record<string, unknown>;
};

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)} %`;
}

function timeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export default async function AdminChatStatsPage() {
  await requireAdminPageAccess("/admin/chat");

  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [
    totalSessions,
    sessions7d,
    sessions30d,
    sessionsWithAttachment7d,
    sessionsWithToolCalls7d,
    recentSessions,
  ] = await Promise.all([
    prisma.chatSession.count(),
    prisma.chatSession.count({ where: { createdAt: { gte: since7d } } }),
    prisma.chatSession.count({ where: { createdAt: { gte: since30d } } }),
    prisma.chatSession.count({
      where: { createdAt: { gte: since7d }, hasAttachment: true },
    }),
    prisma.chatSession.count({
      where: {
        createdAt: { gte: since7d },
        NOT: { toolCalls: { equals: [] } },
      },
    }),
    prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        sessionId: true,
        detectedLanguage: true,
        detectedIntent: true,
        messageCount: true,
        toolCalls: true,
        hasAttachment: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  // Tool call frequency in last 7d
  const sessions7dFull = await prisma.chatSession.findMany({
    where: { createdAt: { gte: since7d } },
    select: { toolCalls: true },
  });

  const toolCounts: Record<string, { calls: number; errors: number }> = {};
  for (const s of sessions7dFull) {
    if (!Array.isArray(s.toolCalls)) continue;
    for (const c of s.toolCalls as unknown as ToolCallLog[]) {
      if (!toolCounts[c.name]) toolCounts[c.name] = { calls: 0, errors: 0 };
      toolCounts[c.name].calls += 1;
      if (c.hadError) toolCounts[c.name].errors += 1;
    }
  }

  const stats = [
    { label: "Sesiones (total)", value: String(totalSessions) },
    { label: "Sesiones 7d", value: String(sessions7d) },
    { label: "Sesiones 30d", value: String(sessions30d) },
    {
      label: "Vision adoption 7d",
      value: pct(sessionsWithAttachment7d, sessions7d),
    },
    {
      label: "Tool use rate 7d",
      value: pct(sessionsWithToolCalls7d, sessions7d),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Backoffice
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Chat AI — métricas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Datos de <code>ChatSession</code>: tool call tracking activo desde 2026-04-30 (PR #62).
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tool call frequency */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Tool call frequency (últimos 7 días)
          </h2>
          {Object.keys(toolCounts).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Aún no hay tool calls registradas en los últimos 7 días.
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="py-2">Tool</th>
                  <th className="py-2">Llamadas</th>
                  <th className="py-2">Errores</th>
                  <th className="py-2">Tasa de error</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(toolCounts)
                  .sort(([, a], [, b]) => b.calls - a.calls)
                  .map(([name, c]) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="py-2 font-mono text-xs">{name}</td>
                      <td className="py-2 font-semibold">{c.calls}</td>
                      <td className="py-2">{c.errors}</td>
                      <td className="py-2">{pct(c.errors, c.calls)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent sessions */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Últimas 30 sesiones
          </h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="py-2">Hace</th>
                <th className="py-2">Idioma</th>
                <th className="py-2">Intent</th>
                <th className="py-2">Mensajes</th>
                <th className="py-2">📎</th>
                <th className="py-2">Tools</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => {
                const tools = Array.isArray(s.toolCalls)
                  ? (s.toolCalls as unknown as ToolCallLog[])
                  : [];
                const toolNames = tools.map((t) => t.name).join(", ");
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 text-xs text-slate-500">{timeAgo(s.updatedAt)}</td>
                    <td className="py-2">{s.detectedLanguage ?? "—"}</td>
                    <td className="py-2 text-xs">{s.detectedIntent ?? "—"}</td>
                    <td className="py-2">{s.messageCount}</td>
                    <td className="py-2">{s.hasAttachment ? "✓" : ""}</td>
                    <td className="py-2 text-xs text-slate-600">{toolNames || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {recentSessions.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">Sin sesiones recientes.</p>
          )}
        </div>
      </section>
    </main>
  );
}
