"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CopyField from "@/components/CopyField";
import { funnelT, type FunnelLang } from "@/lib/i18n/funnel";
import { LOCALE_INTL } from "@/lib/i18n/locales";

type CheckoutPaymentActionsProps = {
  reference: string;
  totalCents: number;
  currency: string;
  authState: "GUEST" | "AUTHENTICATED";
  lang?: FunnelLang;
};

const MANUAL = {
  beneficiary: process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_HOLDER || "HBTJ Consultores Lingüísticos S.L.",
  iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "ES66 0182 3370 67 0201616991",
  bic: process.env.NEXT_PUBLIC_TRANSFER_BIC || "BBVAESMM",
  bizum: process.env.NEXT_PUBLIC_BIZUM_IDENTIFIER || "+34 607 356 273",
  paypalLink: process.env.NEXT_PUBLIC_PAYPAL_MANUAL_LINK || "",
  paypalAccount: process.env.NEXT_PUBLIC_PAYPAL_ACCOUNT || "hola@traduccionesjuradas.net",
};

function money(cents: number, currency = "EUR", locale = "es-ES") {
  return new Intl.NumberFormat(locale, {
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
  lang = "es",
}: CheckoutPaymentActionsProps) {
  const t = funnelT[lang].pay;
  const [loadingCard, setLoadingCard] = useState(false);
  const [declaring, setDeclaring] = useState<"BIZUM" | "TRANSFER" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const amountLabel = useMemo(
    () => money(totalCents, currency, LOCALE_INTL[lang]),
    [currency, totalCents, lang]
  );

  const onCopy = (label: string) => {
    setToast(t.copied(label));
    setTimeout(() => setToast(null), 1600);
  };

  const payByCard = async () => {
    setLoadingCard(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create-intent", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || t.cardError);
      }
      window.location.assign(String(data.url));
    } catch (err: any) {
      setError(err?.message || t.cardError);
      setLoadingCard(false);
    }
  };

  // Pago fuera de banda (Bizum/transferencia): crea el pedido SIN marcarlo
  // pagado y lleva a la pantalla del pedido para subir el justificante.
  const declarePaid = async (method: "BIZUM" | "TRANSFER") => {
    setDeclaring(method);
    setError(null);
    try {
      const res = await fetch("/api/payment/declare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.payUrl) {
        throw new Error(data?.error || t.declareError);
      }
      window.location.assign(String(data.payUrl));
    } catch (err: any) {
      setError(err?.message || t.declareError);
      setDeclaring(null);
    }
  };

  return (
    <section className="rounded-3xl border border-cream bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-encre">{t.heading}</h2>
      <p className="mt-2 text-sm text-sepia">
        {t.referenceLabel}: <span className="font-mono font-semibold">{reference}</span> · {t.totalLabel}:{" "}
        <span className="font-semibold">{amountLabel}</span>
      </p>

      <div className="mt-4 rounded-xl border border-cream bg-parchment p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sepia">{t.accessLabel}</p>
        <p className="mt-1 text-sm text-sepia">
          {t.currentStatus}:{" "}
          <span className="font-semibold">
            {authState === "AUTHENTICATED" ? t.authedGoogle : t.guest}
          </span>
        </p>
        {authState !== "AUTHENTICATED" && (
          <Link
            href={`/acceso?callbackUrl=${encodeURIComponent("/checkout")}`}
            className="mt-2 inline-flex rounded-xl border border-cream px-3 py-1.5 text-xs font-semibold text-sepia hover:bg-white"
          >
            {t.continueGoogle}
          </Link>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">{t.cardTitle}</p>
        <button
          type="button"
          onClick={payByCard}
          disabled={loadingCard}
          className="mt-3 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {loadingCard ? t.redirecting : t.payByCard}
        </button>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-cream bg-parchment p-4">
        <p className="text-sm font-semibold text-encre">{t.manualTitle}</p>
        <CopyField label={t.beneficiary} value={MANUAL.beneficiary} mono={false} onCopied={onCopy} />
        <CopyField label="IBAN" value={MANUAL.iban} onCopied={onCopy} />
        <CopyField label="BIC/SWIFT" value={MANUAL.bic} onCopied={onCopy} />
        <CopyField label={t.concept} value={reference} onCopied={onCopy} />
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
        <p className="text-xs text-sepia">{t.manualNote}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => declarePaid("BIZUM")}
            disabled={declaring !== null}
            className="rounded-2xl border border-encre px-4 py-2 text-sm font-semibold text-encre hover:bg-white disabled:opacity-60"
          >
            {declaring === "BIZUM" ? t.declaring : t.declareBizum}
          </button>
          <button
            type="button"
            onClick={() => declarePaid("TRANSFER")}
            disabled={declaring !== null}
            className="rounded-2xl border border-encre px-4 py-2 text-sm font-semibold text-encre hover:bg-white disabled:opacity-60"
          >
            {declaring === "TRANSFER" ? t.declaring : t.declareTransfer}
          </button>
        </div>
      </div>

      {/* Línea de confianza en el momento del pago (audit E-E-A-T) */}
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-cream bg-parchment px-4 py-3 text-xs text-graphite">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-vert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>{t.trust}</span>
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

