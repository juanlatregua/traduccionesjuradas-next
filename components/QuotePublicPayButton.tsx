"use client";

import { useEffect, useRef, useState } from "react";
import CopyField from "@/components/CopyField";
import QuoteProofCta from "@/components/QuoteProofCta";
import { resolvePaymentAccounts } from "@/lib/payment-labels";
import { publicDict, type PublicLang } from "@/lib/quote-public-i18n";

type Props = {
  token: string;
  isPayable: boolean;
  quoteNumber: string;
  totalLabel: string;
  // ?pago=tarjeta en el enlace del mensaje: abre la pestaña Tarjeta y lanza el
  // checkout de Stripe al cargar. Va por JS a propósito: los previews de
  // WhatsApp/email no ejecutan JS, así que no crean sesiones ni flipan estados.
  autoStartCard?: boolean;
  // Métodos elegidos en el presupuesto (Quote.paymentMethods): la web enseña lo
  // mismo que el PDF y el mensaje. Antes salía BBVA/607 fijo por constantes.
  paymentMethods?: string[] | null;
  /** Idioma del cliente (Quote.pdfLang). Por defecto español. */
  lang?: PublicLang;
};

type PayTab = "bizum" | "transferencia" | "tarjeta";


export default function QuotePublicPayButton({ token, isPayable, quoteNumber, totalLabel, autoStartCard, paymentMethods, lang = "es" }: Props) {
  const t = publicDict(lang);
  const accounts = resolvePaymentAccounts(paymentMethods);
  const bizums = accounts.filter((a) => a.account.kind === "bizum");
  const banks = accounts.filter((a) => a.account.kind === "transfer");
  const [tab, setTab] = useState<PayTab>("tarjeta");
  const autoStarted = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const copyProps = { copyLabel: t.copyBtn, copyingLabel: t.copyingBtn, errorLabel: t.copyFail };
  const onCopy = (label: string) => {
    setToast(`${t.copied}: ${label}`);
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
        throw new Error(data?.error || t.errPay);
      }
      window.location.href = data.url;
    } catch (err: any) {
      setMessage(err?.message || t.errPay);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoStartCard || !isPayable || autoStarted.current) return;
    autoStarted.current = true;
    void startCardCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartCard, isPayable]);

  if (!isPayable) {
    return (
      <p className="text-sm text-sepia">
        {t.notPayable}
      </p>
    );
  }

  const tabs: { key: PayTab; label: string }[] = [
    ...(bizums.length ? [{ key: "bizum" as const, label: t.tabBizum }] : []),
    ...(banks.length ? [{ key: "transferencia" as const, label: t.tabTransfer }] : []),
    { key: "tarjeta", label: t.tabCard },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">{t.payHow}</p>

      {/* Tabs */}
      <div role="tablist" aria-label={t.payHow} className="flex gap-1 rounded-xl border border-cream bg-parchment p-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            id={`paytab-${tb.key}`}
            aria-selected={tab === tb.key}
            aria-controls="paypanel"
            onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-lg px-2 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu ${
              tab === tb.key
                ? "bg-bleu text-white shadow-sm"
                : "text-sepia hover:bg-card"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div id="paypanel" role="tabpanel" aria-labelledby={`paytab-${tab}`} className="space-y-3">
      {/* Bizum */}
      {tab === "bizum" && (
        <div className="space-y-2">
          <p className="text-xs text-sepia">
            {t.bizumSendPre} <strong>{totalLabel}</strong> {t.bizumSendPost}
          </p>
          {bizums.map((b) => (
            <CopyField key={b.key} label="Bizum" value={b.account.kind === "bizum" ? b.account.phone : ""} onCopied={onCopy} {...copyProps} />
          ))}
          <CopyField label={t.concept} value={quoteNumber} onCopied={onCopy} {...copyProps} />
          <p className="text-xs text-graphite">
            {t.conceptHint}
          </p>
          <QuoteProofCta token={token} lang={lang} variant="button" />
        </div>
      )}

      {/* Transferencia */}
      {tab === "transferencia" && (
        <div className="space-y-2">
          <p className="text-xs text-sepia">
            {t.transferDo} <strong>{totalLabel}</strong>:
          </p>
          {banks.map((b) =>
            b.account.kind === "transfer" ? (
              <div key={b.key} className="space-y-2">
                {banks.length > 1 && <p className="text-xs font-semibold text-graphite">{b.account.bank}</p>}
                <CopyField label={t.beneficiary} value={b.account.holder} mono={false} onCopied={onCopy} {...copyProps} />
                <CopyField label={t.iban} value={b.account.iban} onCopied={onCopy} {...copyProps} />
                <CopyField label={t.bic} value={b.account.bic} onCopied={onCopy} {...copyProps} />
                {b.account.holderAddress && (
                  <CopyField label={t.beneficiaryAddress} value={b.account.holderAddress} mono={false} onCopied={onCopy} {...copyProps} />
                )}
                {b.account.bankAddress && (
                  <CopyField label={t.bankAddress} value={b.account.bankAddress} mono={false} onCopied={onCopy} {...copyProps} />
                )}
              </div>
            ) : null
          )}
          <CopyField label={t.concept} value={quoteNumber} onCopied={onCopy} {...copyProps} />
          <p className="text-xs text-graphite">
            {t.conceptHint}
          </p>
          <p className="text-xs text-graphite">
            {t.sepaNote}
          </p>
          <QuoteProofCta token={token} lang={lang} variant="button" />
        </div>
      )}

      {/* Tarjeta */}
      {tab === "tarjeta" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={startCardCheckout}
            disabled={loading}
            aria-describedby={message ? "pay-err" : undefined}
            className="min-h-[44px] w-full rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.redirecting : `${t.payCard} ${totalLabel}`}
          </button>
          <p className="text-xs text-graphite">
            {t.cardNote}
          </p>
          {message && <p id="pay-err" role="alert" className="text-xs font-semibold text-red-700">{message}</p>}
        </div>
      )}

      </div>

      <div role="status" aria-live="polite">
        {toast && (
          <p className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-encre px-4 py-2 text-sm font-semibold text-white">
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
