"use client";

import { useState } from "react";
import { getTrackedConsultaUrl, getTrackedPaymentUrl } from "@/lib/contact";
import { buildNotificationTemplate } from "@/lib/notification-templates";
import CopyField from "./CopyField";

type TranslatorNotifyFormProps = {
  reference: string;
  defaultClientEmail?: string;
  acquisitionSource?: "WHATSAPP" | "WEB";
  defaultDownloadUrl?: string;
  quotePreviewUrl?: string;
  paymentLink?: string;
  statusLink?: string;
  deliveryNotifiedAt?: string | null;
  deliveryNotifiedTo?: string | null;
  canonicalStage?: string;
};

export default function TranslatorNotifyForm({
  reference,
  defaultClientEmail = "",
  acquisitionSource = "WEB",
  defaultDownloadUrl = "",
  quotePreviewUrl = "",
  paymentLink,
  statusLink,
  deliveryNotifiedAt = null,
  deliveryNotifiedTo = null,
  canonicalStage,
}: TranslatorNotifyFormProps) {
  const [clientEmail, setClientEmail] = useState(defaultClientEmail);
  const [downloadUrl, setDownloadUrl] = useState(defaultDownloadUrl);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const paymentUrl = paymentLink || getTrackedPaymentUrl(reference, "pm");
  const statusUrl = statusLink || getTrackedConsultaUrl(reference, "pm");
  const startMessage = buildNotificationTemplate({
    key: "wa_payment_request",
    reference,
    paymentUrl,
    statusUrl,
    downloadUrl: downloadUrl || undefined,
  });
  const statusMessage = buildNotificationTemplate({
    key: "wa_status_update",
    reference,
    paymentUrl,
    statusUrl,
  });
  const deliveryReadyText = buildNotificationTemplate({
    key: "wa_delivery_ready",
    reference,
    paymentUrl,
    statusUrl,
    downloadUrl: downloadUrl || undefined,
  });
  const emailStatusMessage = buildNotificationTemplate({
    key: "email_status_update",
    reference,
    paymentUrl,
    statusUrl,
  });
  const emailPaymentMessage = buildNotificationTemplate({
    key: "email_payment_request",
    reference,
    paymentUrl,
    statusUrl,
  });

  const reviewUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ || "";
  const showReviewButtons = (canonicalStage === "DELIVERED" || canonicalStage === "CLOSED") && reviewUrl;
  const waReviewMessage = buildNotificationTemplate({
    key: "wa_review_request",
    reference,
    paymentUrl,
    statusUrl,
    reviewUrl,
  });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  async function copyText(text: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(okMessage);
    } catch {
      setCopyMessage("No se pudo copiar automaticamente. Copia manualmente el texto.");
    }
  }

  const submitReviewRequest = async () => {
    setReviewLoading(true);
    setReviewMessage(null);
    try {
      const res = await fetch(`/api/orders/${reference}/review-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo enviar.");
      }
      setReviewMessage("Solicitud de resena enviada al cliente.");
    } catch (err: any) {
      setReviewMessage(err?.message || "Error enviando solicitud de resena.");
    } finally {
      setReviewLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/traductor/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          clientEmail,
          downloadUrl,
          templateKey: "email_delivery_ready",
        }),
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
        Notificar traduccion lista (copy-first)
      </p>
      <div className="mt-3 space-y-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <CopyField label="Enlace pago" value={paymentUrl} onCopied={() => setCopyMessage("Enlace de pago copiado.")} />
        <CopyField label="Enlace consulta" value={statusUrl} onCopied={() => setCopyMessage("Enlace de consulta copiado.")} />
        {quotePreviewUrl ? (
          <CopyField
            label="Preview presupuesto"
            value={quotePreviewUrl}
            actionLabel="Abrir"
            actionHref={quotePreviewUrl}
            onCopied={() => setCopyMessage("Preview de presupuesto copiada.")}
          />
        ) : null}
        {downloadUrl ? (
          <CopyField
            label="Enlace descarga"
            value={downloadUrl}
            actionLabel="Abrir"
            actionHref={downloadUrl}
            onCopied={() => setCopyMessage("Enlace de descarga copiado.")}
          />
        ) : (
          <p className="text-[11px] text-amber-300">
            Aun no hay enlace de descarga final. Sube la traduccion en pestaña Entrega para habilitarlo.
          </p>
        )}
      </div>
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
      {deliveryNotifiedAt && (
        <p className="mt-2 text-[11px] text-emerald-300">
          Ultima notificacion de entrega: {new Date(deliveryNotifiedAt).toLocaleString("es-ES")}
          {deliveryNotifiedTo ? ` · ${deliveryNotifiedTo}` : ""}
        </p>
      )}
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
          Plantillas registradas
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
            onClick={() => copyText(deliveryReadyText, "Mensaje de traduccion lista copiado.")}
            className="rounded-lg border border-violet-500/40 px-3 py-2 text-left text-xs font-semibold text-violet-300 hover:bg-violet-500/10"
            disabled={!downloadUrl}
          >
            Copiar mensaje traduccion lista
          </button>
          <button
            type="button"
            onClick={() => copyText(emailPaymentMessage, "Texto email pago copiado.")}
            className="rounded-lg border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Copiar email pago
          </button>
          <button
            type="button"
            onClick={() => copyText(emailStatusMessage, "Texto email estado copiado.")}
            className="rounded-lg border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Copiar email estado
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
          <button
            type="button"
            onClick={() => copyText(downloadUrl, "Enlace de descarga copiado.")}
            className="rounded-lg border border-slate-600 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            disabled={!downloadUrl}
          >
            Copiar enlace descarga
          </button>
        </div>
      </div>
      {showReviewButtons && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Solicitud de resena Google
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Solo visible en pedidos entregados o cerrados.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => copyText(waReviewMessage, "Mensaje de resena copiado.")}
              className="rounded-lg border border-amber-500/40 px-3 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-amber-500/10"
            >
              Copiar mensaje resena
            </button>
            <button
              type="button"
              onClick={submitReviewRequest}
              disabled={reviewLoading}
              className="rounded-lg bg-amber-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {reviewLoading ? "Enviando..." : "Enviar solicitud resena"}
            </button>
          </div>
          {reviewMessage && <p className="mt-2 text-xs font-semibold text-slate-200">{reviewMessage}</p>}
        </div>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-slate-200">{message}</p>}
      {copyMessage && <p className="mt-2 text-xs font-semibold text-emerald-300">{copyMessage}</p>}
    </div>
  );
}
