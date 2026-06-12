"use client";

import { useState } from "react";

// Form de subida del traductor asignado (página pública tokenizada).
export default function TranslatorDeliveryForm({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) {
      setError("Adjunta el archivo de la traducción (PDF o Word).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/entrega/${token}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo subir el archivo.");
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Error al subir el archivo.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900">
        <p className="font-semibold">✓ Traducción recibida</p>
        <p className="mt-1 text-sm">
          Gracias. La hemos recibido y la revisaremos antes de enviarla al cliente. Ya puedes cerrar esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center cursor-pointer hover:border-bleu">
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <span className="text-sm font-medium text-slate-700">
          {file ? `📎 ${file.name}` : "Haz clic para adjuntar la traducción (PDF o Word)"}
        </span>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={busy || !file}
        className="w-full rounded-xl bg-bleu px-5 py-3 text-sm font-semibold text-white hover:bg-bleu/90 disabled:opacity-50"
      >
        {busy ? "Subiendo…" : "Enviar la traducción"}
      </button>
      {error && <p className="text-sm text-rouge">{error}</p>}
    </div>
  );
}
