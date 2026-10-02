"use client";

import { useState } from "react";
import { publicDict, type PublicLang } from "@/lib/quote-public-i18n";

export default function QuoteBalancePayButton({ token, amountLabel, lang = "es" }: { token: string; amountLabel: string; lang?: PublicLang }) {
  const t = publicDict(lang);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/public/${token}/checkout?plazo=resto`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) throw new Error(data?.error || t.errPay);
      window.location.href = data.url;
    } catch (err: any) {
      setMessage(err?.message || t.errPay);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pay}
        disabled={loading}
        className="w-full rounded-lg bg-bleu px-4 py-3 text-sm font-semibold text-white hover:bg-bleu/90 disabled:opacity-60"
      >
        {loading ? t.balanceOpening : `${t.balancePayPre} ${amountLabel} ${t.balancePaySuf}`}
      </button>
      {message && <p className="text-xs text-red-700">{message}</p>}
    </div>
  );
}
