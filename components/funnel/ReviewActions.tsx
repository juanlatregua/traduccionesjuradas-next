"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewActionsProps = {
  canProceed: boolean;
};

export default function ReviewActions({ canProceed }: ReviewActionsProps) {
  const router = useRouter();
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingProceed, setLoadingProceed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAnother = async () => {
    setLoadingAdd(true);
    setError(null);
    try {
      const res = await fetch("/api/session/add-another", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo preparar la sesión para añadir otro documento.");
      }
      router.push("/start");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo preparar la sesión.");
    } finally {
      setLoadingAdd(false);
    }
  };

  const proceedCheckout = async () => {
    setLoadingProceed(true);
    setError(null);
    try {
      const res = await fetch("/api/session/proceed-checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo avanzar al checkout.");
      }
      router.push("/checkout");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo avanzar al checkout.");
    } finally {
      setLoadingProceed(false);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={addAnother}
        disabled={loadingAdd}
        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {loadingAdd ? "Preparando..." : "Añadir otro documento"}
      </button>
      <button
        type="button"
        onClick={proceedCheckout}
        disabled={!canProceed || loadingProceed}
        className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {loadingProceed ? "Calculando..." : "Proceder al checkout"}
      </button>
      {error && <p className="w-full text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

