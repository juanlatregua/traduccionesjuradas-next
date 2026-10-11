"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CasoVeredicto({ eventoId, actual }: { eventoId: string; actual: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function votar(veredicto: "resolver" | "guarda") {
    setBusy(true);
    try {
      const res = await fetch("/api/casos/veredicto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, veredicto }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) alert(d.error || "No se pudo guardar el veredicto.");
      else router.refresh();
    } catch {
      alert("Error de red.");
    }
    setBusy(false);
  }

  const btn = (v: "resolver" | "guarda", label: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => votar(v)}
      className={`rounded border px-2 py-0.5 text-[11px] ${actual === v ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
    >
      {label}
    </button>
  );
  return (
    <span className="flex flex-wrap gap-1">
      {btn("resolver", "El resolver acertó")}
      {btn("guarda", "La guarda acertó")}
    </span>
  );
}
