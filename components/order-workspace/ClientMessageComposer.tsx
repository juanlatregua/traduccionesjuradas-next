"use client";

// components/order-workspace/ClientMessageComposer.tsx
//
// Compositor del mensaje al cliente DESDE la landing: el staff ve el mensaje,
// lo edita y lo envía — por email (POST /notify-custom, adjunta traducciones +
// factura) o abriendo WhatsApp con el texto ya escrito. Todo sin salir.

import { useState } from "react";

export default function ClientMessageComposer({
  reference,
  clientEmail,
  clientPhoneDigits,
  defaultSubject,
  defaultMessage,
}: {
  reference: string;
  clientEmail: string;
  clientPhoneDigits: string;
  defaultSubject: string;
  defaultMessage: string;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const isWaLead = clientEmail.toLowerCase().endsWith("@whatsapp.local");
  const waHref = clientPhoneDigits
    ? `https://wa.me/${clientPhoneDigits}?text=${encodeURIComponent(body)}`
    : null;

  const sendEmail = async () => {
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/notify-custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText: body, attachFiles: true }),
      });
      const data = await res.json();
      setFeedback(
        data.ok
          ? { ok: true, text: `✓ Email enviado al cliente${data.fileCount ? ` con ${data.fileCount} adjunto(s)` : ""}.` }
          : { ok: false, text: `✗ ${data.error || "No se pudo enviar."}` }
      );
    } catch {
      setFeedback({ ok: false, text: "✗ Error de conexión." });
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

  return (
    <div className="mt-3 space-y-2 border-t border-emerald-500/20 pt-3">
      <p className="text-xs font-semibold text-emerald-300">Enviar al cliente (editable)</p>

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Asunto del email"
        className={inputCls}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        className={`${inputCls} resize-y`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendEmail}
          disabled={sending || isWaLead}
          title={isWaLead ? "Cliente sin email real (lead de WhatsApp)" : "Enviar por email con las traducciones + factura adjuntas"}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Enviando…" : "Enviar email"}
        </button>

        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Abrir WhatsApp
          </a>
        ) : (
          <span className="text-xs text-slate-500">Sin teléfono para WhatsApp.</span>
        )}
      </div>

      {isWaLead && (
        <p className="text-[11px] text-amber-300">
          Este cliente no tiene email real (@whatsapp.local) → envíalo por WhatsApp (los PDF los adjuntas tú).
        </p>
      )}
      {feedback && (
        <p className={`text-xs font-medium ${feedback.ok ? "text-emerald-300" : "text-amber-300"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
