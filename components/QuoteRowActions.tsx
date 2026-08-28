"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUOTE_LOST_REASONS, QUOTE_LOST_REASON_LABELS } from "@/lib/quote-lost-reasons";

const FORMALIZED = ["PAID", "IN_PROGRESS", "DELIVERED"];
const MARKABLE_LOST = ["DRAFT", "SENT", "OPENED", "ACCEPTED"];

export default function QuoteRowActions({ id, status, deleted }: { id: string; status: string; deleted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<string>("PRICE");
  const formalized = FORMALIZED.includes(status);

  async function post(path: string, body: unknown, errFallback: string) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        alert(d.error || errFallback);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Error de red.");
      setBusy(false);
    }
  }

  async function act(restore: boolean) {
    if (!restore && !window.confirm("¿Mover este presupuesto a Eliminados? (podrás restaurarlo)")) return;
    await post(`/api/quotes/${id}/delete`, { restore }, "No se pudo completar la acción.");
  }

  async function markLost() {
    await post(`/api/quotes/${id}/mark-lost`, { reason: lostReason }, "No se pudo marcar como no aceptado.");
    setLostOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/zona-traductor/presupuestos/${id}`}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Abrir
      </Link>
      {!deleted && MARKABLE_LOST.includes(status) && (
        lostOpen ? (
          <span className="flex items-center gap-1">
            <select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              className="rounded-lg border border-rose-300 bg-white px-1.5 py-1 text-xs text-slate-800"
              aria-label="Motivo"
            >
              {QUOTE_LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {QUOTE_LOST_REASON_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={markLost}
              className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy ? "…" : "OK"}
            </button>
            <button
              disabled={busy}
              onClick={() => setLostOpen(false)}
              className="px-1 text-xs font-semibold text-slate-500 hover:underline"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            disabled={busy}
            onClick={() => setLostOpen(true)}
            className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            title="Cerrar como no aceptado (con motivo)"
          >
            No aceptado
          </button>
        )
      )}
      {deleted ? (
        <button
          disabled={busy}
          onClick={() => act(true)}
          className="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {busy ? "…" : "Restaurar"}
        </button>
      ) : formalized ? null : (
        <button
          disabled={busy}
          onClick={() => act(false)}
          className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          title="Mover a Eliminados (solo presupuestos no formalizados)"
        >
          {busy ? "…" : "Eliminar"}
        </button>
      )}
    </div>
  );
}
