"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TarifarioRow = {
  id: string;
  lang: string;
  direction: "to_es" | "from_es";
  docType: string;
  apostille: boolean;
  unit: "doc" | "kword";
  costCents: number;
  clientCents: number | null;
  wordsRef: number | null;
  plazoDias: number | null;
  miembroNombre: string | null;
  status: "CANDIDATE" | "APPROVED" | "VETOED";
  samples: number;
  lastSampleAt: string | null;
  note: string | null;
  sampleRows: {
    id: string;
    kind: string;
    costCents: number | null;
    clientCents: number | null;
    words: number | null;
    ref: string;
    quoteId: string | null;
    note: string | null;
    createdAt: string;
  }[];
};

const eur = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toFixed(2)} €`);
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");
const par = (r: TarifarioRow) => (r.direction === "to_es" ? `${r.lang.toUpperCase()} → ES` : `ES → ${r.lang.toUpperCase()}`);
const KIND: Record<string, string> = {
  translator_price: "precio del jurado",
  client_paid: "pagado por el cliente",
  seed: "semilla",
  manual: "a mano",
  auto_quote: "presupuesto automático",
};
const STATUS: Record<TarifarioRow["status"], { label: string; cls: string }> = {
  APPROVED: { label: "Aprobada · actúa sola", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
  CANDIDATE: { label: "Candidata · espera tu OK", cls: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  VETOED: { label: "Vetada", cls: "border-rose-500/40 bg-rose-500/10 text-rose-200" },
};

export default function TarifarioTable({ rows }: { rows: TarifarioRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { coste: string; cliente: string; plazo: string }>>({});

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/zona-traductor/tarifario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        Todavía no hay tarifas. Se aprenden solas cuando un jurado pasa precio en lavori o cuando un cliente paga un presupuesto;
        también puedes sembrarlas con <code>scripts/tarifario.ts semillas</code> y <code>backfill</code>.
      </div>
    );
  }

  const groups: TarifarioRow["status"][] = ["CANDIDATE", "APPROVED", "VETOED"];

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {groups.map((status) => {
        const list = rows.filter((r) => r.status === status);
        if (list.length === 0) return null;
        return (
          <section key={status}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {STATUS[status].label} · {list.length}
            </h2>
            <div className="space-y-3">
              {list.map((r) => {
                const e = edit[r.id] || {
                  coste: (r.costCents / 100).toFixed(2),
                  cliente: r.clientCents != null ? (r.clientCents / 100).toFixed(2) : "",
                  plazo: r.plazoDias != null ? String(r.plazoDias) : "",
                };
                const setE = (patch: Partial<typeof e>) => setEdit((prev) => ({ ...prev, [r.id]: { ...e, ...patch } }));
                return (
                  <article key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-700/60 px-2 py-0.5 font-mono text-xs font-semibold text-slate-100">{par(r)}</span>
                          <span className="text-base font-semibold text-white">
                            {r.docType === "any" ? "cualquier documento largo" : r.docType.replace(/_/g, " ")}
                            {r.apostille ? " + apostilla" : ""}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-300">
                          Coste del jurado <strong className="text-white">{eur(r.costCents)}</strong> · cliente{" "}
                          <strong className="text-white">{r.clientCents != null ? eur(r.clientCents) : `${eur(Math.round(r.costCents * 1.12))} (coste + 12 %)`}</strong>{" "}
                          por {r.unit === "doc" ? "documento" : "1000 palabras"}
                          {r.wordsRef ? ` · ~${r.wordsRef} pal/doc` : ""}
                          {r.plazoDias ? ` · ${r.plazoDias} día${r.plazoDias === 1 ? "" : "s"}` : ""}
                          {" · "}
                          {r.miembroNombre || <span className="text-amber-300">sin jurado (al pagar irá por el carril normal)</span>}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {r.samples} muestra{r.samples === 1 ? "" : "s"} · última {fecha(r.lastSampleAt)}
                          {r.note ? ` · ${r.note}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {r.status !== "APPROVED" && (
                          <button
                            type="button"
                            disabled={busy === r.id}
                            onClick={() => act(r.id, { action: "approve" })}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                        )}
                        {r.status !== "VETOED" && (
                          <button
                            type="button"
                            disabled={busy === r.id}
                            onClick={() => act(r.id, { action: "veto" })}
                            className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                          >
                            Vetar
                          </button>
                        )}
                        {r.status !== "CANDIDATE" && (
                          <button
                            type="button"
                            disabled={busy === r.id}
                            onClick={() => act(r.id, { action: "candidate" })}
                            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                          >
                            Pausar
                          </button>
                        )}
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-cyan-400 hover:text-cyan-300">Corregir cifras · ver muestras</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <label className="text-xs text-slate-400">
                          Coste jurado (€)
                          <input value={e.coste} onChange={(ev) => setE({ coste: ev.target.value })} inputMode="decimal" className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white" />
                        </label>
                        <label className="text-xs text-slate-400">
                          Cliente neto (€)
                          <input value={e.cliente} onChange={(ev) => setE({ cliente: ev.target.value })} inputMode="decimal" placeholder="coste + 12 %" className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white" />
                        </label>
                        <label className="text-xs text-slate-400">
                          Plazo (días)
                          <input value={e.plazo} onChange={(ev) => setE({ plazo: ev.target.value })} inputMode="numeric" className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white" />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={busy === r.id}
                            onClick={() => act(r.id, { action: "update", costEur: e.coste, clientEur: e.cliente, plazoDias: e.plazo })}
                            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                          >
                            Guardar cifras
                          </button>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-slate-400">
                        {r.sampleRows.map((s) => (
                          <li key={s.id}>
                            {fecha(s.createdAt)} · {KIND[s.kind] || s.kind} · coste {eur(s.costCents)} · cliente {eur(s.clientCents)}
                            {s.words ? ` · ${s.words} pal` : ""}
                            {s.quoteId ? (
                              <>
                                {" · "}
                                <a href={`/zona-traductor/presupuestos/${s.quoteId}`} className="text-cyan-400 hover:underline">presupuesto</a>
                              </>
                            ) : s.ref ? ` · ${s.ref}` : ""}
                            {s.note ? ` · ${s.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
