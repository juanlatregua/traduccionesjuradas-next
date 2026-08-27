import type { Metadata } from "next";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { isLearnedRatesLive, LEARNED_MARGIN_PCT, DOC_FLOOR_CENTS, AUTO_QUOTE_MAX_CENTS } from "@/lib/learned-rates";
import TarifarioTable, { type TarifarioRow } from "@/components/TarifarioTable";

export const metadata: Metadata = {
  title: "Zona traductor — Tarifario aprendido",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TarifarioPage() {
  await authZonaTraductorOrRedirect();

  const rates = await prisma.learnedRate.findMany({
    orderBy: [{ status: "asc" }, { lang: "asc" }, { direction: "asc" }, { docType: "asc" }],
    include: { sampleRows: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  const rows: TarifarioRow[] = rates.map((r) => ({
    id: r.id,
    lang: r.lang,
    direction: r.direction as "to_es" | "from_es",
    docType: r.docType,
    apostille: r.apostille,
    unit: r.unit as "doc" | "kword",
    costCents: r.costCents,
    clientCents: r.clientCents,
    wordsRef: r.wordsRef,
    plazoDias: r.plazoDias,
    miembroNombre: r.miembroNombre,
    status: r.status as TarifarioRow["status"],
    samples: r.samples,
    lastSampleAt: r.lastSampleAt ? r.lastSampleAt.toISOString() : null,
    note: r.note,
    sampleRows: r.sampleRows.map((s) => ({
      id: s.id,
      kind: s.kind,
      costCents: s.costCents,
      clientCents: s.clientCents,
      words: s.words,
      ref: s.leadRef || s.orderRef || (s.quoteId ? "presupuesto" : ""),
      quoteId: s.quoteId,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
    })),
  }));
  const approved = rows.filter((r) => r.status === "APPROVED").length;
  const candidates = rows.filter((r) => r.status === "CANDIDATE").length;
  const usedAuto = rates.reduce((a, r) => a + r.sampleRows.filter((s) => s.kind === "auto_quote").length, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <Link href="/zona-traductor/presupuestos" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Presupuestos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Tarifario aprendido</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Lo que ya ha pasado, por tipo de documento y par: el coste que pidió el jurado en lavori y el precio que pagó el
            cliente. Con una tarifa <strong className="text-emerald-300">aprobada</strong>, la puerta emite y envía el presupuesto sola,
            sin volver a preguntar al traductor; al pagar, el encargo le llega con su cifra cerrada. Nunca francés.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">{approved} aprobadas</span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">{candidates} esperando tu OK</span>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-slate-300">{usedAuto} presupuestos automáticos emitidos</span>
            <span className={`rounded-full border px-3 py-1 ${isLearnedRatesLive() ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-rose-500/40 bg-rose-500/10 text-rose-200"}`}>
              {isLearnedRatesLive() ? "agente activo" : "agente APAGADO (LEARNED_RATES_LIVE=off)"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Reglas: margen {LEARNED_MARGIN_PCT} % sobre el coste si nadie ha pagado aún · mínimo {(DOC_FLOOR_CENTS / 100).toFixed(0)} € netos por documento ·
            tope automático {(AUTO_QUOTE_MAX_CENTS / 100).toFixed(0)} € netos · tarifa por documento solo si el tamaño es parecido (±30 %) ·
            por 1000 palabras desde 600 palabras · CLI: <code className="text-slate-400">scripts/tarifario.ts</code>.
          </p>
        </header>

        <TarifarioTable rows={rows} />
      </div>
    </div>
  );
}
