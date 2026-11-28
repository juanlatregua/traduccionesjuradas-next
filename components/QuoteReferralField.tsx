"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuoteReferralField({
  token,
  prefill,
  appliedLabel,
  hasCredit,
}: {
  token: string;
  prefill?: string | null;
  appliedLabel?: string | null;
  hasCredit?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState(prefill || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (appliedLabel) {
    return <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{appliedLabel}</p>;
  }

  async function send(payload: { code?: string; action?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/public/${encodeURIComponent(token)}/referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || "No se ha podido aplicar el código.");
        return;
      }
      router.refresh();
    } catch {
      setError("Sin conexión. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-cream p-3 text-sm">
      {hasCredit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => send({ action: "credit" })}
          className="w-full rounded-lg bg-bleu px-3 py-2 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Aplicando…" : "Aplicar mi 10 % por recomendar"}
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) send({ code });
        }}
        className="space-y-1"
      >
        <label htmlFor="ref-code" className="block font-semibold text-encre">
          ¿Tienes un código?
        </label>
        <div className="flex gap-2">
          <input
            id="ref-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MARIE-7K2Q"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-cream px-2 py-1 uppercase"
            aria-describedby={error ? "ref-code-error" : undefined}
          />
          <button type="submit" disabled={busy || !code.trim()} className="rounded-lg border border-bleu px-3 py-1 font-semibold text-bleu disabled:opacity-60">
            {busy ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </form>
      {error && (
        <p id="ref-code-error" role="alert" className="text-xs text-[#A12B2B]">
          {error}
        </p>
      )}
    </div>
  );
}
