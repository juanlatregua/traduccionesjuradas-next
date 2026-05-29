import type { Metadata } from "next";
import { authZonaTraductorOrRedirect, loadBandejaState } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Zona traductor — Expedientes entrantes",
  robots: { index: false, follow: false },
};

type Group = {
  ref: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  count: number;
  createdAt: Date;
  analyzed: number;
};

export default async function ZonaTraductorExpedientesPage() {
  await authZonaTraductorOrRedirect();
  const bandeja = await loadBandejaState().catch(() => null);
  const accionables = bandeja?.pedidosAccionables ?? 0;

  const rows = await prisma.documentAnalysis.findMany({
    where: { sessionToken: { startsWith: "exp:" } },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: {
      sessionToken: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      createdAt: true,
      status: true,
    },
  });

  const map = new Map<string, Group>();
  for (const r of rows) {
    if (!r.sessionToken) continue;
    const ref = r.sessionToken.replace(/^exp:/, "");
    const g = map.get(ref);
    if (g) {
      g.count += 1;
      if (r.status === "QUOTE_GENERATED" || r.status === "ANALYZED") g.analyzed += 1;
      if (r.createdAt > g.createdAt) g.createdAt = r.createdAt;
    } else {
      map.set(ref, {
        ref,
        clientName: r.clientName,
        clientEmail: r.clientEmail,
        clientPhone: r.clientPhone,
        count: 1,
        createdAt: r.createdAt,
        analyzed: r.status === "QUOTE_GENERATED" || r.status === "ANALYZED" ? 1 : 0,
      });
    }
  }
  const groups = Array.from(map.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="min-h-screen bg-slate-950">
      <ZonaTraductorNav modoActivo="expedientes" pedidosAccionables={accionables} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Expedientes entrantes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Expedientes subidos por clientes desde la web. Ábrelos para analizar los documentos y enviar el presupuesto.
        </p>

        {groups.length === 0 ? (
          <p className="mt-10 text-slate-500">No hay expedientes entrantes todavía.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm text-slate-200">
              <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2">Expediente</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2 text-right">Docs</th>
                  <th className="px-4 py-2">Recibido</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {groups.map((g) => (
                  <tr key={g.ref}>
                    <td className="px-4 py-3 font-mono text-cyan-300">{g.ref}</td>
                    <td className="px-4 py-3">
                      <div className="text-white">{g.clientName || "—"}</div>
                      <div className="text-xs text-slate-400">{g.clientEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-slate-500" /> {g.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {g.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      {g.analyzed >= g.count ? (
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Analizado</span>
                      ) : (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Nuevo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/zona-traductor/presupuesto?exp=${encodeURIComponent(g.ref)}`}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                      >
                        Preparar presupuesto
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
