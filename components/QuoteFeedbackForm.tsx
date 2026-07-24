"use client";

// Motivo de no conversión en la página pública del presupuesto (/q/[token]).
// El email de expirado enlaza con ?fb=MOTIVO que aquí solo PREselecciona:
// el registro real exige confirmar con el botón (POST) para que los escáneres
// de email que pre-abren enlaces no escriban motivos falsos.

import { useState } from "react";

const REASON_OPTIONS = [
  { id: "PRICE", label: "El precio" },
  { id: "DEADLINE", label: "El plazo" },
  { id: "NO_LONGER_NEEDED", label: "Ya no lo necesito" },
  { id: "SOLVED_ELSEWHERE", label: "Lo resolví con otro traductor" },
  { id: "OTHER", label: "Otro motivo" },
];

export default function QuoteFeedbackForm({
  token,
  preselect,
  alreadySent,
}: {
  token: string;
  preselect?: string | null;
  alreadySent: boolean;
}) {
  const valid = REASON_OPTIONS.some((o) => o.id === (preselect || "").toUpperCase());
  const [reason, setReason] = useState(valid ? (preselect as string).toUpperCase() : "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(alreadySent);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p className="rounded-xl border border-cream bg-cream px-3 py-2 text-sm text-bleu">
        Gracias por contárnoslo. Nos ayuda a mejorar.
      </p>
    );
  }

  async function submit() {
    if (!reason) return setError("Elige un motivo.");
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/public/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note: note.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo enviar.");
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar. Inténtalo de nuevo.");
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-sepia">
        Si ha decidido no seguir adelante, ¿nos dice el motivo? Un clic basta.
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
        placeholder="Algo más que quiera contarnos (opcional)"
        className="w-full rounded-xl border border-cream bg-card px-3 py-2 text-sm text-encre"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar motivo"}
        </button>
        {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
      </div>
    </div>
  );
}
