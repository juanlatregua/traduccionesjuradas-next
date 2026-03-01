"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StartSessionFormProps = {
  hasSession: boolean;
  defaultPurpose?: string | null;
  existingDocsCount?: number;
};

export default function StartSessionForm({
  hasSession,
  defaultPurpose,
  existingDocsCount = 0,
}: StartSessionFormProps) {
  const router = useRouter();
  const [purpose, setPurpose] = useState(defaultPurpose || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(hasSession ? "/api/session/purpose" : "/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo iniciar el encargo.");
      }
      router.push("/upload");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar el encargo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-cream bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-encre">Paso 1. Contexto del encargo</h2>
      <p className="mt-2 text-sm text-sepia">
        Indica para qué trámite necesitas la traducción. Esto nos ayuda a priorizar revisión y formato.
      </p>

      {hasSession && (
        <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
          Sesión activa detectada. Documentos ya cargados: {existingDocsCount}.
        </p>
      )}

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-sepia">Finalidad</span>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Ejemplo: extranjería, nacionalidad, homologación, registro..."
          className="mt-2 w-full rounded-2xl border border-cream px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="rounded-2xl bg-bleu px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark disabled:opacity-60"
        >
          {loading ? "Preparando..." : "Continuar al paso de documento"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}

