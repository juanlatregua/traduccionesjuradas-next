import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin · Funnel",
  robots: { index: false, follow: false },
};

const STEPS: Array<{ key: string; label: string }> = [
  { key: "upload", label: "Subida de documento" },
  { key: "review", label: "Revision" },
  { key: "checkout", label: "Checkout" },
  { key: "confirmation", label: "Confirmacion" },
];

function pct(n: number, base: number) {
  if (base <= 0) return "—";
  return `${((n / base) * 100).toFixed(1)} %`;
}

async function funnelForWindow(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [sessions, grouped] = await Promise.all([
    prisma.orderSession.count({ where: { createdAt: { gte: since } } }),
    prisma.funnelEvent.groupBy({
      by: ["step"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const byStep = new Map(grouped.map((g) => [g.step, g._count._all]));
  return {
    sessions,
    steps: STEPS.map((s) => ({ ...s, count: byStep.get(s.key) || 0 })),
  };
}

function FunnelTable({
  title,
  data,
}: {
  title: string;
  data: Awaited<ReturnType<typeof funnelForWindow>>;
}) {
  const rows = [
    { label: "Sesiones iniciadas", count: data.sessions, prev: data.sessions },
    ...data.steps.map((s, i) => ({
      label: s.label,
      count: s.count,
      prev: i === 0 ? data.sessions : data.steps[i - 1].count,
    })),
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-semibold">Paso</th>
            <th className="py-2 pr-4 font-semibold">Sesiones</th>
            <th className="py-2 pr-4 font-semibold">% del inicio</th>
            <th className="py-2 font-semibold">% del paso anterior</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-slate-900">{row.label}</td>
              <td className="py-2 pr-4 tabular-nums text-slate-700">{row.count}</td>
              <td className="py-2 pr-4 tabular-nums text-slate-700">
                {i === 0 ? "100 %" : pct(row.count, data.sessions)}
              </td>
              <td className="py-2 tabular-nums text-slate-700">
                {i === 0 ? "—" : pct(row.count, row.prev)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function AdminFunnelPage() {
  await requireAdminPageAccess("/admin/funnel");

  const [w7, w30] = await Promise.all([
    funnelForWindow(7),
    funnelForWindow(30),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Conversion del funnel
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sesiones que alcanzan cada paso del funnel de pedidos. Instrumentado
          el 19 de mayo de 2026 — necesita ~2 semanas de trafico para una linea
          base fiable.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelTable title="Ultimos 7 dias" data={w7} />
        <FunnelTable title="Ultimos 30 dias" data={w30} />
      </div>
    </main>
  );
}
