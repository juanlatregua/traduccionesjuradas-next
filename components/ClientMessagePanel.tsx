"use client";

import { useState } from "react";

// Mensaje libre del staff al cliente del pedido (p.ej. pedir info del documento).
// Email siempre; SMS opcional. El idioma (es/fr) lo decide el servidor por clientLocale.
export default function ClientMessagePanel({
  reference,
  clientEmail,
}: {
  reference: string;
  clientEmail: string | null;
}) {
  const [message, setMessage] = useState("");
  const [alsoSms, setAlsoSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setMsg(null);
    setErr(null);
    if (!message.trim()) {
      setErr("Escribe un mensaje.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${reference}/send-client-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), alsoSms }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "No se pudo enviar.");
        return;
      }
      setMsg(data.smsSent ? "Mensaje enviado por email y SMS." : "Mensaje enviado por email.");
      setMessage("");
      setAlsoSms(false);
    } catch {
      setErr("Error de conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Mensaje al cliente</p>
        <p className="mt-1 text-xs text-slate-400">
          Pídele información sobre el documento o cualquier aclaración. Se envía a{" "}
          <strong className="text-slate-200">{clientEmail || "(sin email)"}</strong> en su idioma.
        </p>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Ej.: Necesitamos el documento original escaneado con mejor calidad, ¿podrías reenviarlo? ¿En qué idioma necesitas la traducción?"
        className="block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
      />

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={alsoSms} onChange={(e) => setAlsoSms(e.target.checked)} />
        Enviar también por SMS (si hay teléfono)
      </label>

      {err && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {msg}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={busy || !clientEmail}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? "Enviando..." : "Enviar mensaje al cliente"}
      </button>
    </div>
  );
}
