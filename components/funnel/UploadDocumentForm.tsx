"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DocumentPreview = {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  createdAt: string | Date;
};

type UploadDocumentFormProps = {
  docs: DocumentPreview[];
  reason?: string | null;
};

export default function UploadDocumentForm({ docs, reason }: UploadDocumentFormProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [sourceLang, setSourceLang] = useState("fr");
  const [targetLang, setTargetLang] = useState("es");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadNow = async () => {
    if (files.length === 0) {
      setError("Adjunta al menos un archivo para continuar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Subiendo ${i + 1} de ${files.length}...`);
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("sourceLang", sourceLang);
        formData.append("targetLang", targetLang);
        if (i === files.length - 1) {
          formData.append("advance", "true");
        }
        const res = await fetch("/api/session/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || `No se pudo subir "${files[i].name}".`);
        }
      }
      setUploadProgress("");
      router.push("/review");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo subir el documento.");
    } finally {
      setLoading(false);
      setUploadProgress("");
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-slate-900">Paso 2. Documento original</h2>
      <p className="mt-2 text-sm text-slate-700">
        Para continuar al pago es obligatorio subir al menos un documento original (PDF/JPG/PNG).
      </p>
      {reason === "missing_doc" && (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Debes subir un documento original antes de entrar al checkout.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Idioma origen</span>
          <input
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Idioma destino</span>
          <input
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Archivos originales</span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => {
            const selected = Array.from(e.target.files || []);
            if (selected.length > 0) {
              setFiles((prev) => [...prev, ...selected]);
              setError(null);
            }
            e.target.value = "";
          }}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
              <span className="flex-1 truncate text-slate-800">{f.name}</span>
              <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-xs font-semibold text-red-600 hover:text-red-800"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploadProgress && (
        <p className="mt-2 text-sm font-semibold text-blue-700">{uploadProgress}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={uploadNow}
          disabled={loading || files.length === 0}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Subiendo..." : `Subir ${files.length > 0 ? `(${files.length})` : ""} y continuar`}
        </button>
        {docs.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/review")}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Ya subí documentos, continuar a revisión
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

      {docs.length > 0 && (
        <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Documentos ya cargados
          </p>
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="font-semibold text-slate-900">{doc.filename}</p>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Abrir documento
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

