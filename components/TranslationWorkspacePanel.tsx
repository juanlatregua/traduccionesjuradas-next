"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadStaffFile } from "@/lib/staff-upload-client";

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
  // La entrega al cliente vive en DeliveryPanel: aquí solo quedan el enlace del
  // traductor y el estado «En proceso» con su ETA.
  withoutDelivery?: boolean;
};

export default function TranslationWorkspacePanel({
  reference,
  currentDeliveryState,
  currentDueDate,
  existingFileUrl,
  existingFilename,
  translatorDeliveredAt,
  alreadyDelivered = false,
  withoutDelivery = false,
}: Props) {
  const router = useRouter();
  // Si el traductor ya entregó (pendiente de verificar), arrancamos en TRADUCIDO
  // para que Juan solo revise y pulse "Guardar entrega" (envía al cliente).
  const [state, setState] = useState<"EN_PROCESO" | "TRADUCIDO">(
    !withoutDelivery && (currentDeliveryState === "TRADUCIDO" || translatorDeliveredAt) ? "TRADUCIDO" : "EN_PROCESO"
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
      const up = await uploadStaffFile(f, `orders/${reference}`);
      uploaded.push({ url: up.url, fileKey: up.pathname || null, filename: f.name, mimeType: f.type || null });
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
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `No se pudo actualizar la entrega (error ${res.status}).`);
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
    <div className="rounded-2xl border border-[#D5DAE1] bg-[#fff] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1F6B45]">
        Estado de entrega
      </p>

      {/* Enlace para que el traductor asignado suba su traducción */}
      <div className="mt-3 rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] p-3">
        <p className="text-xs text-[#52606D]">Enlace de subida para el traductor:</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={getTranslatorLink}
            disabled={linkLoading}
            className="rounded-lg border border-[#D5DAE1] px-3 py-1.5 text-xs font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9] disabled:opacity-50"
          >
            {linkLoading ? "Generando…" : translatorLink ? "Copiar de nuevo" : "Generar y copiar enlace"}
          </button>
          {translatorLink && (
            <a href={translatorLink} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-[#1A2E4A] hover:underline">
              {translatorLink}
            </a>
          )}
        </div>
        <p className="mt-1 text-[11px] text-[#52606D]">Pásaselo al traductor; sube ahí su traducción y te aviso para verificar y enviar.</p>
      </div>

      {!withoutDelivery && translatorDeliveredAt && (
        <div className="mt-3 rounded-xl border border-[#E9D8A6] bg-[#FFF8E6] p-3">
          <p className="text-xs font-semibold text-[#7A5A10]">⏳ El traductor entregó — pendiente de verificar</p>
          <p className="mt-1 text-[11px] text-[#1F2933]">
            <b>Descarga y revisa el archivo de abajo.</b> Si está correcto, marca <b>«Notificar al cliente»</b> (desactivado a propósito) y pulsa Guardar para enviárselo. No se envía nada hasta que tú lo marques.
          </p>
        </div>
      )}

      {!withoutDelivery && existingFileUrl && (
        <div className="mt-3 rounded-xl border border-[#BFE0CC] bg-[#EEF7F1] p-3">
          <p className="text-xs text-[#52606D]">Archivo actual:</p>
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[#1F6B45] hover:underline"
          >
            {existingFilename || "Descargar archivo"}
          </a>
        </div>
      )}

      {!withoutDelivery && (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select
          value={state}
          onChange={(e) => setState(e.target.value as "EN_PROCESO" | "TRADUCIDO")}
          className="rounded-xl border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-sm text-[#1F2933]"
        >
          <option value="EN_PROCESO">En proceso</option>
          <option value="TRADUCIDO">Traducido</option>
        </select>
      </div>
      )}
      {!withoutDelivery && (
      <details className="mt-2" open={Boolean(url)}>
        <summary className="cursor-pointer text-xs font-semibold text-[#52606D] hover:text-[#1F2933]">
          Avanzado: traducción alojada fuera (URL externa)
        </summary>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL PDF traducido (opcional si subes archivo)"
          className="mt-2 w-full rounded-xl border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-sm text-[#1F2933] placeholder:text-[#8A96A3]"
        />
      </details>
      )}

      {state === "EN_PROCESO" && !(withoutDelivery && alreadyDelivered) && (
        <div className="mt-3 space-y-2 rounded-xl border border-[#D5DAE1] bg-[#fff] p-3">
          <label className="flex items-center gap-2 text-xs text-[#1F2933]">
            <input
              type="checkbox"
              checked={autoEta}
              onChange={(e) => setAutoEta(e.target.checked)}
              className="rounded border-[#D5DAE1]"
            />
            Calcular ETA automáticamente (laborables)
          </label>
          {!autoEta && (
            <input
              type="date"
              value={etaDate}
              onChange={(e) => setEtaDate(e.target.value)}
              className="w-full rounded-xl border border-[#D5DAE1] bg-[#fff] px-3 py-2 text-sm text-[#1F2933]"
            />
          )}
        </div>
      )}

      {/* Subir la traducción terminada — siempre visible. Elegir un archivo ya
          marca el pedido como Traducido (listo para entregar al cliente). */}
      {!withoutDelivery && (
      <div className="mt-3 rounded-xl border border-[#BFE0CC] bg-[#EEF7F1] p-3">
        <p className="text-xs font-semibold text-[#1F6B45]">
          {alreadyDelivered
            ? "📄 Subir corrección: la traducción ya se entregó. La nueva versión pasa a ser la principal (sustituye a la anterior si el nombre coincide)."
            : "📄 Entregar al cliente: sube la traducción terminada"}
        </p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.zip"
          multiple
          onChange={(e) => {
            addFiles(Array.from(e.target.files || []));
            e.target.value = ""; // permite reelegir / añadir el mismo input otra vez
          }}
          className="mt-2 block w-full text-xs text-[#1F2933] file:mr-3 file:rounded-lg file:border file:border-[#BFE0CC] file:bg-[#EEF7F1] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1F6B45]"
        />
        {/* Subir una CARPETA entera (webkitdirectory) — coge sus PDF/Word/ZIP, descarta ocultos. */}
        <input
          type="file"
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            const picked = Array.from(e.target.files || []).filter(
              (file) => !file.name.startsWith(".") && /\.(pdf|docx?|zip)$/i.test(file.name)
            );
            if (picked.length === 0) {
              setMessage("La carpeta no contiene PDF, Word o ZIP.");
              e.target.value = "";
              return;
            }
            addFiles(picked);
            e.target.value = "";
          }}
          className="mt-2 block w-full text-xs text-[#52606D] file:mr-3 file:rounded-lg file:border file:border-[#D5DAE1] file:bg-[#F6F7F9] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1F2933]"
        />
        {files.length > 0 ? (
          <div className="mt-2">
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#F6F7F9] px-2.5 py-1.5 text-xs text-[#1F2933]"
                >
                  <span className="truncate">📄 {f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="shrink-0 font-semibold text-[#A12B2B] hover:text-[#A12B2B]"
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-[#52606D]">
              ✓ {files.length} archivo{files.length > 1 ? "s" : ""} listo{files.length > 1 ? "s" : ""}. Marca «Notificar al
              cliente» y pulsa Guardar para enviárselo{files.length > 1 ? "s todos" : ""}.
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-[#52606D]">
            PDF, Word o ZIP. Añade los archivos de uno en uno (se ACUMULAN, no se borran) o una CARPETA entera. Al elegir se
            marca como Traducido.
          </p>
        )}
      </div>
      )}

      {state === "TRADUCIDO" && (
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-[#1F2933]">
          <input
            type="checkbox"
            checked={notifyClient}
            onChange={(e) => {
              setNotifyClient(e.target.checked);
              if (e.target.checked) setDelivered(false);
            }}
            className="rounded border-[#D5DAE1]"
          />
          {alreadyDelivered
            ? "Notificar al cliente (le llega email con la versión corregida)"
            : "Notificar al cliente (le llega email + SMS con la traducción)"}
        </label>
      )}

      {!(withoutDelivery && alreadyDelivered) && (
      <button
        type="button"
        onClick={submit}
        disabled={loading || delivered}
        className="mt-4 rounded-xl bg-[#1F6B45] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#185738] disabled:opacity-60"
      >
        {loading
          ? "Guardando..."
          : withoutDelivery
            ? "Guardar ETA"
            : delivered
            ? alreadyDelivered ? "✓ Corrección enviada" : "✓ Entregado y notificado"
            : state === "TRADUCIDO" && notifyClient
              ? alreadyDelivered ? "Enviar corrección al cliente" : "Entregar y notificar al cliente"
              : alreadyDelivered && state === "TRADUCIDO" ? "Guardar corrección" : "Guardar entrega"}
      </button>
      )}

      {message && (
        <p className={`mt-2 text-xs font-semibold ${message.includes("Error") ? "text-[#A12B2B]" : "text-[#1F6B45]"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
