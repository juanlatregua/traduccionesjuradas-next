"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  reference: string;
  currentDeliveryState: string;
  currentDueDate: string | null;
  existingFileUrl: string | null;
  existingFilename: string | null;
  translatorDeliveredAt: string | null;
  // El pedido ya tiene traducción entregada al cliente (o está CERRADO): la
  // subida pasa a ser una CORRECCIÓN (nueva versión principal, email "corregida").
  alreadyDelivered?: boolean;
};

export default function TranslationWorkspacePanel({
  reference,
  currentDeliveryState,
  currentDueDate,
  existingFileUrl,
  existingFilename,
  translatorDeliveredAt,
  alreadyDelivered = false,
}: Props) {
  const router = useRouter();
  // Si el traductor ya entregó (pendiente de verificar), arrancamos en TRADUCIDO
  // para que Juan solo revise y pulse "Guardar entrega" (envía al cliente).
  const [state, setState] = useState<"EN_PROCESO" | "TRADUCIDO">(
    currentDeliveryState === "TRADUCIDO" || translatorDeliveredAt ? "TRADUCIDO" : "EN_PROCESO"
  );
  const [translatorLink, setTranslatorLink] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  async function getTranslatorLink() {
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/orders/${reference}/translator-link`, { method: "POST" });
      const data = await res.json();
      if (data?.ok && data?.path) {
        const full = `${window.location.origin}${data.path}`;
        setTranslatorLink(full);
        try {
          await navigator.clipboard.writeText(full);
        } catch {
          /* clipboard puede fallar sin https/permiso; el enlace queda visible */
        }
      }
    } finally {
      setLinkLoading(false);
    }
  }
  // Si la entrega la acaba de subir el traductor, "Notificar al cliente" arranca
  // DESACTIVADO: obliga a Juan a verificar el archivo y marcarlo a conciencia
  // antes de enviárselo al cliente (el negocio es YMYL, no se envía sin revisar).
  // En una corrección quien sube es Juan (ya revisada): notificar por defecto.
  const [notifyClient, setNotifyClient] = useState(alreadyDelivered || !translatorDeliveredAt);
  const [autoEta, setAutoEta] = useState(true);
  const [etaDate, setEtaDate] = useState(currentDueDate || "");
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState(existingFileUrl || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Tras notificar al cliente con éxito, bloqueamos el botón para no reenviar
  // email+SMS por un segundo clic. Se reactiva si se cambia archivo o se vuelve
  // a marcar la casilla a conciencia (reenvío intencionado).
  const [delivered, setDelivered] = useState(false);

  // Los archivos se ACUMULAN: añadir uno NO borra los anteriores (antes setFiles
  // reemplazaba → solo quedaba el último → solo se entregaba/enviaba uno). Dedup
  // por nombre+tamaño para no repetir si se reelige el mismo.
  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    setFiles((prev) => {
      // Dedup por nombre+tamaño+fecha-de-modificación: así una versión CORREGIDA
      // del mismo PDF (mismo nombre, quizá mismo tamaño) NO se descarta por error.
      const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
      const seen = new Set(prev.map(keyOf));
      const merged = [...prev];
      for (const f of incoming) {
        const key = keyOf(f);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
    setState("TRADUCIDO");
    setDelivered(false);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  type UploadedFile = { url: string; fileKey: string | null; filename: string; mimeType: string | null };

  async function uploadFiles(): Promise<UploadedFile[]> {
    const uploaded: UploadedFile[] = [];
    for (const f of files) {
      const form = new FormData();
      form.append("file", f);
      form.append("reference", reference);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || `No se pudo subir ${f.name}.`);
      }
      uploaded.push({
        url: String(data.url),
        fileKey: String(data.pathname || "").trim() || null,
        filename: f.name,
        mimeType: f.type || null,
      });
    }
    return uploaded;
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
      let uploaded: UploadedFile[] = [];

      if (state === "TRADUCIDO" && files.length > 0) {
        uploaded = await uploadFiles();
        finalUrl = uploaded[0]?.url || finalUrl;
        setUrl(finalUrl);
      }

      const res = await fetch(`/api/orders/${reference}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          translatedFileUrl: finalUrl || undefined,
          translatedFileKey: uploaded[0]?.fileKey || undefined,
          translatedFilename: uploaded[0]?.filename || undefined,
          translatedMimeType: uploaded[0]?.mimeType || undefined,
          files: uploaded.length > 0 ? uploaded : undefined,
          notifyClient: state === "TRADUCIDO" ? notifyClient : false,
          etaDate: state === "EN_PROCESO" && !autoEta ? etaDate || undefined : undefined,
          autoEta: state === "EN_PROCESO" ? autoEta : false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo actualizar la entrega.");
      }
      // Los ficheros ya están subidos y persistidos en el pedido: limpiamos la
      // selección pendiente para que una segunda entrega NO los vuelva a subir
      // (con la acumulación, dejarlos provocaría duplicados).
      if (uploaded.length > 0) {
        setFiles([]);
      }
      if (state === "EN_PROCESO" && data?.etaDate) {
        setMessage(`Estado actualizado. ETA: ${data.etaDate}.`);
      } else if (state === "TRADUCIDO" && notifyClient) {
        setMessage(
          data?.correction
            ? "Corrección guardada y enviada al cliente por email (versión corregida)."
            : "Entregado y notificado al cliente (email + SMS)."
        );
        setDelivered(true);
        setNotifyClient(false);
      } else if (state === "TRADUCIDO" && data?.correction) {
        setMessage("Corrección guardada como versión principal (cliente sin avisar).");
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

      {/* Enlace para que el traductor asignado suba su traducción */}
      <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
        <p className="text-xs text-slate-400">Enlace de subida para el traductor:</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={getTranslatorLink}
            disabled={linkLoading}
            className="rounded-lg border border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
          >
            {linkLoading ? "Generando…" : translatorLink ? "Copiar de nuevo" : "Generar y copiar enlace"}
          </button>
          {translatorLink && (
            <a href={translatorLink} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-indigo-300 hover:underline">
              {translatorLink}
            </a>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Pásaselo al traductor; sube ahí su traducción y te aviso para verificar y enviar.</p>
      </div>

      {translatorDeliveredAt && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-300">⏳ El traductor entregó — pendiente de verificar</p>
          <p className="mt-1 text-[11px] text-slate-300">
            <b>Descarga y revisa el archivo de abajo.</b> Si está correcto, marca <b>«Notificar al cliente»</b> (desactivado a propósito) y pulsa Guardar para enviárselo. No se envía nada hasta que tú lo marques.
          </p>
        </div>
      )}

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
      </div>
      <details className="mt-2" open={Boolean(url)}>
        <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
          Avanzado: traducción alojada fuera (URL externa)
        </summary>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL PDF traducido (opcional si subes archivo)"
          className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </details>

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

      {/* Subir la traducción terminada — siempre visible. Elegir un archivo ya
          marca el pedido como Traducido (listo para entregar al cliente). */}
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs font-semibold text-emerald-300">
          {alreadyDelivered
            ? "📄 Subir corrección: la traducción ya se entregó. La nueva versión pasa a ser la principal (sustituye a la anterior si el nombre coincide)."
            : "📄 Entregar al cliente: sube la traducción terminada"}
        </p>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []));
            e.target.value = ""; // permite reelegir / añadir el mismo input otra vez
          }}
          className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border file:border-emerald-500/50 file:bg-emerald-600/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-200"
        />
        {/* Subir una CARPETA entera (webkitdirectory) — coge sus PDF/Word, descarta ocultos. */}
        <input
          type="file"
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            const picked = Array.from(e.target.files || []).filter(
              (file) => !file.name.startsWith(".") && /\.(pdf|docx?|doc)$/i.test(file.name)
            );
            if (picked.length === 0) {
              setMessage("La carpeta no contiene PDF o Word.");
              e.target.value = "";
              return;
            }
            addFiles(picked);
            e.target.value = "";
          }}
          className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border file:border-slate-500/50 file:bg-slate-700/40 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-200"
        />
        {files.length > 0 ? (
          <div className="mt-2">
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <span className="truncate">📄 {f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="shrink-0 font-semibold text-red-300 hover:text-red-200"
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-slate-400">
              ✓ {files.length} archivo{files.length > 1 ? "s" : ""} listo{files.length > 1 ? "s" : ""}. Marca «Notificar al
              cliente» y pulsa Guardar para enviárselo{files.length > 1 ? "s todos" : ""}.
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-slate-400">
            PDF o Word. Añade los archivos de uno en uno (se ACUMULAN, no se borran) o una CARPETA entera. Al elegir se
            marca como Traducido.
          </p>
        )}
      </div>

      {state === "TRADUCIDO" && (
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-100">
          <input
            type="checkbox"
            checked={notifyClient}
            onChange={(e) => {
              setNotifyClient(e.target.checked);
              if (e.target.checked) setDelivered(false);
            }}
            className="rounded border-slate-500"
          />
          {alreadyDelivered
            ? "Notificar al cliente (le llega email con la versión corregida)"
            : "Notificar al cliente (le llega email + SMS con la traducción)"}
        </label>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading || delivered}
        className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading
          ? "Guardando..."
          : delivered
            ? alreadyDelivered ? "✓ Corrección enviada" : "✓ Entregado y notificado"
            : state === "TRADUCIDO" && notifyClient
              ? alreadyDelivered ? "Enviar corrección al cliente" : "Entregar y notificar al cliente"
              : alreadyDelivered && state === "TRADUCIDO" ? "Guardar corrección" : "Guardar entrega"}
      </button>

      {message && (
        <p className={`mt-2 text-xs font-semibold ${message.includes("Error") ? "text-red-300" : "text-emerald-300"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
