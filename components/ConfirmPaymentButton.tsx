"use client";

import { useState } from "react";

type Props = {
  reference: string;
};

export default function ConfirmPaymentButton({ reference }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(method: "BIZUM" | "TRANSFER") {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${reference}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
      } else {
        setError(data.error || "Error al confirmar.");
      }
    } catch {
      setError("Error de conexion.");
    } finally {
      setConfirming(false);
    }
  }

  if (done) {
    return <span className="text-xs font-semibold text-emerald-400">Confirmado</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => confirm("BIZUM")}
        disabled={confirming}
        className="rounded-lg bg-cyan-600 px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        Bizum
      </button>
      <button
        type="button"
        onClick={() => confirm("TRANSFER")}
        disabled={confirming}
        className="rounded-lg bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
      >
        Transf.
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
