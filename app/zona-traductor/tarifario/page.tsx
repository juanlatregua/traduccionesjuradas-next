import type { Metadata } from "next";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { isLearnedRatesLive, DOC_FLOOR_CENTS, AUTO_QUOTE_MAX_CENTS } from "@/lib/learned-rates";
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
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <Link href="/zona-traductor/presupuestos" className="text-sm text-[#1A2E4A] hover:text-[#1A2E4A]">
            ← Presupuestos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[#1A2E4A]">Tarifario aprendido</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#52606D]">
            Lo que ya ha pasado, por tipo de documento y par: el coste que pidió el jurado en lavori y el precio que pagó el
            cliente. Con una tarifa <strong className="text-[#1F6B45]">aprobada</strong>, la puerta emite y envía el presupuesto sola,
            sin volver a preguntar al traductor; al pagar, el encargo le llega con su cifra cerrada. Nunca francés.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[#BFE0CC] bg-[#EEF7F1] px-3 py-1 text-[#1F6B45]">{approved} aprobadas</span>
            <span className="rounded-full border border-[#E9D8A6] bg-[#FFF8E6] px-3 py-1 text-[#7A5A10]">{candidates} esperando tu OK</span>
            <span className="rounded-full border border-[#D5DAE1] bg-[#F6F7F9] px-3 py-1 text-[#1F2933]">{usedAuto} presupuestos automáticos emitidos</span>
            <span className={`rounded-full border px-3 py-1 ${isLearnedRatesLive() ? "border-[#D5DAE1] bg-[#F6F7F9] text-[#1A2E4A]" : "border-[#F0C9C9] bg-[#FDF2F2] text-[#A12B2B]"}`}>
              {isLearnedRatesLive() ? "agente activo" : "agente APAGADO (LEARNED_RATES_LIVE=off)"}
            </span>
          </div>
          <p className="mt-2 text-xs text-[#52606D]">
            Reglas: margen por tramos (30/25/20 % según coste, mínimo 10 €, tope +60 % sobre coste) si nadie ha pagado aún · suelo {(DOC_FLOOR_CENTS / 100).toFixed(0)} € netos por documento ·
            tope automático {(AUTO_QUOTE_MAX_CENTS / 100).toFixed(0)} € netos · tarifa por documento solo si el tamaño es parecido (±30 %) ·
            por 1000 palabras desde 600 palabras · CLI: <code className="text-[#52606D]">scripts/tarifario.ts</code>.
          </p>
        </header>

        <TarifarioTable rows={rows} />
      </div>
    </div>
  );
}
