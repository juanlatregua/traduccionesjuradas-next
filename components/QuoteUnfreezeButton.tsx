"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuoteUnfreezeButton({ quoteId, estimatedCostZero = false }: { quoteId: string; estimatedCostZero?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmSinCoste, setConfirmSinCoste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/unfreeze-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, confirmSinCoste }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo desbloquear.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo desbloquear.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-300/60 px-3 py-1.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/20"
      >
        Desbloquear igualmente
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Por qué se desbloquea asumiendo la pérdida (queda en el registro)"
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
      />
      {estimatedCostZero && (
        <label className="flex items-start gap-2 text-sm text-rose-100">
          <input type="checkbox" checked={confirmSinCoste} onChange={(e) => setConfirmSinCoste(e.target.checked)} className="mt-1" />
          <span>
            Sin coste estimado en las líneas: al pagar, la cifra del jurado se aceptará SOLA en lavori (no hay freno). Lo asumo.
          </span>
        </label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || reason.trim().length < 10 || (estimatedCostZero && !confirmSinCoste)}
          onClick={submit}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {busy ? "Desbloqueando…" : "Desbloquear y asumir la pérdida"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-300 underline">
          Cancelar
        </button>
      </div>
      {error && <p className="text-sm text-rose-200">{error}</p>}
    </div>
  );
}
