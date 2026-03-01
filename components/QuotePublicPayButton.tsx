"use client";

import { useState } from "react";
import CopyField from "@/components/CopyField";

type Props = {
  token: string;
  isPayable: boolean;
  quoteNumber: string;
  totalLabel: string;
};

type PayTab = "bizum" | "transferencia" | "tarjeta";

const MANUAL_PAYMENT = {
  bizumPhone: process.env.NEXT_PUBLIC_BIZUM_IDENTIFIER || "+34 607 356 273",
  accountHolder: process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_HOLDER || "HBTJ Consultores Lingüísticos S.L.",
  iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "ES66 0182 3370 67 0201616991",
  bic: process.env.NEXT_PUBLIC_TRANSFER_BIC || "BBVAESMM",
};

export default function QuotePublicPayButton({ token, isPayable, quoteNumber, totalLabel }: Props) {
  const [tab, setTab] = useState<PayTab>("bizum");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const onCopy = (label: string) => {
    setToast(`Copiado: ${label}`);
    setTimeout(() => setToast(null), 1600);
  };

  async function startCardCheckout() {
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

  if (!isPayable) {
    return (
      <p className="text-xs text-sepia">
        Este presupuesto no admite pago en su estado actual.
      </p>
    );
  }

  const tabs: { key: PayTab; label: string }[] = [
    { key: "bizum", label: "Bizum" },
    { key: "transferencia", label: "Transferencia" },
    { key: "tarjeta", label: "Tarjeta" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Forma de pago</p>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-cream bg-parchment p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
              tab === t.key
                ? "bg-bleu text-white shadow-sm"
                : "text-sepia hover:bg-card"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bizum */}
      {tab === "bizum" && (
        <div className="space-y-2">
          <p className="text-xs text-sepia">
            Envía un Bizum por <strong>{totalLabel}</strong> con estos datos:
          </p>
          <CopyField label="Bizum" value={MANUAL_PAYMENT.bizumPhone} onCopied={onCopy} />
          <CopyField label="Concepto" value={quoteNumber} onCopied={onCopy} />
          <p className="text-[11px] text-graphite">
            Indica el número de presupuesto en el concepto. Se confirma en menos de 24 h laborables.
          </p>
        </div>
      )}

      {/* Transferencia */}
      {tab === "transferencia" && (
        <div className="space-y-2">
          <p className="text-xs text-sepia">
            Realiza una transferencia por <strong>{totalLabel}</strong>:
          </p>
          <CopyField label="Beneficiario" value={MANUAL_PAYMENT.accountHolder} mono={false} onCopied={onCopy} />
          <CopyField label="IBAN" value={MANUAL_PAYMENT.iban} onCopied={onCopy} />
          <CopyField label="BIC/SWIFT" value={MANUAL_PAYMENT.bic} onCopied={onCopy} />
          <CopyField label="Concepto" value={quoteNumber} onCopied={onCopy} />
          <p className="text-[11px] text-graphite">
            Indica el número de presupuesto en el concepto. Se confirma en menos de 24 h laborables.
          </p>
        </div>
      )}

      {/* Tarjeta */}
      {tab === "tarjeta" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={startCardCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Redirigiendo..." : `Pagar ${totalLabel} con tarjeta`}
          </button>
          <p className="text-[11px] text-graphite">
            Pago seguro con tarjeta de crédito o débito (según disponibilidad).
          </p>
          {message && <p className="text-xs font-semibold text-red-700">{message}</p>}
        </div>
      )}

      {toast && (
        <p className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-encre px-3 py-1 text-xs font-semibold text-white">
          {toast}
        </p>
      )}
    </div>
  );
}
