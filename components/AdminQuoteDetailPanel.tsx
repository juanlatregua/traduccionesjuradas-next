"use client";

import { useMemo, useState } from "react";

type QuoteLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  supplierUnitCost?: number | null;
  lineTotal: number;
  sourceFileUrl?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};

// Enlace al documento de una línea (extrae su rango de páginas como PDF).
function lineDocUrl(line: QuoteLine, download = false): string | null {
  if (!line.sourceFileUrl) return null;
  const p = new URLSearchParams({ url: line.sourceFileUrl });
  if (line.pageStart) p.set("start", String(line.pageStart));
  if (line.pageEnd) p.set("end", String(line.pageEnd));
  p.set("name", line.description.slice(0, 60));
  if (download) p.set("download", "1");
  return `/api/documents/extract-pages?${p.toString()}`;
}

type QuoteData = {
  id: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  sourceLang: string;
  targetLang: string;
  deliveryType: "DIGITAL_PDF" | "PAPER_SHIP";
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  vatAmount: number;
  total: number;
  validUntil: string;
  sentAt?: string | null;
  paidAt?: string | null;
  deliveredAt?: string | null;
  publicToken: string;
  pdfUrl?: string | null;
  marginPct?: number | null;
  lines: QuoteLine[];
  messageLogs?: Array<{
    id: string;
    channel: string;
    type: string;
    recipient: string;
    subject?: string | null;
    status: string;
    sentAt?: string | null;
    createdAt: string;
  }>;
};

type Props = {
  initialQuote: QuoteData;
};

function formatMoney(value: number) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Borrador",
    SENT: "Enviado",
    OPENED: "Abierto",
    ACCEPTED: "Aceptado",
    PAID: "Pagado",
    IN_PROGRESS: "En progreso",
    DELIVERED: "Entregado",
    EXPIRED: "Expirado",
  };
  return map[status] || status;
}

