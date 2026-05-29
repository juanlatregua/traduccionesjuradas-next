"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Move = { to: string; lane: string; label: string };
type Card = {
  reference: string;
  client: string;
  langPair: string;
  amountCents: number;
  dueLabel: string | null;
  overdue: boolean;
  urgent: boolean;
  assignedTo: string | null;
  docTotal: number;
  docDone: number;
  paymentPending: boolean;
  invoiceNumber: string | null;
  state: string;
  stateLabel: string;
  lane: string;
  moves: Move[];
};
type Lane = { key: string; label: string };

function eur(cents: number) {
  return `${(cents / 100).toFixed(0)} €`;
}

export default function KanbanBoard({ lanes, initialCards }: { lanes: Lane[]; initialCards: Card[] }) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [dragRef, setDragRef] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [lang, setLang] = useState("");
  const [collab, setCollab] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [q, setQ] = useState("");

  const langs = useMemo(() => Array.from(new Set(cards.map((c) => c.langPair).filter(Boolean))).sort(), [cards]);
  const collabs = useMemo(
    () => Array.from(new Set(cards.map((c) => c.assignedTo).filter(Boolean))).sort() as string[],
    [cards]
  );

  const visible = cards.filter((c) => {
    if (lang && c.langPair !== lang) return false;
    if (collab && c.assignedTo !== collab) return false;
    if (urgentOnly && !(c.urgent || c.overdue)) return false;
    if (q && !`${c.client} ${c.reference}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function applyMove(card: Card, targetLane: string) {
    if (card.lane === targetLane) return;
    const move = card.moves.find((m) => m.lane === targetLane);
    if (!move) {
      const next = card.moves[0];
      flash(next ? `"${card.client}": solo puedes avanzar a "${next.label}".` : `"${card.client}" no puede avanzar más.`);
      return;
    }
    setBusy(card.reference);
    // Optimista
    setCards((prev) => prev.map((c) => (c.reference === card.reference ? { ...c, lane: targetLane, stateLabel: move.label } : c)));
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(card.reference)}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: move.to, reason: "Movido en el tablero" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo mover.");
      flash(`"${card.client}" → ${move.label}.`);
      router.refresh();
    } catch (e: any) {
      setCards(initialCards); // revertir
      flash(e?.message || "Error al mover.");
    } finally {
      setBusy(null);
    }
  }

  const field = "rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100";

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tablero de proyectos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Arrastra una tarjeta a la siguiente fase, o usa el botón <strong>Avanzar</strong> (accesible por teclado).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${field} w-44`} placeholder="Buscar cliente / ref…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={field} value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Filtrar por idioma">
            <option value="">Todos los idiomas</option>
            {langs.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className={field} value={collab} onChange={(e) => setCollab(e.target.value)} aria-label="Filtrar por colaborador">
            <option value="">Todos</option>
            {collabs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-300">
            <input type="checkbox" checked={urgentOnly} onChange={(e) => setUrgentOnly(e.target.checked)} className="h-4 w-4" />
            Urgentes
          </label>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {lanes.map((lane) => {
          const laneCards = visible.filter((c) => c.lane === lane.key);
          const sum = laneCards.reduce((s, c) => s + c.amountCents, 0);
          return (
            <section
              key={lane.key}
              role="list"
              aria-label={lane.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOverLane(lane.key);
              }}
              onDragLeave={() => setOverLane((p) => (p === lane.key ? null : p))}
              onDrop={(e) => {
                e.preventDefault();
                setOverLane(null);
                const ref = dragRef || e.dataTransfer.getData("text/plain");
                const card = cards.find((c) => c.reference === ref);
                if (card) applyMove(card, lane.key);
                setDragRef(null);
              }}
              className={`flex flex-col rounded-xl border p-2 transition-colors ${
                overLane === lane.key ? "border-cyan-400 bg-cyan-500/5" : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <header className="flex items-center justify-between px-1 py-1.5">
                <span className="text-sm font-semibold text-slate-200">{lane.label}</span>
                <span className="text-xs text-slate-500">
                  {laneCards.length}{sum > 0 ? ` · ${eur(sum)}` : ""}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {laneCards.map((c) => {
                  const next = c.moves[0];
                  return (
                    <article
                      key={c.reference}
                      role="listitem"
                      draggable
                      onDragStart={(e) => {
                        setDragRef(c.reference);
                        e.dataTransfer.setData("text/plain", c.reference);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      aria-label={`${c.client}, ${c.stateLabel}, ${eur(c.amountCents)}`}
                      className={`cursor-grab rounded-lg border bg-slate-800/70 p-2.5 shadow-sm active:cursor-grabbing ${
                        c.overdue ? "border-rose-500/60" : c.urgent ? "border-amber-500/50" : "border-slate-700"
                      } ${busy === c.reference ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white" title={c.client}>{c.client}</span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500">{c.reference}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                        {c.langPair && <span className="rounded bg-slate-700/60 px-1.5 py-0.5">{c.langPair}</span>}
                        <span className="tabular-nums">{eur(c.amountCents)}</span>
                        {c.dueLabel && (
                          <span className={c.overdue ? "text-rose-400" : c.urgent ? "text-amber-400" : "text-slate-400"}>
                            {c.overdue ? "⚠ " : "⏱ "}{c.dueLabel}
                          </span>
                        )}
                      </div>
                      {c.docTotal > 0 && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.round((c.docDone / c.docTotal) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] tabular-nums text-slate-400">{c.docDone}/{c.docTotal}</span>
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {c.assignedTo && <span className="text-slate-400">👤 {c.assignedTo.split("@")[0]}</span>}
                        {c.paymentPending && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">💳 sin cobrar</span>}
                        {c.invoiceNumber && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">🧾 {c.invoiceNumber}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <a href={`/zona-traductor/proyecto/${c.reference}`} className="text-[11px] text-cyan-400 hover:text-cyan-300">Abrir</a>
                        {next && (
                          <button
                            type="button"
                            onClick={() => applyMove(c, next.lane)}
                            disabled={busy === c.reference}
                            className="rounded-md border border-cyan-700 bg-cyan-600/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-600/40 disabled:opacity-50"
                          >
                            Avanzar → {next.label}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {laneCards.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-600">—</p>}
              </div>
            </section>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
