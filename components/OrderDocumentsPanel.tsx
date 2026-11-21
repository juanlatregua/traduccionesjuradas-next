"use client";

import { useMemo, useState } from "react";

type OrderDocument = {
  name: string;
  type: string;
  size: number;
  url?: string;
  uploadedAt?: string;
};

type QuoteDraftLine = {
  documentName: string;
  amountCents: number;
  notes?: string | null;
};

type QuoteDraft = {
  lines: QuoteDraftLine[];
  totalCents: number | null;
  updatedAt?: string | null;
};

type QuoteAuditEntry = {
  type: string;
  message: string;
  createdAt: string | null;
  actorEmail?: string | null;
  toEmail?: string | null;
  paymentUrl?: string | null;
  subject?: string | null;
  error?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  totalCents?: number | null;
  lines?: QuoteDraftLine[];
};

type QuoteRow = {
  documentName: string;
  amountEur: string;
  notes: string;
};

type Props = {
  reference: string;
  workflowState: string;
  amountCents: number;
  documents: OrderDocument[];
  quoteDraft?: QuoteDraft | null;
  quoteAuditTrail?: QuoteAuditEntry[];
};

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function centsToEurInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString("es-ES");
}

function getAuditEntryLabel(type: string) {
  if (type === "quote.sent_to_client") return "Presupuesto enviado";
  if (type === "quote.send_failed") return "Error enviando presupuesto";
  if (type === "order.payment_link_sent") return "Enlace de pago enviado";
  if (type === "order.payment_link_send_failed") return "Error enviando enlace";
  if (type === "quote.documents.updated") return "Presupuesto actualizado";
  return type;
}

function getAuditEntryClass(type: string) {
  if (type.endsWith("send_failed")) return "border-[#F0C9C9] bg-[#FDF2F2] text-[#A12B2B]";
  if (type === "quote.sent_to_client" || type === "order.payment_link_sent") {
    return "border-[#BFE0CC] bg-[#EEF7F1] text-[#1F6B45]";
  }
  return "border-[#D5DAE1] bg-[#fff] text-[#1F2933]";
}

