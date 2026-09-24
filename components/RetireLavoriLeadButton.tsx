"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Retirar en lavori" (Juan, 24-sep-2026): retira el encargo en lavori de una
// solicitud viva (con presupuesto, aceptada o reabierta) y la cierra en tj.net.
// Si un jurado ya la tiene, lavori responde quién y no se toca nada.
export default function RetireLavoriLeadButton({ id, leadRef }: { id: string; leadRef: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retire() {
    const motivo = window.prompt(`Retirar en lavori el encargo de ${leadRef} (sin avisar a nadie). Motivo:`);
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      window.alert("Escribe un motivo de al menos 3 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/lavori/price-requests/${encodeURIComponent(id)}/retire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim(), duplicado: /duplica/i.test(motivo) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        window.alert(data?.error || "No se pudo retirar.");
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
      onClick={retire}
      title="Retira el encargo en lavori y cierra la solicitud en tj.net"
      className="rounded-lg border border-rose-500/50 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
    >
      {busy ? "…" : "Retirar en lavori"}
    </button>
  );
}
