"use client";

import { useState } from "react";

type Props = {
  token: string;
  isPayable: boolean;
};

export default function QuotePublicPayButton({ token, isPayable }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/public/${token}/checkout`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo iniciar el pago.");
      }
      window.location.href = data.url;
    } catch (err: any) {
      setMessage(err?.message || "No se pudo iniciar el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={!isPayable || loading}
        className="w-full rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirigiendo..." : "Pagar"}
      </button>
      <p className="text-xs text-sepia">
        Formas de pago: <strong>Tarjeta</strong> (según disponibilidad) · PayPal/Bizum (próximamente).
      </p>
      {message && <p className="text-xs font-semibold text-red-700">{message}</p>}
    </div>
  );
}
