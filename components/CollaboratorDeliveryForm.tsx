"use client";

import { useRef, useState } from "react";

type Props = {
  token: string;
};

type UploadedFile = {
  fileUrl: string;
  fileKey: string;
  filename: string;
  mimeType: string;
};

export default function CollaboratorDeliveryForm({ token }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let fileData = uploadedFile;

    // Only upload if we don't already have a successful upload
    if (!fileData) {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setError("Selecciona un archivo para subir.");
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (file.type && !allowedTypes.includes(file.type)) {
        setError("Solo se aceptan archivos PDF o Word (.doc, .docx).");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(`/api/encargo/${token}/upload`, {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.ok) {
          setError(uploadData.error || "Error al subir el archivo.");
          setUploading(false);
          return;
        }

        fileData = {
          fileUrl: uploadData.fileUrl,
          fileKey: uploadData.fileKey,
          filename: uploadData.filename,
          mimeType: uploadData.mimeType,
        };
        setUploadedFile(fileData);
      } catch {
        setError("Error de conexión al subir. Inténtalo de nuevo.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // Register delivery
    setSubmitting(true);
    try {
      const res = await fetch(`/api/encargo/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delivery",
          ...fileData,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          (data.error || "Error al registrar la entrega.") +
          " El archivo ya está subido, pulsa de nuevo para reintentar."
        );
        return;
      }
      setUploadedFile(null);
      setSuccess(true);
    } catch {
      setError("Error de conexión. El archivo ya está subido, pulsa de nuevo para reintentar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center">
        <p className="text-lg font-semibold text-emerald-900">
          Traducción entregada correctamente
        </p>
        <p className="mt-2 text-sm text-emerald-700">
          Hemos notificado al equipo. Gracias por tu trabajo.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-encre">Subir traducción terminada</h2>
      <p className="mt-1 text-sm text-sepia">
        Sube el archivo de la traducción completada (PDF o Word, max 20 MB).
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {uploadedFile ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">
              Archivo subido: {uploadedFile.filename}
            </p>
            <p className="text-xs text-emerald-600">
              Pulsa el botón para completar la entrega.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-encre">
              Archivo de traducción
            </label>
            <input
              id="file"
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || null)}
              className="mt-1 block w-full text-sm text-sepia file:mr-4 file:rounded-lg file:border file:border-cream file:bg-cream file:px-4 file:py-2 file:text-sm file:font-semibold file:text-encre hover:file:bg-cream/80"
              required
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-sepia">Seleccionado: {selectedFile}</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={uploading || submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {uploading
            ? "Subiendo archivo..."
            : submitting
              ? "Registrando entrega..."
              : uploadedFile
                ? "Reintentar entrega"
                : "Entregar traducción"}
        </button>
      </form>
    </div>
  );
}
