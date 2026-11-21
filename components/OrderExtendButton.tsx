"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Ampliar el pedido" (Juan, 3-sep-2026): el cliente añadió un documento después
// de pagar. Un clic prepara el presupuesto HERMANO con esos documentos y abre el
// constructor; al pagarlo, el pedido nuevo se agrupa solo en el mismo trámite.
export default function OrderExtendButton({
  reference,
  docsAfterPayment,
  compact = false,
}: {
  reference: string;
  docsAfterPayment: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extend() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/extend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo preparar la ampliación.");
      router.push(data.builderUrl);
    } catch (err: any) {
      setError(err?.message || "No se pudo preparar la ampliación.");
      setBusy(false);
    }
  }

  const label = docsAfterPayment > 0 ? `Ampliar el pedido (${docsAfterPayment} doc. tras el pago)` : "Ampliar el pedido";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={extend}
        disabled={busy}
        title="Presupuesto hermano con los documentos llegados después del pago; al pagarlo se agrupa en el mismo trámite"
        className={
          compact
            ? "rounded-lg border border-[#E9D8A6] bg-[#FFF8E6] px-2 py-1 text-xs font-semibold text-[#7A5A10] hover:bg-[#FFF8E6] disabled:opacity-50"
            : "rounded-lg border border-[#E9D8A6] bg-[#FFF8E6] px-3 py-1.5 text-sm font-semibold text-[#7A5A10] hover:bg-[#FFF8E6] disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        {busy ? "Preparando…" : `➕ ${label}`}
      </button>
      {error && <span className="text-xs text-[#A12B2B]">{error}</span>}
    </span>
  );
}
