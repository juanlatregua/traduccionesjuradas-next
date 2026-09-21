"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botón "Descartar" para una solicitud de precio de lavori sin presupuesto
// (Juan, 21-sep-2026): cierra el carril en tj.net con motivo obligatorio.
// NO avisa a lavori ni a nadie — si el encargo sigue vivo allí, Juan lo
// retira a mano.
export default function DiscardLavoriLeadButton({ id, ref: leadRef }: { id: string; ref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function discard() {
    const motivo = window.prompt(
      `Descartar la solicitud ${leadRef}. Esto NO retira el encargo en lavori (hazlo tú a mano si sigue vivo). Motivo:`
    );
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      window.alert("Escribe un motivo de al menos 3 caracteres.");
      return;
    }
    if (!window.confirm(`¿Descartar ${leadRef}? No se avisa a lavori: el encargo allí lo retiras tú a mano.`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/lavori/price-requests/${encodeURIComponent(id)}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        window.alert(data?.error || "No se pudo descartar.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Error de red.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={discard}
      title="Cierra la solicitud en tj.net; el encargo en lavori (si sigue vivo) lo retiras tú a mano"
      className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50"
    >
      {busy ? "…" : "Descartar"}
    </button>
  );
}
