"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FORMALIZED = ["PAID", "IN_PROGRESS", "DELIVERED"];

export default function QuoteRowActions({ id, status, deleted }: { id: string; status: string; deleted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const formalized = FORMALIZED.includes(status);

  async function act(restore: boolean) {
    if (!restore && !window.confirm("¿Mover este presupuesto a Eliminados? (podrás restaurarlo)")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        alert(d.error || "No se pudo completar la acción.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Error de red.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/quotes/${id}`}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Abrir
      </Link>
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
