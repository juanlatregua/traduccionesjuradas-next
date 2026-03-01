"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CopyField from "@/components/CopyField";

type CheckoutPaymentActionsProps = {
  reference: string;
  totalCents: number;
  currency: string;
  authState: "GUEST" | "AUTHENTICATED";
};

const MANUAL = {
  beneficiary: process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_HOLDER || "HBTJ Consultores Lingüísticos S.L.",
  iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "ES66 0182 3370 67 0201616991",
  bic: process.env.NEXT_PUBLIC_TRANSFER_BIC || "BBVAESMM",
  bizum: process.env.NEXT_PUBLIC_BIZUM_IDENTIFIER || "+34 607 356 273",
  paypalLink: process.env.NEXT_PUBLIC_PAYPAL_MANUAL_LINK || "",
  paypalAccount: process.env.NEXT_PUBLIC_PAYPAL_ACCOUNT || "hola@traduccionesjuradas.net",
};

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export default function CheckoutPaymentActions({
  reference,
  totalCents,
  currency,
  authState,
}: CheckoutPaymentActionsProps) {
  const [loadingCard, setLoadingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const amountLabel = useMemo(() => money(totalCents, currency), [currency, totalCents]);

  const onCopy = (label: string) => {
    setToast(`Copiado: ${label}`);
    setTimeout(() => setToast(null), 1600);
  };

  const payByCard = async () => {
    setLoadingCard(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create-intent", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo iniciar pago con tarjeta.");
      }
      window.location.assign(String(data.url));
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar pago con tarjeta.");
      setLoadingCard(false);
    }
  };

  return (
    <section className="rounded-3xl border border-cream bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-encre">Paso 4. Pago</h2>
      <p className="mt-2 text-sm text-sepia">
        Referencia: <span className="font-mono font-semibold">{reference}</span> · Total:{" "}
        <span className="font-semibold">{amountLabel}</span>
      </p>

      <div className="mt-4 rounded-xl border border-cream bg-parchment p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sepia">Acceso</p>
        <p className="mt-1 text-sm text-sepia">
          Estado actual:{" "}
          <span className="font-semibold">
            {authState === "AUTHENTICATED" ? "Autenticado con Google" : "Invitado"}
          </span>
        </p>
        {authState !== "AUTHENTICATED" && (
          <Link
            href={`/acceso?callbackUrl=${encodeURIComponent("/checkout")}`}
            className="mt-2 inline-flex rounded-xl border border-cream px-3 py-1.5 text-xs font-semibold text-sepia hover:bg-white"
          >
            Continuar con Google
          </Link>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">Tarjeta de crédito o débito</p>
        <button
          type="button"
          onClick={payByCard}
          disabled={loadingCard}
          className="mt-3 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {loadingCard ? "Redirigiendo..." : "Pagar con tarjeta"}
        </button>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-cream bg-parchment p-4">
        <p className="text-sm font-semibold text-encre">Transferencia, Bizum o PayPal</p>
        <CopyField label="Beneficiario" value={MANUAL.beneficiary} mono={false} onCopied={onCopy} />
        <CopyField label="IBAN" value={MANUAL.iban} onCopied={onCopy} />
        <CopyField label="BIC/SWIFT" value={MANUAL.bic} onCopied={onCopy} />
        <CopyField label="Concepto" value={reference} onCopied={onCopy} />
        <CopyField label="Bizum" value={MANUAL.bizum} onCopied={onCopy} />
        {MANUAL.paypalLink ? (
          <CopyField
            label="PayPal link"
            value={MANUAL.paypalLink}
            copyValue={MANUAL.paypalLink}
            actionLabel="Abrir"
            actionHref={MANUAL.paypalLink}
            onCopied={onCopy}
          />
        ) : (
          <CopyField label="PayPal cuenta" value={MANUAL.paypalAccount} onCopied={onCopy} />
        )}
        <p className="text-xs text-sepia">
          Los métodos manuales no marcan pago automático inmediato. Se revisan y se notifican en el área cliente.
        </p>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {toast && (
        <p className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-encre px-3 py-1 text-xs font-semibold text-white">
          {toast}
        </p>
      )}
    </section>
  );
}

