"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, Camera, FileText, X, Loader2 } from "lucide-react";

type UploadedFile = {
  file: File;
  preview: string;
  documentId?: string;
};

type Props = {
  onUploadComplete: (
    documentId: string,
    sessionToken: string,
    fileSize?: number,
    fileName?: string
  ) => void;
  sessionToken: string | null;
  onSessionToken: (token: string) => void;
  disabled?: boolean;
  gdprConsent?: boolean;
  onGdprConsentChange?: (consent: boolean) => void;
  source?: string | null;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif,.webp";

export default function DocumentUploader({
  onUploadComplete,
  sessionToken,
  onSessionToken,
  disabled,
  gdprConsent: externalGdprConsent,
  onGdprConsentChange,
  source,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [internalGdprConsent, setInternalGdprConsent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Use external consent if provided, otherwise use internal state
  const gdprConsent = externalGdprConsent ?? internalGdprConsent;
  const setGdprConsent = onGdprConsentChange ?? setInternalGdprConsent;

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > MAX_FILE_SIZE) {
        setError("El archivo es demasiado grande. Máximo 20 MB.");
        return;
      }

      if (!gdprConsent) {
        setError("Debes aceptar el tratamiento de datos para continuar.");
        return;
      }

      // Preview
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "";

      setUploadedFile({ file, preview });
      setUploading(true);

      try {
        // 1. Upload directly to Vercel Blob (bypasses 4.5MB serverless limit)
        const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const pathname = `ia-documents/${Date.now()}-${safeName}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/documents/upload",
          clientPayload: JSON.stringify({ gdprConsent: true, sessionToken }),
        });

        // 2. Register document in DB
        const res = await fetch("/api/documents/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: blob.url,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            sessionToken,
            gdprConsent: true,
            source,
          }),
        });

        const data = await res.json();

        if (!data.ok) {
          setError(data.error || "Error al subir el archivo.");
          setUploadedFile(null);
          return;
        }

        setUploadedFile((prev) =>
          prev ? { ...prev, documentId: data.documentId } : null
        );

        if (data.sessionToken) {
          onSessionToken(data.sessionToken);
        }

        onUploadComplete(data.documentId, data.sessionToken, file.size, file.name);
      } catch {
        setError("Error de conexión. Inténtalo de nuevo.");
        setUploadedFile(null);
      } finally {
        setUploading(false);
      }
    },
    [gdprConsent, sessionToken, onSessionToken, onUploadComplete, source]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const removeFile = () => {
    if (uploadedFile?.preview) URL.revokeObjectURL(uploadedFile.preview);
    setUploadedFile(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* RGPD Consent */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={gdprConsent}
          onChange={(e) => setGdprConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-graphite/40 text-bleu focus:ring-bleu"
        />
        <span className="text-xs text-graphite leading-relaxed">
          Consiento el tratamiento de mis documentos para generar un presupuesto
          de traducción jurada. Los documentos se eliminan automáticamente tras
          30 días de la entrega.{" "}
          <a href="/privacidad" className="text-bleu underline" target="_blank">
            Ver política de privacidad
          </a>
          .
        </span>
      </label>

      {/* Drop zone */}
      {!uploadedFile && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
            px-6 py-12 transition-all duration-200 cursor-pointer
            ${
              dragOver
                ? "border-bleu bg-bleu/[0.04] scale-[1.01]"
                : "border-bleu/30 bg-card hover:border-bleu/60"
            }
            ${disabled || !gdprConsent ? "opacity-50 pointer-events-none" : ""}
          `}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Arrastra tu documento aquí o haz clic para seleccionar"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bleu/10">
            <Upload className="h-7 w-7 text-bleu" />
          </div>
          <div className="text-center">
            <p className="font-baskerville text-lg text-bleu">
              Arrastra tu documento aquí
            </p>
            <p className="mt-1 text-sm text-graphite">
              PDF, foto o escaneo &middot; Máx. 20 MB
            </p>
          </div>

          {/* Buttons row */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="rounded-lg border border-bleu/20 bg-white px-4 py-2 text-sm font-medium text-bleu shadow-sm hover:bg-bleu/5 transition-colors"
            >
              <FileText className="mr-2 inline h-4 w-4" />
              Seleccionar archivo
            </button>

            {/* Camera button — only shown on mobile via CSS */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraRef.current?.click();
              }}
              className="rounded-lg border border-bleu/20 bg-white px-4 py-2 text-sm font-medium text-bleu shadow-sm hover:bg-bleu/5 transition-colors sm:hidden"
            >
              <Camera className="mr-2 inline h-4 w-4" />
              Tomar foto
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      )}

      {!uploadedFile && (
        <p className="text-center text-xs text-graphite">
          ¿No sabes cómo escanear bien?{" "}
          <a
            href="/como-escanear-bien"
            className="text-bleu underline underline-offset-2 hover:text-bleu-light"
          >
            Ver guía de 2 minutos
          </a>
        </p>
      )}

      {/* Uploaded file preview */}
      {uploadedFile && (
        <div className="flex items-center gap-4 rounded-xl border border-bleu/20 bg-card p-4 shadow-paper">
          {uploadedFile.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadedFile.preview}
              alt="Preview"
              className="h-16 w-16 rounded-lg object-cover border border-cream"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-bleu/10">
              <FileText className="h-8 w-8 text-bleu" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-encre truncate">
              {uploadedFile.file.name}
            </p>
            <p className="text-xs text-graphite">
              {(uploadedFile.file.size / 1024 / 1024).toFixed(1)} MB
            </p>
            {uploading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-bleu">
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo documento...
              </div>
            )}
          </div>
          {!uploading && (
            <button
              onClick={removeFile}
              className="rounded-full p-1 text-graphite hover:bg-cream transition-colors"
              aria-label="Eliminar archivo"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-rouge/20 bg-rouge/5 px-4 py-3 text-sm text-rouge">
          {error}
        </div>
      )}
    </div>
  );
}