export default function OrderDocumentsPanel({
  reference,
  workflowState,
  amountCents,
  documents,
  quoteDraft,
  quoteAuditTrail = [],
}: Props) {
  const initialRows: QuoteRow[] = useMemo(() => {
    if (quoteDraft?.lines?.length) {
      return quoteDraft.lines.map((line) => ({
        documentName: line.documentName,
        amountEur: centsToEurInput(line.amountCents),
        notes: line.notes || "",
      }));
    }

    if (documents.length > 0) {
      return documents.map((doc) => ({
        documentName: doc.name,
        amountEur: "",
        notes: "",
      }));
    }

    return [{ documentName: "", amountEur: "", notes: "" }];
  }, [documents, quoteDraft]);

  const [rows, setRows] = useState<QuoteRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resubmissionReason, setResubmissionReason] = useState("");
  const [resubmissionLoading, setResubmissionLoading] = useState(false);
  const [resubmissionMessage, setResubmissionMessage] = useState<string | null>(null);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  const totalEur = useMemo(() => {
    return rows.reduce((acc, row) => {
      const value = Number(String(row.amountEur || "").replace(",", "."));
      if (!Number.isFinite(value) || value < 0) return acc;
      return acc + value;
    }, 0);
  }, [rows]);

  const latestSendEvent = useMemo(() => {
    return quoteAuditTrail.find((entry) =>
      ["quote.sent_to_client", "quote.send_failed", "order.payment_link_sent", "order.payment_link_send_failed"].includes(entry.type)
    );
  }, [quoteAuditTrail]);

  function updateRow(index: number, patch: Partial<QuoteRow>) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { documentName: "", amountEur: "", notes: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  }


  async function saveQuote(sendToClient: boolean, overrideLowMargin = false) {
    setMessage(null);
    const normalized = rows
      .map((row) => {
        const documentName = row.documentName.trim();
        if (!documentName) return null;
        const amount = Number(String(row.amountEur || "").replace(",", "."));
        if (!Number.isFinite(amount) || amount < 0) {
          return { invalid: true } as const;
        }
        return {
          documentName,
          amountCents: Math.round(amount * 100),
          notes: row.notes.trim() || null,
        };
      })
      .filter(Boolean);

    if (normalized.length === 0) {
      setMessage("Añade al menos una linea con documento y coste.");
      return;
    }
    if (normalized.some((line: any) => line?.invalid)) {
      setMessage("Revisa los importes: deben ser numeros positivos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${reference}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: normalized,
          sendToClient,
          ...(overrideLowMargin ? { overrideLowMargin: true } : {}),
        }),
      });
      const data = await res.json();
      // Freno de margen contra el coste ya comprometido con el traductor: el
      // servidor no reprecia por debajo salvo confirmación (y entonces avisa).
      if (res.status === 409 && data?.code === "MARGEN_INSUFICIENTE") {
        setLoading(false);
        const go = window.confirm(
          `FRENO DE MARGEN:\n\n${String(data.error || "").replace("MARGEN_INSUFICIENTE: ", "")}\n\n¿Continuar igualmente? (se avisará por email y SMS)`
        );
        if (go) {
          setTimeout(() => void saveQuote(sendToClient, true), 0);
          return;
        }
        setMessage("Frenado: el total no cubre el coste ya comprometido con el traductor.");
        return;
      }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo guardar el presupuesto.");
      }
      const total = Number(data.totalCents || 0) / 100;
      const warning = data.warning ? ` ${data.warning}` : "";
      setMessage(
        sendToClient
          ? `Presupuesto enviado. Total ${total.toFixed(2)} EUR.${warning}`
          : `Borrador de presupuesto guardado. Total ${total.toFixed(2)} EUR.`
      );
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      setMessage(err?.message || "Error guardando presupuesto.");
    } finally {
      setLoading(false);
    }
  }

  async function requestResubmission() {
    setResubmissionLoading(true);
    setResubmissionMessage(null);
    try {
      const res = await fetch(`/api/orders/${reference}/documents/request-resubmission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: resubmissionReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo solicitar el reenvio.");
      }
      setResubmissionMessage("Solicitud enviada al cliente para reenviar el documento.");
    } catch (err: any) {
      setResubmissionMessage(err?.message || "No se pudo solicitar el reenvio.");
    } finally {
      setResubmissionLoading(false);
    }
  }

  async function copyAuditPaymentUrl(url?: string | null) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setAuditMessage("Enlace de pago copiado.");
    } catch {
      setAuditMessage("No se pudo copiar automaticamente.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1A2E4A]">Documentos enviados por cliente</p>
        <p className="mt-1 text-[11px] text-[#52606D]">
          Estado workflow: <span className="text-[#1F2933]">{workflowState}</span> · Importe actual:{" "}
          <span className="text-[#1F2933]">{(amountCents / 100).toFixed(2)} EUR</span>
        </p>
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-[#52606D]">No hay adjuntos guardados en este pedido.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {documents.map((doc, idx) => (
              <li
                key={`${doc.name}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#1F2933]">{doc.name}</p>
                  <p className="text-[#52606D]">
                    {formatSize(doc.size)}
                    {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleString("es-ES")}` : ""}
                  </p>
                </div>
                {doc.url && doc.url.startsWith("http") ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[#D5DAE1] px-2.5 py-1 text-xs font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9]"
                  >
                    Abrir documento
                  </a>
                ) : (
                  <span className="text-[11px] text-[#52606D]">{doc.url?.includes("DELETED") ? "Eliminado (GDPR)" : "Sin enlace"}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-[#E9D8A6] bg-[#FFF8E6] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7A5A10]">
            Documento ilegible
          </p>
          <p className="mt-1 text-[11px] text-[#1F2933]">
            Envía aviso al cliente para que reenvíe el archivo con mejor calidad.
          </p>
          <textarea
            value={resubmissionReason}
            onChange={(e) => setResubmissionReason(e.target.value)}
            placeholder="Ejemplo: foto borrosa, falta margen izquierdo, sello no legible."
            className="mt-3 w-full rounded-lg border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-xs text-[#1F2933] placeholder:text-[#8A96A3]"
            rows={3}
          />
          <button
            type="button"
            onClick={requestResubmission}
            disabled={resubmissionLoading}
            className="mt-3 rounded-lg bg-[#7A5A10] px-3 py-2 text-xs font-semibold text-white hover:bg-[#654A0D] disabled:opacity-60"
          >
            {resubmissionLoading ? "Enviando solicitud..." : "Solicitar reenvio al cliente"}
          </button>
          {resubmissionMessage && (
            <p className="mt-2 text-xs font-semibold text-[#1F2933]">{resubmissionMessage}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7A5A10]">Costes por documento</p>
        <div className="mt-3 space-y-2">
          {rows.map((row, idx) => (
            <div key={`quote-row-${idx}`} className="grid gap-2 rounded-lg border border-[#D5DAE1] bg-[#fff] p-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
              <input
                type="text"
                value={row.documentName}
                onChange={(e) => updateRow(idx, { documentName: e.target.value })}
                placeholder="Documento (ej. Certificado de nacimiento)"
                className="rounded-lg border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-xs text-[#1F2933]"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.amountEur}
                onChange={(e) => updateRow(idx, { amountEur: e.target.value })}
                placeholder="EUR"
                className="rounded-lg border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-xs text-[#1F2933]"
              />
              <input
                type="text"
                value={row.notes}
                onChange={(e) => updateRow(idx, { notes: e.target.value })}
                placeholder="Notas opcionales"
                className="rounded-lg border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-xs text-[#1F2933]"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="rounded-lg border border-[#D5DAE1] px-3 py-2 text-xs font-semibold text-[#1F2933] hover:bg-[#F6F7F9]"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-[#D5DAE1] px-3 py-2 text-xs font-semibold text-[#1F2933] hover:bg-[#F6F7F9]"
          >
            Añadir línea
          </button>
          <p className="text-xs text-[#1F2933]">
            Total calculado: <span className="font-semibold text-[#1F6B45]">{totalEur.toFixed(2)} EUR</span>
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => saveQuote(false)}
            disabled={loading}
            className="rounded-lg bg-[#F6F7F9] px-3 py-2 text-xs font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9] disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={() => saveQuote(true)}
            disabled={loading}
            className="rounded-lg bg-[#1F6B45] px-3 py-2 text-xs font-semibold text-white hover:bg-[#185738] disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Guardar y enviar presupuesto"}
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-[#D5DAE1] bg-[#fff] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1A2E4A]">
            Control de envio al cliente
          </p>
          {latestSendEvent ? (
            <div className="mt-2 rounded-lg border border-[#D5DAE1] bg-[#F6F7F9] p-3 text-xs text-[#1F2933]">
              <p className="font-semibold text-[#1F2933]">
                Ultimo estado: {getAuditEntryLabel(latestSendEvent.type)}
              </p>
              <p className="mt-1 text-[#52606D]">
                {formatDateTime(latestSendEvent.createdAt)} · {latestSendEvent.toEmail || "Sin destinatario"}
              </p>
              {latestSendEvent.totalCents !== null && latestSendEvent.totalCents !== undefined && (
                <p className="mt-1 text-[#1F2933]">
                  Total enviado: {(latestSendEvent.totalCents / 100).toFixed(2)} EUR
                </p>
              )}
              {latestSendEvent.paymentUrl && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={latestSendEvent.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[#D5DAE1] px-2.5 py-1 text-xs font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9]"
                  >
                    Abrir enlace pago enviado
                  </a>
                  <button
                    type="button"
                    onClick={() => copyAuditPaymentUrl(latestSendEvent.paymentUrl)}
                    className="rounded-lg border border-[#D5DAE1] px-2.5 py-1 text-xs font-semibold text-[#1F2933] hover:bg-[#F6F7F9]"
                  >
                    Copiar enlace
                  </button>
                </div>
              )}
              {latestSendEvent.providerMessageId && (
                <p className="mt-2 text-[11px] text-[#52606D]">
                  ID proveedor: {latestSendEvent.providerMessageId}
                </p>
              )}
              {latestSendEvent.error && (
                <p className="mt-2 rounded border border-[#F0C9C9] bg-[#FDF2F2] px-2 py-1 text-[#A12B2B]">
                  {latestSendEvent.error}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#52606D]">
              Aun no hay registro de envio de presupuesto/enlace para este pedido.
            </p>
          )}

          {quoteAuditTrail.length > 0 && (
            <ul className="mt-3 space-y-2">
              {quoteAuditTrail.slice(0, 8).map((entry, idx) => (
                <li
                  key={`${entry.type}-${entry.createdAt || idx}-${idx}`}
                  className={`rounded-lg border px-3 py-2 text-xs ${getAuditEntryClass(entry.type)}`}
                >
                  <p className="font-semibold">
                    {getAuditEntryLabel(entry.type)} · {formatDateTime(entry.createdAt)}
                  </p>
                  <p className="mt-0.5 text-[#1F2933]">{entry.message}</p>
                  <p className="mt-0.5 text-[#52606D]">
                    {entry.actorEmail ? `Por ${entry.actorEmail}` : "Actor no registrado"}
                    {entry.toEmail ? ` · Destino ${entry.toEmail}` : ""}
                  </p>
                  {entry.totalCents !== null && entry.totalCents !== undefined && (
                    <p className="mt-0.5 text-[#1F2933]">Total: {(entry.totalCents / 100).toFixed(2)} EUR</p>
                  )}
                  {entry.lines && entry.lines.length > 0 && (
                    <p className="mt-0.5 text-[#52606D]">
                      Lineas:{" "}
                      {entry.lines
                        .slice(0, 3)
                        .map((line) => `${line.documentName} (${(line.amountCents / 100).toFixed(2)} EUR)`)
                        .join(" · ")}
                      {entry.lines.length > 3 ? ` · +${entry.lines.length - 3} mas` : ""}
                    </p>
                  )}
                  {entry.subject && <p className="mt-0.5 text-[#52606D]">Asunto: {entry.subject}</p>}
                  {entry.providerMessageId && (
                    <p className="mt-0.5 text-[#52606D]">ID proveedor: {entry.providerMessageId}</p>
                  )}
                  {entry.error && (
                    <p className="mt-1 rounded border border-[#F0C9C9] bg-[#FDF2F2] px-2 py-1 text-[#A12B2B]">
                      {entry.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {auditMessage && <p className="mt-2 text-xs font-semibold text-[#1F2933]">{auditMessage}</p>}
        </div>
      </div>

      {message && <p className="text-xs font-semibold text-[#1F2933]">{message}</p>}
    </div>
  );
}
