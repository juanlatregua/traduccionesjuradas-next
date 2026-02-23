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

export default function OrderDocumentsPanel({
  reference,
  workflowState,
  amountCents,
  documents,
  quoteDraft,
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
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUploading, setSourceUploading] = useState(false);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [resubmissionReason, setResubmissionReason] = useState("");
  const [resubmissionLoading, setResubmissionLoading] = useState(false);
  const [resubmissionMessage, setResubmissionMessage] = useState<string | null>(null);

  const totalEur = useMemo(() => {
    return rows.reduce((acc, row) => {
      const value = Number(String(row.amountEur || "").replace(",", "."));
      if (!Number.isFinite(value) || value < 0) return acc;
      return acc + value;
    }, 0);
  }, [rows]);

  function updateRow(index: number, patch: Partial<QuoteRow>) {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { documentName: "", amountEur: "", notes: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function uploadSourceDocument() {
    if (!sourceFile) return;
    setSourceUploading(true);
    setSourceMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", sourceFile);
      const res = await fetch(`/api/orders/${reference}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo subir el documento.");
      }
      setSourceMessage("Documento fuente subido correctamente.");
      setSourceFile(null);
      setTimeout(() => window.location.reload(), 700);
    } catch (err: any) {
      setSourceMessage(err?.message || "No se pudo subir el documento.");
    } finally {
      setSourceUploading(false);
    }
  }

  async function saveQuote(sendToClient: boolean) {
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
        }),
      });
      const data = await res.json();
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Documentos enviados por cliente</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Estado workflow: <span className="text-slate-200">{workflowState}</span> · Importe actual:{" "}
          <span className="text-slate-200">{(amountCents / 100).toFixed(2)} EUR</span>
        </p>
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No hay adjuntos guardados en este pedido.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {documents.map((doc, idx) => (
              <li
                key={`${doc.name}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-100">{doc.name}</p>
                  <p className="text-slate-400">
                    {formatSize(doc.size)}
                    {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleString("es-ES")}` : ""}
                  </p>
                </div>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                  >
                    Abrir documento
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500">Sin enlace (registro antiguo)</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
            Subir documento fuente
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Si el pedido llegó sin adjunto (p. ej. flujo de calculadora), puedes cargar aquí el archivo original.
          </p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
            onChange={(e) => {
              setSourceFile(e.target.files?.[0] || null);
              setSourceMessage(null);
            }}
            className="mt-3 block w-full text-xs text-slate-300 file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-600/20 file:px-3 file:py-1.5 file:font-semibold file:text-cyan-200 hover:file:bg-cyan-600/30"
          />
          <button
            type="button"
            onClick={uploadSourceDocument}
            disabled={!sourceFile || sourceUploading}
            className="mt-3 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-60"
          >
            {sourceUploading ? "Subiendo..." : "Subir documento"}
          </button>
          {sourceMessage && <p className="mt-2 text-xs font-semibold text-slate-200">{sourceMessage}</p>}
        </div>

        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            Documento ilegible
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Envía aviso al cliente para que reenvíe el archivo con mejor calidad.
          </p>
          <textarea
            value={resubmissionReason}
            onChange={(e) => setResubmissionReason(e.target.value)}
            placeholder="Ejemplo: foto borrosa, falta margen izquierdo, sello no legible."
            className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
            rows={3}
          />
          <button
            type="button"
            onClick={requestResubmission}
            disabled={resubmissionLoading}
            className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
          >
            {resubmissionLoading ? "Enviando solicitud..." : "Solicitar reenvio al cliente"}
          </button>
          {resubmissionMessage && (
            <p className="mt-2 text-xs font-semibold text-slate-100">{resubmissionMessage}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Costes por documento</p>
        <div className="mt-3 space-y-2">
          {rows.map((row, idx) => (
            <div key={`quote-row-${idx}`} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
              <input
                type="text"
                value={row.documentName}
                onChange={(e) => updateRow(idx, { documentName: e.target.value })}
                placeholder="Documento (ej. Certificado de nacimiento)"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.amountEur}
                onChange={(e) => updateRow(idx, { amountEur: e.target.value })}
                placeholder="EUR"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
              <input
                type="text"
                value={row.notes}
                onChange={(e) => updateRow(idx, { notes: e.target.value })}
                placeholder="Notas opcionales"
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
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
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Añadir línea
          </button>
          <p className="text-xs text-slate-300">
            Total calculado: <span className="font-semibold text-emerald-300">{totalEur.toFixed(2)} EUR</span>
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => saveQuote(false)}
            disabled={loading}
            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={() => saveQuote(true)}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Guardar y enviar presupuesto"}
          </button>
        </div>
      </div>

      {message && <p className="text-xs font-semibold text-slate-100">{message}</p>}
    </div>
  );
}
