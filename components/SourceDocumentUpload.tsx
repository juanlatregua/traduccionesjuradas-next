"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  reference: string;
};

export default function SourceDocumentUpload({ reference }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/orders/${reference}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Error al subir documento.");
        return;
      }

      setSuccess(data.document?.fileName || file.name);
      router.refresh();
    } catch {
      setError("Error de red al subir documento.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-600 bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
        Subir documento fuente
      </p>
      <p className="mt-1 text-xs text-slate-400">
        PDF, Word, imagen (max 12 MB)
      </p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-teal-500/40 px-3 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-500/10">
        {uploading ? "Subiendo..." : "Seleccionar archivo"}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-400">Subido: {success}</p>}
    </div>
  );
}
