"use client";

import { useState } from "react";

type TranslatorNotifyFormProps = {
  reference: string;
  defaultClientEmail?: string;
};

export default function TranslatorNotifyForm({
  reference,
  defaultClientEmail = "",
}: TranslatorNotifyFormProps) {
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/traductor/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, clientEmail, downloadUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo enviar.");
      }
      setMessage("Notificacion enviada al cliente.");
    } catch (err: any) {
      setMessage(err?.message || "Error enviando notificacion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
        Notificar traduccion lista
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="Email del cliente"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="url"
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
          placeholder="URL de descarga del PDF"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar aviso al cliente"}
      </button>
      {message && <p className="mt-2 text-xs font-semibold text-slate-200">{message}</p>}
    </div>
  );
}
