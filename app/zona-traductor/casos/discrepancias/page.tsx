import type { Metadata } from "next";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import CasoVeredicto from "@/components/CasoVeredicto";

export const metadata: Metadata = {
  title: "Zona traductor — Discrepancias del caso",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Payload = {
  entrada?: string;
  guarda?: string;
  objeto?: string;
  decisionVieja?: string;
  acuerdo?: boolean;
  motivo?: string | null;
  reglaOriginal?: string;
  accionResolver?: string;
  mismoCaso?: boolean | null;
  simulacion?: boolean;
  refs?: Record<string, unknown>;
};

export default async function DiscrepanciasCasoPage() {
  await authZonaTraductorOrRedirect();

  const desde = new Date(Date.now() - 30 * 864e5);
  const [comparaciones, fallos] = await Promise.all([
    prisma.casoEvento.findMany({
      where: { tipo: "comparacion", createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: { id: true, createdAt: true, payload: true, caso: { select: { ref: true, estado: true } } },
    }),
    prisma.casoEvento.count({ where: { tipo: "fallo_resolver", createdAt: { gte: desde } } }),
  ]);
  const desacuerdos = comparaciones.filter((e) => (e.payload as Payload | null)?.acuerdo === false);
  const ultimas = desacuerdos.slice(0, 50);
  const veredictos = ultimas.length
    ? await prisma.casoEvento.findMany({ where: { tipo: "veredicto", dedupeKey: { in: ultimas.map((e) => e.id) } }, select: { dedupeKey: true, payload: true } })
    : [];
  const veredictoDe = new Map(veredictos.map((v) => [v.dedupeKey, String((v.payload as { veredicto?: string } | null)?.veredicto || "")]));

  const porEntrada = new Map<string, { total: number; acuerdos: number; motivos: Map<string, number> }>();
  for (const e of comparaciones) {
    const p = (e.payload || {}) as Payload;
    const k = p.entrada || "?";
    const r = porEntrada.get(k) || { total: 0, acuerdos: 0, motivos: new Map<string, number>() };
    r.total += 1;
    if (p.acuerdo) r.acuerdos += 1;
    else r.motivos.set(p.motivo || "?", (r.motivos.get(p.motivo || "?") || 0) + 1);
    porEntrada.set(k, r);
  }
  const resumen = [...porEntrada.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <Link href="/zona-traductor/presupuestos" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Presupuestos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Caso: guarda vieja frente al resolver (modo sombra)</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Cada vez que una guarda de siempre decide crear o bloquear, el resolver de casos da su opinión (últimos 30 días). Solo
            lectura: las guardas siguen mandando. Con la tasa de acuerdo y tus veredictos se decide si el resolver ya puede sustituirlas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-slate-300">{comparaciones.length} comparaciones</span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">{desacuerdos.length} desacuerdos</span>
            <span className={`rounded-full border px-3 py-1 ${fallos ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-slate-700 bg-slate-800/60 text-slate-300"}`}>
              {fallos} fallos del resolver (sin caso)
            </span>
          </div>
        </header>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Tasa de acuerdo por entrada</h2>
          {resumen.length === 0 ? (
            <p className="text-sm text-slate-500">Sin comparaciones todavía.</p>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 pr-4">Entrada</th>
                  <th className="py-1 pr-4 text-right">Acuerdo</th>
                  <th className="py-1 pr-4 text-right">Total</th>
                  <th className="py-1">Motivos de desacuerdo</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map(([entrada, r]) => (
                  <tr key={entrada} className="border-t border-slate-800">
                    <td className="py-1.5 pr-4 font-medium text-white">{entrada}</td>
                    <td className="py-1.5 pr-4 text-right">
                      {r.acuerdos}/{r.total} · {Math.round((r.acuerdos / r.total) * 100)} %
                    </td>
                    <td className="py-1.5 pr-4 text-right">{r.total}</td>
                    <td className="py-1.5 text-xs text-slate-400">
                      {[...r.motivos.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n})`).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Últimos 50 desacuerdos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Cuándo</th>
                  <th className="py-1 pr-3">Entrada</th>
                  <th className="py-1 pr-3">Guarda → vieja</th>
                  <th className="py-1 pr-3">Resolver (regla original)</th>
                  <th className="py-1 pr-3">Motivo</th>
                  <th className="py-1 pr-3">Caso</th>
                  <th className="py-1 pr-3">Refs</th>
                  <th className="py-1">Veredicto</th>
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
                      <td className="py-1.5 pr-3">
                        {p.accionResolver ? `${p.accionResolver} (${p.reglaOriginal || "?"})` : "—"}
                        {p.simulacion ? <span className="ml-1 text-slate-500">· simulación</span> : null}
                        {p.mismoCaso != null ? <span className="ml-1 text-slate-500">· {p.mismoCaso ? "mismo caso que la guarda" : "otro caso que la guarda"}</span> : null}
                      </td>
                      <td className="py-1.5 pr-3 text-amber-200">{p.motivo || "?"}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{e.caso ? `${e.caso.ref} · ${e.caso.estado}` : "—"}</td>
                      <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-400">{JSON.stringify(p.refs || {})}</td>
                      <td className="py-1.5">
                        <CasoVeredicto eventoId={e.id} actual={veredictoDe.get(e.id) || null} />
                      </td>
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
