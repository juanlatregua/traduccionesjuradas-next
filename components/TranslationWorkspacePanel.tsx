"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  reference: string;
  currentDeliveryState: string;
  currentDueDate: string | null;
  existingFileUrl: string | null;
  existingFilename: string | null;
};

export default function TranslationWorkspacePanel({
  reference,
  currentDeliveryState,
  currentDueDate,
  existingFileUrl,
  existingFilename,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<"EN_PROCESO" | "TRADUCIDO">(
    currentDeliveryState === "TRADUCIDO" ? "TRADUCIDO" : "EN_PROCESO"
  );
  const [notifyClient, setNotifyClient] = useState(true);
  const [autoEta, setAutoEta] = useState(true);
  const [etaDate, setEtaDate] = useState(currentDueDate || "");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(existingFileUrl || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadFile() {
    if (!file) return null;
    const form = new FormData();
    form.append("file", file);
    form.append("reference", reference);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.url) {
      throw new Error(data?.error || "No se pudo subir el archivo.");
    }
    return {
      url: String(data.url),
      fileKey: String(data.pathname || "").trim() || null,
      filename: file.name,
      mimeType: file.type || null,
    };
  }

  async function submit() {
    if (state === "EN_PROCESO" && !autoEta && !etaDate) {
      setMessage("Indica una fecha ETA manual o activa el cálculo automático.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      let finalUrl = url.trim();
      let finalFileKey: string | null = null;
      let finalFilename: string | null = null;
      let finalMimeType: string | null = null;

      if (state === "TRADUCIDO" && !finalUrl && file) {
        const upload = await uploadFile();
        if (upload) {
          finalUrl = upload.url;
          finalFileKey = upload.fileKey;
          finalFilename = upload.filename;
          finalMimeType = upload.mimeType;
        }
        setUrl(finalUrl);
      }

      const res = await fetch(`/api/orders/${reference}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          translatedFileUrl: finalUrl || undefined,
          translatedFileKey: finalFileKey || undefined,
          translatedFilename: finalFilename || undefined,
          translatedMimeType: finalMimeType || undefined,
          notifyClient: state === "TRADUCIDO" ? notifyClient : false,
          etaDate: state === "EN_PROCESO" && !autoEta ? etaDate || undefined : undefined,
          autoEta: state === "EN_PROCESO" ? autoEta : false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo actualizar la entrega.");
      }
      if (state === "EN_PROCESO" && data?.etaDate) {
        setMessage(`Estado actualizado. ETA: ${data.etaDate}.`);
      } else {
        setMessage("Estado de entrega actualizado.");
      }
      router.refresh();
    } catch (err: any) {
      setMessage(err?.message || "Error actualizando entrega.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
        Estado de entrega
      </p>

      {existingFileUrl && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs text-slate-400">Archivo actual:</p>
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald-300 hover:underline"
          >
            {existingFilename || "Descargar archivo"}
          </a>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select
          value={state}
          onChange={(e) => setState(e.target.value as "EN_PROCESO" | "TRADUCIDO")}
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="EN_PROCESO">En proceso</option>
          <option value="TRADUCIDO">Traducido</option>
        </select>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL PDF traducido (opcional si subes archivo)"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {state === "EN_PROCESO" && (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoEta}
              onChange={(e) => setAutoEta(e.target.checked)}
              className="rounded border-slate-500"
            />
            Calcular ETA automáticamente (laborables)
          </label>
          {!autoEta && (
            <input
              type="date"
              value={etaDate}
              onChange={(e) => setEtaDate(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          )}
        </div>
      )}

      {state === "TRADUCIDO" && (
        <div className="mt-3">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-500 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-100"
          />
        </div>
      )}

      {state === "TRADUCIDO" && (
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={notifyClient}
            onChange={(e) => setNotifyClient(e.target.checked)}
            className="rounded border-slate-500"
          />
          Notificar al cliente al marcar como traducido
        </label>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar entrega"}
      </button>

      {message && (
        <p className={`mt-2 text-xs font-semibold ${message.includes("Error") ? "text-red-300" : "text-emerald-300"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
