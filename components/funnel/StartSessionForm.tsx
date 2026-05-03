"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PURPOSE_REGULARIZACION_2026 = "REGULARIZACION_2026";

type StartSessionFormProps = {
  hasSession: boolean;
  defaultPurpose?: string | null;
  existingDocsCount?: number;
  isRegularizacion2026?: boolean;
};

export default function StartSessionForm({
  hasSession,
  defaultPurpose,
  existingDocsCount = 0,
  isRegularizacion2026 = false,
}: StartSessionFormProps) {
  const router = useRouter();
  const [purpose, setPurpose] = useState(defaultPurpose || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      const purposeToSend = isRegularizacion2026
        ? PURPOSE_REGULARIZACION_2026
        : purpose;
      const res = await fetch(hasSession ? "/api/session/purpose" : "/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: purposeToSend }),
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

      {isRegularizacion2026 && (
        <div className="mt-4 rounded-2xl border border-bleu/30 bg-bleu/5 p-4 text-sm text-encre">
          <p className="font-semibold text-bleu">
            Tarifa especial regularización 2026 · 25 € / documento
          </p>
          <p className="mt-1 text-sepia">
            Has llegado desde la sección de regularización extraordinaria 2026
            (RD 316/2026, plazo hasta el 30-jun-2026). Aplicamos la tarifa de
            25 €/doc para tu expediente. Sube los documentos en el siguiente
            paso.
          </p>
        </div>
      )}

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
          readOnly={isRegularizacion2026}
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