export default function AdminQuoteDetailPanel({ initialQuote }: Props) {
  const [quote, setQuote] = useState(initialQuote);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [loadingDeliver, setLoadingDeliver] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [loadingPaid, setLoadingPaid] = useState(false);
  const [payMethod, setPayMethod] = useState<"BIZUM" | "STRIPE" | "TRANSFER">("BIZUM");
  const [message, setMessage] = useState<string | null>(null);
  const [whatsText, setWhatsText] = useState<string>("");
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string; body: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const payUrl = useMemo(() => {
    const baseUrl = (typeof window !== "undefined" && window.location.origin) || "https://www.traduccionesjuradas.net";
    return `${baseUrl}/q/${quote.publicToken}`;
  }, [quote.publicToken]);

  // Mensaje para el cliente según método de pago (WhatsApp). Bizum por defecto.
  const waMsg = useMemo(() => {
    const greet = `Hola ${quote.customerName || ""},`.replace(/ ,$/, ",");
    const concept = `${greet} tu presupuesto ${quote.quoteNumber} de traducción jurada: ${formatMoney(quote.total)} (IVA incl.).`;
    if (payMethod === "BIZUM") {
      return `${concept} Puedes pagarlo por Bizum al 607 356 273 (TraduccionesJuradas). Avísame cuando lo hagas y empiezo. ¡Gracias!`;
    }
    if (payMethod === "TRANSFER") {
      return `${concept} Por transferencia: IBAN ES66 0182 3370 67 0201616991 (BBVA), titular HBTJ Consultores Lingüísticos S.L. Avísame cuando la hagas. ¡Gracias!`;
    }
    return `${concept} Paga con tarjeta de forma segura aquí: ${payUrl}`;
  }, [payMethod, quote.customerName, quote.quoteNumber, quote.total, payUrl]);

  async function reloadQuote() {
    const res = await fetch(`/api/quotes/${quote.id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok && data?.ok && data.quote) {
      setQuote(data.quote);
    }
  }

  async function handlePreviewEmail() {
    setLoadingPreview(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/email-preview?template=PAY_LINK`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo cargar preview de email.");
      setEmailPreview(data.preview);
    } catch (err: any) {
      setMessage(err?.message || "No se pudo cargar preview de email.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleFinalizeSend(skipEmail = false) {
    setLoadingSend(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/finalize-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo generar el presupuesto.");
      setWhatsText(String(data.whatsappText || ""));
      setMessage(
        data.emailSent
          ? "Presupuesto generado y enviado por email al cliente."
          : "Presupuesto generado. Descarga el PDF y copia el texto de WhatsApp para enviárselo tú."
      );
      await reloadQuote();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo generar el presupuesto.");
    } finally {
      setLoadingSend(false);
    }
  }

  function downloadPdf() {
    window.open(quote.pdfUrl || `/api/quotes/${quote.id}/preview-pdf`, "_blank");
  }

  async function handleResend() {
    setLoadingResend(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/resend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo reenviar.");
      setWhatsText(String(data.whatsappText || ""));
      setMessage("Email reenviado correctamente.");
      await reloadQuote();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo reenviar.");
    } finally {
      setLoadingResend(false);
    }
  }

  async function markDelivered() {
    setLoadingDeliver(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/mark-delivered`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo marcar como entregado.");
      setMessage("Presupuesto marcado como entregado.");
      await reloadQuote();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo marcar como entregado.");
    } finally {
      setLoadingDeliver(false);
    }
  }

  async function markInProgress() {
    setLoadingProgress(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/mark-in-progress`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo marcar en progreso.");
      setMessage("Presupuesto marcado en progreso.");
      await reloadQuote();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo marcar en progreso.");
    } finally {
      setLoadingProgress(false);
    }
  }

  async function markPaidManual() {
    const method = window.confirm("¿Pago por BIZUM? (Aceptar = Bizum · Cancelar = Transferencia)")
      ? "BIZUM"
      : "TRANSFER";
    setLoadingPaid(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo registrar el pago.");
      setMessage(`Pago ${method} registrado. Pedido de producción creado.`);
      await reloadQuote();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo registrar el pago.");
    } finally {
      setLoadingPaid(false);
    }
  }

  async function copyText(value: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(okMessage);
    } catch {
      setMessage("No se pudo copiar automáticamente.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Presupuesto {quote.quoteNumber}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {quote.customerName} · {quote.sourceLang} → {quote.targetLang}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Estado: <strong>{statusLabel(quote.status)}</strong> · Email: <strong>{quote.customerEmail}</strong>
        </p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
          <p className="mt-1">
            Enviado: {quote.sentAt ? new Date(quote.sentAt).toLocaleString("es-ES") : "—"}
          </p>
          <p>Pagado: {quote.paidAt ? new Date(quote.paidAt).toLocaleString("es-ES") : "—"}</p>
          <p>Entregado: {quote.deliveredAt ? new Date(quote.deliveredAt).toLocaleString("es-ES") : "—"}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Subtotal</p>
            <p className="text-sm font-semibold text-slate-900">{formatMoney(quote.subtotal)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Descuento</p>
            <p className="text-sm font-semibold text-slate-900">- {formatMoney(quote.discountAmount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Envío</p>
            <p className="text-sm font-semibold text-slate-900">{formatMoney(quote.shippingAmount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="text-sm font-semibold text-slate-900">{formatMoney(quote.total)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleFinalizeSend(false)}
            disabled={loadingSend}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loadingSend ? "Generando..." : "Confirmar y enviar por email"}
          </button>
          <button
            type="button"
            onClick={() => handleFinalizeSend(true)}
            disabled={loadingSend}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {loadingSend ? "Generando..." : "Generar (lo envío yo)"}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={() => copyText(payUrl, "Enlace de pago copiado.")}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Copiar pay URL
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={loadingResend}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingResend ? "Reenviando..." : "Reenviar email"}
          </button>
          <button
            type="button"
            onClick={markPaidManual}
            disabled={loadingPaid}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {loadingPaid ? "Registrando..." : "Marcar pagado (Bizum/transfer)"}
          </button>
          <button
            type="button"
            onClick={markInProgress}
            disabled={loadingProgress}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingProgress ? "Guardando..." : "Marcar en progreso"}
          </button>
          <button
            type="button"
            onClick={markDelivered}
            disabled={loadingDeliver}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingDeliver ? "Guardando..." : "Marcar entregado"}
          </button>
          <a
            href={`/q/${quote.publicToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Abrir enlace público
          </a>
        </div>

        {message && <p className="mt-3 text-sm font-semibold text-slate-800">{message}</p>}

        {whatsText && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Mensaje para el cliente</p>
              <div className="flex gap-1" role="group" aria-label="Método de pago">
                {(["BIZUM", "STRIPE", "TRANSFER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                      payMethod === m
                        ? "bg-emerald-600 text-white"
                        : "border border-emerald-500/40 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    {m === "BIZUM" ? "Bizum" : m === "STRIPE" ? "Tarjeta (link)" : "Transferencia"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{waMsg}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(() => {
                const digits = String(quote.customerPhone || "").replace(/\D/g, "");
                const phone = digits ? (digits.length === 9 ? `34${digits}` : digits) : "";
                if (!phone) return null;
                return (
                  <a
                    href={`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Enviar por WhatsApp al cliente
                  </a>
                );
              })()}
              <button
                type="button"
                onClick={() => copyText(waMsg, "Mensaje copiado.")}
                className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Copiar mensaje
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Preview PDF</h2>
            <a
              href={`/api/quotes/${quote.id}/preview-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Abrir completo
            </a>
          </div>
          <iframe
            src={`/api/quotes/${quote.id}/preview-pdf`}
            title="Preview PDF presupuesto"
            className="mt-3 h-72 w-full rounded-xl border border-slate-200"
          />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Preview Email</h2>
            <button
              type="button"
              onClick={handlePreviewEmail}
              disabled={loadingPreview}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingPreview ? "Cargando..." : "Cargar preview"}
            </button>
          </div>
          {!emailPreview ? (
            <p className="mt-3 text-sm text-slate-600">Pulsa “Cargar preview” para ver asunto y cuerpo antes de enviar.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Asunto</p>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {emailPreview.subject}
              </p>
              <p className="pt-2 text-xs uppercase tracking-wide text-slate-500">HTML renderizado</p>
              <div
                className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: emailPreview.html }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Líneas</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">P. unitario</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {line.description}
                    {line.sourceFileUrl && (
                      <span className="ml-2 whitespace-nowrap text-[11px]">
                        <a href={lineDocUrl(line)!} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline">ver PDF</a>
                        <span className="text-slate-400"> · </span>
                        <a href={lineDocUrl(line, true)!} className="text-bleu hover:underline">descargar</a>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(line.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(quote.marginPct != null || quote.lines.some((l) => l.supplierUnitCost != null)) && (
          <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-amber-700">Desglose interno · no aparece en el presupuesto del cliente</p>
            <table className="mt-2 w-full text-left">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1">Concepto</th>
                  <th className="py-1 text-right">Coste traductor</th>
                  <th className="py-1 text-right">Precio cliente</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={`int-${line.id}`} className="border-t border-amber-100">
                    <td className="py-1">{line.description}</td>
                    <td className="py-1 text-right">{line.supplierUnitCost != null ? formatMoney(line.supplierUnitCost) : "—"}</td>
                    <td className="py-1 text-right">{formatMoney(line.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2">
              Margen aplicado: <strong>{quote.marginPct != null ? `${quote.marginPct}%` : "—"}</strong>
            </p>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Mensajes y auditoría</h2>
        {!quote.messageLogs?.length ? (
          <p className="mt-2 text-sm text-slate-600">Aún no hay mensajes registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {quote.messageLogs.map((log) => (
              <li key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">
                  {log.channel} · {log.type} · {log.status}
                </p>
                <p>{log.recipient}</p>
                {log.subject && <p>{log.subject}</p>}
                <p className="text-slate-500">
                  {new Date(log.sentAt || log.createdAt).toLocaleString("es-ES")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
