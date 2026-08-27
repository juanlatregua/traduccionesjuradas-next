"use client";

// components/order-workspace/ClientMessageComposer.tsx
//
// Compositor ÚNICO del mensaje al cliente (fusión del antiguo ClientMessagePanel
// y el compositor de reenvío de la entrega): el staff escribe/edita el mensaje y
// lo envía por email (POST /notify-custom — adjuntos opcionales y SMS opcional)
// o abre WhatsApp con el texto ya escrito. Un endpoint, un historial.

import { useState } from "react";

export default function ClientMessageComposer({
  reference,
  clientEmail,
  clientPhoneDigits,
  defaultSubject,
  defaultMessage,
  hasDeliveryFiles = false,
}: {
  reference: string;
  clientEmail: string;
  clientPhoneDigits: string;
  defaultSubject: string;
  defaultMessage: string;
  hasDeliveryFiles?: boolean;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultMessage);
  const [attachFiles, setAttachFiles] = useState(hasDeliveryFiles);
  const [alsoSms, setAlsoSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Ajuste IA del borrador: reescribe asunto+cuerpo con el contexto del pedido.
  // Solo toca el texto en pantalla; el envío sigue siendo manual.
  const improveWithAi = async () => {
    if (!body.trim() && !aiInstruction.trim()) {
      setFeedback({ ok: false, text: "✗ Escribe un mensaje o una instrucción para la IA." });
      return;
    }
    setAiLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          instruction: aiInstruction,
          orderReference: reference,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo generar el borrador.");
      setSubject(data.draft.subject);
      setBody(data.draft.body);
      setFeedback({ ok: true, text: "✓ Borrador ajustado con IA. Revísalo antes de enviar." });
    } catch (err: any) {
      setFeedback({ ok: false, text: `✗ ${err?.message || "Error al generar el borrador."}` });
    } finally {
      setAiLoading(false);
    }
  };

  const isWaLead = clientEmail.toLowerCase().endsWith("@whatsapp.local");
  const waPhone = clientPhoneDigits
    ? clientPhoneDigits.length === 9
      ? `34${clientPhoneDigits}`
      : clientPhoneDigits
    : "";
  const waHref = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(body)}` : null;

  const sendEmail = async () => {
    if (!body.trim()) {
      setFeedback({ ok: false, text: "✗ Escribe un mensaje." });
      return;
    }
    // Caso Maider 27-ago: el email de entrega salió SIN los PDF porque la
    // traducción aún no estaba subida. Aquí solo se adjunta lo ya entregado.
    if (attachFiles && !hasDeliveryFiles) {
      setFeedback({
        ok: false,
        text: "✗ Todavía no hay traducción entregada en este pedido: súbela en «Subir y entregar la traducción» (con «Notificar al cliente» desmarcado si quieres usar este mensaje) y vuelve aquí; entonces se adjuntarán los PDF. Si de verdad quieres enviar sin adjuntos, desmarca la casilla.",
      });
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/notify-custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText: body, attachFiles, alsoSms }),
      });
      const data = await res.json();
      setFeedback(
        data.ok
          ? {
              ok: true,
              text: `✓ Enviado al cliente${data.fileCount ? ` con ${data.fileCount} adjunto(s)` : ""}${data.smsSent ? " (email + SMS)" : ""}.`,
            }
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
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        Se envía a <strong className="text-slate-200">{clientEmail || "(sin email)"}</strong>. Escribe
        lo que necesites: pedir información, avisar de la entrega, reenviar enlaces…
      </p>

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
        maxLength={4000}
        placeholder="Ej.: Necesitamos el documento original escaneado con mejor calidad, ¿podrías reenviarlo?"
        className={`${inputCls} resize-y`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={aiInstruction}
          onChange={(e) => setAiInstruction(e.target.value)}
          placeholder="Instrucción IA (opcional): ej. responde a sus dudas sobre el plazo, tono formal"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={improveWithAi}
          disabled={aiLoading}
          title="Reescribe el asunto y el cuerpo con IA usando los datos del pedido. No envía nada."
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {aiLoading ? "Generando…" : "Ajustar con IA"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={attachFiles}
            onChange={(e) => setAttachFiles(e.target.checked)}
          />
          Adjuntar traducciones + factura
          {hasDeliveryFiles ? "" : <span className="text-amber-300"> — aún no hay traducción subida: saldría SIN PDF</span>}
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={alsoSms} onChange={(e) => setAlsoSms(e.target.checked)} />
          Enviar también por SMS (si hay teléfono)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendEmail}
          disabled={sending || isWaLead}
          title={isWaLead ? "Cliente sin email real (lead de WhatsApp)" : "Enviar por email (adjuntos y SMS según casillas)"}
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
