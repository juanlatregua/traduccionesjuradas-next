"use client";

// Motivo de no conversión en la página pública del presupuesto (/q/[token]).
// El email de expirado enlaza con ?fb=MOTIVO que aquí solo PREselecciona:
// el registro real exige confirmar con el botón (POST) para que los escáneres
// de email que pre-abren enlaces no escriban motivos falsos.

import { useState } from "react";
import { publicDict, type PublicLang } from "@/lib/quote-public-i18n";

const REASON_IDS = ["PRICE", "DEADLINE", "NO_LONGER_NEEDED", "SOLVED_ELSEWHERE", "OTHER"];

export default function QuoteFeedbackForm({
  token,
  preselect,
  alreadySent,
  lang = "es",
}: {
  token: string;
  preselect?: string | null;
  alreadySent: boolean;
  lang?: PublicLang;
}) {
  const t = publicDict(lang);
  const REASON_OPTIONS = [
    { id: "PRICE", label: t.fbPrice },
    { id: "DEADLINE", label: t.fbDeadline },
    { id: "NO_LONGER_NEEDED", label: t.fbNoNeed },
    { id: "SOLVED_ELSEWHERE", label: t.fbElsewhere },
    { id: "OTHER", label: t.fbOther },
  ];
  const valid = REASON_IDS.some((id) => id === (preselect || "").toUpperCase());
  const [reason, setReason] = useState(valid ? (preselect as string).toUpperCase() : "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(alreadySent);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p className="rounded-xl border border-cream bg-cream px-3 py-2 text-sm text-bleu">
        {t.fbThanks}
      </p>
    );
  }

  async function submit() {
    if (!reason) return setError(t.fbPickReason);
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/public/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note: note.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || t.fbErrSend);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || t.fbErrRetry);
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-sepia">
        {t.fbPrompt}
      </p>
      <div className="flex flex-wrap gap-2">
        {REASON_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setReason(o.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              reason === o.id
                ? "border-bleu bg-bleu text-white"
                : "border-cream bg-card text-sepia hover:bg-cream"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={t.fbNote}
        className="w-full rounded-xl border border-cream bg-card px-3 py-2 text-sm text-encre"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? t.fbSending : t.fbSend}
        </button>
        {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
      </div>
    </div>
  );
}
