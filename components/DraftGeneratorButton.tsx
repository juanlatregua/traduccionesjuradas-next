"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderReference: string;
  documents: Array<{ name: string; url?: string }>;
  langPair: string | null;
  existingDraftUrl?: string | null;
  existingDraftFilename?: string | null;
  existingDraftGeneratedAt?: string | null;
};

type Phase = "idle" | "uploading" | "analyzing" | "generating" | "success" | "error";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  uploading: "Enviando documento...",
  analyzing: "Claude está analizando el documento...",
  generating: "Generando DOCX con formato jurado...",
  success: "Borrador generado",
  error: "Error",
};

export default function DraftGeneratorButton({
  orderReference,
  documents,
  langPair,
  existingDraftUrl,
  existingDraftFilename,
  existingDraftGeneratedAt,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(existingDraftUrl ? "success" : "idle");
  const [draftUrl, setDraftUrl] = useState(existingDraftUrl || "");
  const [draftFilename, setDraftFilename] = useState(existingDraftFilename || "");
  const [notas, setNotas] = useState<string[]>([]);
  const [error, setError] = useState("");

  const hasSourceDoc = documents.some((d) => d.url);
  const defaultDir = langPair?.toLowerCase().startsWith("fr") ? "FR→ES" : "ES→FR";

  async function handleGenerate(documentUrl?: string) {
    setError("");
    setPhase("uploading");

    try {
      setPhase("analyzing");

      const body: Record<string, string> = { orderReference };
      if (documentUrl) body.documentUrl = documentUrl;
      body.direccion = defaultDir;

      const res = await fetch("/api/traduccion-automatica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setPhase("generating");
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al generar borrador.");
      }

      setDraftUrl(data.draftFileUrl);
      setDraftFilename(data.draftFilename);
      setNotas(data.notas_revisor || []);
      setPhase("success");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error inesperado.");
      setPhase("error");
    }
  }

  if (phase === "success") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Borrador IA generado
          </p>
          <p className="mt-1 text-sm text-slate-300">{draftFilename}</p>
          {existingDraftGeneratedAt && (
            <p className="text-xs text-slate-500">
              {new Date(existingDraftGeneratedAt).toLocaleString("es-ES")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={draftUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Descargar DOCX
            </a>
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setDraftUrl("");
                setDraftFilename("");
                setNotas([]);
              }}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Regenerar
            </button>
          </div>
        </div>

        {notas.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              Notas para el revisor
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {notas.map((nota, i) => (
                <li key={i}>• {nota}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const isLoading = phase === "uploading" || phase === "analyzing" || phase === "generating";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
          Borrador IA de traducción jurada
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Genera un borrador DOCX con formato de traducción jurada usando Claude.
          Dirección: <span className="font-semibold text-slate-200">{defaultDir}</span>
        </p>

        {isLoading && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span className="text-sm text-indigo-300">{PHASE_LABELS[phase]}</span>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {!isLoading && (
          <div className="mt-3 flex flex-wrap gap-2">
            {hasSourceDoc ? (
              <button
                type="button"
                onClick={() => {
                  const doc = documents.find((d) => d.url);
                  handleGenerate(doc?.url);
                }}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Generar borrador IA
              </button>
            ) : (
              <p className="text-xs text-amber-300">
                No hay documentos fuente. Sube un documento primero.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
