"use client";

import { useEffect, useRef, useState } from "react";
import CopyField from "@/components/CopyField";
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
  const firstTab: PayTab = bizums.length ? "bizum" : banks.length ? "transferencia" : "tarjeta";
  const [tab, setTab] = useState<PayTab>(autoStartCard ? "tarjeta" : firstTab);
  const autoStarted = useRef(false);
  const [loading, setLoading] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  // "Ya he transferido": crea la cáscara del pedido SIN cobro y lleva a su
  // pantalla de pago, que es la que tiene el formulario de subida del
  // justificante. El justificante no cobra nada: lo valida el staff a mano.
  async function declareTransfer() {
    setDeclaring(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/public/${token}/declare-transfer`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || t.errContinue);
      }
      window.location.href = data.url;
    } catch (err: any) {
      setMessage(err?.message || t.errContinue);
      setDeclaring(false);
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
      <p className="text-xs text-sepia">
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
          {bizums.map((b) => (
            <CopyField key={b.key} label="Bizum" value={b.account.kind === "bizum" ? b.account.phone : ""} onCopied={onCopy} />
          ))}
          <CopyField label={t.concept} value={quoteNumber} onCopied={onCopy} />
          <p className="text-[11px] text-graphite">
            {t.conceptHint}
          </p>
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
                {banks.length > 1 && <p className="text-[11px] font-semibold text-graphite">{b.account.bank}</p>}
                <CopyField label={t.beneficiary} value={b.account.holder} mono={false} onCopied={onCopy} />
                <CopyField label={t.iban} value={b.account.iban} onCopied={onCopy} />
                <CopyField label={t.bic} value={b.account.bic} onCopied={onCopy} />
                {b.account.holderAddress && (
                  <CopyField label={t.beneficiaryAddress} value={b.account.holderAddress} mono={false} onCopied={onCopy} />
                )}
                {b.account.bankAddress && (
                  <CopyField label={t.bankAddress} value={b.account.bankAddress} mono={false} onCopied={onCopy} />
                )}
              </div>
            ) : null
          )}
          <CopyField label={t.concept} value={quoteNumber} onCopied={onCopy} />
          <p className="text-[11px] text-graphite">
            {t.conceptHint}
          </p>
          <p className="text-[11px] text-graphite">
            {t.sepaNote}
          </p>
          <div className="mt-3 rounded-xl border border-bleu/20 bg-bleu/5 p-3">
            <p className="text-xs font-semibold text-encre">{t.alreadyTransferred}</p>
            <p className="mt-1 text-[11px] text-graphite">
              {t.alreadyTransferredHelp}
            </p>
            <button
              type="button"
              onClick={declareTransfer}
              disabled={declaring}
              className="mt-2 w-full rounded-xl bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {declaring ? t.oneMoment : t.alreadyTransferredCta}
            </button>
          </div>
          {message && <p className="text-xs font-semibold text-red-700">{message}</p>}
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
            {loading ? t.redirecting : `${t.payCard} ${totalLabel}`}
          </button>
          <p className="text-[11px] text-graphite">
            {t.cardNote}
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
