import type { Metadata } from "next";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Zona traductor — Discrepancias del caso",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Payload = { entrada?: string; guarda?: string; motivo?: string; decisionVieja?: string; decisionResolver?: { accion?: string; regla?: string } | null; refs?: Record<string, unknown> };

export default async function DiscrepanciasCasoPage() {
  await authZonaTraductorOrRedirect();

  const desde = new Date(Date.now() - 30 * 864e5);
  const [todas, fallos] = await Promise.all([
    prisma.casoEvento.findMany({
      where: { tipo: "discrepancia", createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: { id: true, createdAt: true, payload: true, caso: { select: { ref: true, estado: true } } },
    }),
    prisma.casoEvento.count({ where: { tipo: "fallo_resolver", createdAt: { gte: desde } } }),
  ]);

  const porEntrada = new Map<string, Map<string, number>>();
  for (const e of todas) {
    const p = (e.payload || {}) as Payload;
    const entrada = p.entrada || "?";
    const m = porEntrada.get(entrada) || new Map<string, number>();
    m.set(p.motivo || "?", (m.get(p.motivo || "?") || 0) + 1);
    porEntrada.set(entrada, m);
  }
  const resumen = [...porEntrada.entries()]
    .map(([entrada, m]) => ({ entrada, total: [...m.values()].reduce((a, n) => a + n, 0), motivos: [...m.entries()].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.total - a.total);
  const ultimas = todas.slice(0, 50);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <Link href="/zona-traductor/presupuestos" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Presupuestos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Discrepancias del caso (modo sombra)</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Veces en que la guarda de siempre y el resolver de casos no vieron lo mismo (últimos 30 días). Solo lectura: las guardas
            viejas siguen decidiendo; esto sirve para saber si el resolver ya puede sustituirlas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">{todas.length} discrepancias</span>
            <span className={`rounded-full border px-3 py-1 ${fallos ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-slate-700 bg-slate-800/60 text-slate-300"}`}>
              {fallos} fallos del resolver (sin caso)
            </span>
          </div>
        </header>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Por entrada</h2>
          {resumen.length === 0 ? (
            <p className="text-sm text-slate-500">Sin discrepancias.</p>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 pr-4">Entrada</th>
                  <th className="py-1 pr-4 text-right">Total</th>
                  <th className="py-1">Motivos</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={r.entrada} className="border-t border-slate-800">
                    <td className="py-1.5 pr-4 font-medium text-white">{r.entrada}</td>
                    <td className="py-1.5 pr-4 text-right">{r.total}</td>
                    <td className="py-1.5 text-xs text-slate-400">{r.motivos.map(([m, n]) => `${m} (${n})`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Últimas 50</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Cuándo</th>
                  <th className="py-1 pr-3">Entrada</th>
                  <th className="py-1 pr-3">Guarda → vieja</th>
                  <th className="py-1 pr-3">Resolver</th>
                  <th className="py-1 pr-3">Motivo</th>
                  <th className="py-1 pr-3">Caso</th>
                  <th className="py-1">Refs</th>
                </tr>
              </thead>
              <tbody>
                {ultimas.map((e) => {
                  const p = (e.payload || {}) as Payload;
                  return (
                    <tr key={e.id} className="border-t border-slate-800 align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {e.createdAt.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="py-1.5 pr-3">{p.entrada || "?"}</td>
                      <td className="py-1.5 pr-3">
                        {p.guarda || "?"} → {p.decisionVieja || "?"}
                      </td>
                      <td className="py-1.5 pr-3">{p.decisionResolver ? `${p.decisionResolver.accion} (${p.decisionResolver.regla})` : "—"}</td>
                      <td className="py-1.5 pr-3 text-amber-200">{p.motivo || "?"}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{e.caso ? `${e.caso.ref} · ${e.caso.estado}` : "—"}</td>
                      <td className="py-1.5 font-mono text-[11px] text-slate-400">{JSON.stringify(p.refs || {})}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
