"use client";

// app/puerta/PuertaClient.tsx — La puerta (v2 · Fase 1 · Bloque 1.2)
// Entrada de documentos + fecha límite → diagnóstico completo. Sin pago:
// el puente al checkout es el Bloque 1.3.

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { CalendarClock, Plus, RotateCcw, MessageCircle } from "lucide-react";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { buildDiagnosis, type Diagnosis } from "@/lib/diagnosis";
import DiagnosisCard from "@/components/puerta/DiagnosisCard";

const DocumentUploader = dynamic(
  () => import("@/components/ia/DocumentUploader"),
  { ssr: false }
);
const DocumentAnalysis = dynamic(
  () => import("@/components/ia/DocumentAnalysis"),
  { ssr: false }
);

type Step = "entry" | "analyzing" | "diagnosis" | "error";

type DocEntry = {
  id: string;
  fileName: string;
  analysis: DocumentAnalysisResult;
  quote: Quote;
  diagnosis: Diagnosis;
};

const WHATSAPP = `https://wa.me/34951333614?text=${encodeURIComponent(
  "Hola, tengo una duda sobre un presupuesto de traducción jurada."
)}`;

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function PuertaClient() {
  const [step, setStep] = useState<Step>("entry");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [neededByInput, setNeededByInput] = useState("");
  const [documents, setDocuments] = useState<DocEntry[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentFileSize, setCurrentFileSize] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const neededBy = parseDateInput(neededByInput);
  const todayInput = new Date().toISOString().split("T")[0];

  const handleUploadComplete = useCallback(
    (docId: string, token: string, fileSize?: number, fileName?: string) => {
      setCurrentDocId(docId);
      setSessionToken(token);
      setCurrentFileSize(fileSize || 0);
      setCurrentFileName(fileName || "Documento");
      setStep("analyzing");
    },
    []
  );

  const handleAnalysisComplete = useCallback(
    (analysis: DocumentAnalysisResult, quote: Quote) => {
      if (!currentDocId) return;
      setDocuments((prev) => [
        ...prev,
        {
          id: currentDocId,
          fileName: currentFileName,
          analysis,
          quote,
          diagnosis: buildDiagnosis(analysis, quote),
        },
      ]);
      setStep("diagnosis");
    },
    [currentDocId, currentFileName]
  );

  const handleError = useCallback((error: string) => {
    setErrorMessage(error);
    setStep("error");
  }, []);

  const handleAddAnother = useCallback(() => {
    setCurrentDocId(null);
    setStep("entry");
  }, []);

  const handleReset = useCallback(() => {
    setStep("entry");
    setDocuments([]);
    setCurrentDocId(null);
    setErrorMessage(null);
  }, []);

  // Original en español: al elegir idioma de destino, recalcular precio y
  // reconstruir el diagnóstico de ese documento.
  const handlePickTargetLanguage = useCallback(
    (docId: string, target: string, targetName: string) => {
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id !== docId) return doc;
          const analysis: DocumentAnalysisResult = {
            ...doc.analysis,
            language: {
              ...doc.analysis.language,
              target,
              target_name: targetName,
            },
          };
          const quote = calculatePrice(analysis);
          return {
            ...doc,
            analysis,
            quote,
            diagnosis: buildDiagnosis(analysis, quote),
          };
        })
      );
    },
    []
  );

  const total = documents.reduce((sum, d) => sum + d.diagnosis.price.total, 0);

  return (
    <div className="space-y-6">
      {/* ─── Entrada ─── */}
      {step === "entry" && (
        <>
          {documents.length === 0 && (
            <div className="rounded-xl border border-bleu/15 bg-card p-5 shadow-paper">
              <label
                htmlFor="needed-by"
                className="flex items-center gap-2 text-sm font-semibold text-encre"
              >
                <CalendarClock className="h-4 w-4 text-bleu" />
                ¿Para cuándo lo necesitas?
              </label>
              <p className="mt-1 text-xs text-graphite">
                Opcional. Nos ayuda a confirmarte si el plazo llega a tu fecha.
              </p>
              <input
                id="needed-by"
                type="date"
                min={todayInput}
                value={neededByInput}
                onChange={(e) => setNeededByInput(e.target.value)}
                className="mt-3 rounded-lg border border-graphite/20 bg-white px-3 py-2 text-sm text-encre outline-none focus:border-bleu focus:ring-1 focus:ring-bleu/20"
              />
            </div>
          )}

          <DocumentUploader
            onUploadComplete={handleUploadComplete}
            sessionToken={sessionToken}
            onSessionToken={setSessionToken}
            gdprConsent={gdprConsent}
            onGdprConsentChange={setGdprConsent}
          />
        </>
      )}

      {/* ─── Analizando ─── */}
      {step === "analyzing" && currentDocId && (
        <DocumentAnalysis
          documentId={currentDocId}
          fileSize={currentFileSize}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleError}
        />
      )}

      {/* ─── Diagnóstico ─── */}
      {step === "diagnosis" && documents.length > 0 && (
        <div className="space-y-5">
          {neededBy && (
            <p className="text-sm text-graphite">
              Lo necesitas para el{" "}
              <span className="font-medium text-encre">
                {neededBy.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                })}
              </span>
              .
            </p>
          )}

          {documents.map((doc) => (
            <DiagnosisCard
              key={doc.id}
              diagnosis={doc.diagnosis}
              fileName={doc.fileName}
              confidence={doc.analysis.document_type.confidence}
              neededBy={neededBy}
              onPickTargetLanguage={(lang, name) =>
                handlePickTargetLanguage(doc.id, lang, name)
              }
            />
          ))}

          {documents.length > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-bleu/15 bg-cream px-5 py-4">
              <span className="text-sm font-medium text-encre">
                Total ({documents.length} documentos)
              </span>
              <span className="font-baskerville text-2xl font-bold text-bleu">
                {total.toFixed(2)} €
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAddAnother}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bleu/20 px-4 py-2.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu/5"
            >
              <Plus className="h-4 w-4" />
              Añadir otro documento
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm text-graphite transition-colors hover:text-bleu"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Empezar de nuevo
            </button>
          </div>

          {/* Pago — se conecta en el Bloque 1.3 */}
          <div className="rounded-xl border border-bleu/15 bg-card p-5 text-center shadow-paper">
            <button
              type="button"
              disabled
              className="w-full rounded-lg bg-bleu px-5 py-3 text-sm font-semibold text-white opacity-50"
            >
              Continuar al pago
            </button>
            <p className="mt-2 text-xs text-graphite">
              Pago disponible próximamente.
            </p>
          </div>
        </div>
      )}

      {/* ─── Error ─── */}
      {step === "error" && (
        <div className="rounded-xl border border-rouge/20 bg-card p-6 text-center shadow-paper">
          <p className="font-baskerville text-xl text-rouge">
            No hemos podido analizar el documento
          </p>
          <p className="mt-2 text-sm text-graphite">
            {errorMessage || "Ha ocurrido un error inesperado."}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-bleu/20 px-5 py-2.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu/5"
            >
              <RotateCcw className="h-4 w-4" />
              Intentar de nuevo
            </button>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-vert px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vert/90"
            >
              <MessageCircle className="h-4 w-4" />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
