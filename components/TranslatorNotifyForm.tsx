"use client";

import { useState } from "react";
import { getTrackedConsultaUrl, getTrackedPaymentUrl } from "@/lib/contact";

type TranslatorNotifyFormProps = {
  reference: string;
  defaultClientEmail?: string;
  acquisitionSource?: "WHATSAPP" | "WEB";
};

export default function TranslatorNotifyForm({
  reference,
  defaultClientEmail = "",
  acquisitionSource = "WEB",
}: TranslatorNotifyFormProps) {
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const paymentUrl = getTrackedPaymentUrl(reference, "pm");
  const statusUrl = getTrackedConsultaUrl(reference, "pm");
  const startMessage = `Hola, para avanzar con tu pedido ${reference} puedes completar el pago aqui: ${paymentUrl}
Cuando lo hagas, sube el justificante en la misma pagina.`;
  const statusMessage = `Hola, puedes consultar el estado de tu pedido ${reference} aqui: ${statusUrl}`;

  async function copyText(text: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(okMessage);
    } catch {
      setCopyMessage("No se pudo copiar automaticamente. Copia manualmente el texto.");
    }
  }

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
      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          Flujo WhatsApp a web
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Canal detectado: {acquisitionSource === "WHATSAPP" ? "WhatsApp" : "Web"}.
          Usa estas plantillas para mover al cliente a pago/seguimiento con `src=wa`.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => copyText(startMessage, "Mensaje de pago copiado.")}
            className="rounded-lg border border-emerald-500/40 px-3 py-2 text-left text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Copiar mensaje de pago
          </button>
          <button
            type="button"
            onClick={() => copyText(statusMessage, "Mensaje de estado copiado.")}
            className="rounded-lg border border-cyan-500/40 px-3 py-2 text-left text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
          >
            Copiar mensaje de estado
          </button>
          <button
            type="button"
            onClick={() => copyText(paymentUrl, "Enlace de pago copiado.")}
            className="rounded-lg border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Copiar enlace pago
          </button>
          <button
            type="button"
            onClick={() => copyText(statusUrl, "Enlace de consulta copiado.")}
            className="rounded-lg border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Copiar enlace consulta
          </button>
        </div>
      </div>
      {message && <p className="mt-2 text-xs font-semibold text-slate-200">{message}</p>}
      {copyMessage && <p className="mt-2 text-xs font-semibold text-emerald-300">{copyMessage}</p>}
    </div>
  );
}
