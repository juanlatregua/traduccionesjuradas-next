import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin · Funnel",
  robots: { index: false, follow: false },
};

const STAGES = [
  { key: "analizado", label: "Documento analizado" },
  { key: "presupuesto", label: "Presupuesto generado" },
  { key: "lead", label: "Email capturado (lead)" },
  { key: "pedido", label: "Pedido creado" },
  { key: "pagado", label: "Pedido pagado" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function pct(n: number, base: number) {
  if (base <= 0) return "—";
  return `${((n / base) * 100).toFixed(1)} %`;
}

async function funnelForWindow(days: number, source?: string) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const base = { createdAt: { gte: since }, ...(source ? { source } : {}) };
  const [analizado, presupuesto, lead, pedido, pagado] = await Promise.all([
    prisma.documentAnalysis.count({ where: base }),
    prisma.documentAnalysis.count({
      where: { ...base, quoteAmount: { not: null } },
    }),
    prisma.documentAnalysis.count({
      where: { ...base, clientEmail: { not: null } },
    }),
    prisma.documentAnalysis.count({
      where: { ...base, orderId: { not: null } },
    }),
    prisma.documentAnalysis.count({
      where: { ...base, order: { is: { paymentStatus: "PAID" } } },
    }),
  ]);
  const counts: Record<StageKey, number> = {
    analizado,
    presupuesto,
    lead,
    pedido,
    pagado,
  };
  return counts;
}

function FunnelTable({
  title,
  data,
}: {
  title: string;
  data: Record<StageKey, number>;
}) {
  const base = data.analizado;
  const rows = STAGES.map((s, i) => ({
    label: s.label,
    count: data[s.key],
    prev: i === 0 ? base : data[STAGES[i - 1].key],
  }));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-semibold">Paso</th>
            <th className="py-2 pr-4 font-semibold">Personas</th>
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
                {i === 0 ? "100 %" : pct(row.count, base)}
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

  const [w7, w30, w90, ugece30, regu30] = await Promise.all([
    funnelForWindow(7),
    funnelForWindow(30),
    funnelForWindow(90),
    funnelForWindow(30, "uge-ce"),
    funnelForWindow(30, "regularizacion-2026"),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Conversion del funnel
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Recorrido real: documento subido al presupuesto instantaneo →
          presupuesto generado → email dejado → pedido creado → pedido pagado.
          Datos historicos de DocumentAnalysis y Order — sin espera.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <FunnelTable title="Ultimos 7 dias" data={w7} />
        <FunnelTable title="Ultimos 30 dias" data={w30} />
        <FunnelTable title="Ultimos 90 dias" data={w90} />
      </div>

      <div className="mt-10 mb-6">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Por origen (ultimos 30 dias)
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Atribucion por el preset ?p= con el que llego el lead (handoff del bloque
          uge-ce, campana de regularizacion). Nota: &laquo;pedido&raquo; y
          &laquo;pagado&raquo; dependen del enlace DocumentAnalysis&rarr;Order, que la
          puerta nueva aun no fija &mdash; fiarse de analizado / presupuesto / lead.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelTable title="uge-ce (teletrabajo)" data={ugece30} />
        <FunnelTable title="regularizacion 2026" data={regu30} />
      </div>
    </main>
  );
}
