"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  CreditCard,
  GraduationCap,
  Scale,
  Landmark,
  Briefcase,
  Globe,
  Heart,
  File,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";

type Props = {
  documentId: string;
  onAnalysisComplete: (analysis: DocumentAnalysisResult, quote: Quote) => void;
  onError: (error: string) => void;
};

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  civil_registry: FileText,
  identity: CreditCard,
  academic: GraduationCap,
  legal: Scale,
  financial: Landmark,
  labor: Briefcase,
  immigration: Globe,
  medical: Heart,
  other: File,
};

const LANGUAGE_FLAGS: Record<string, string> = {
  fr: "/flags/fr.svg",
  en: "/flags/gb.svg",
  de: "/flags/de.svg",
  it: "/flags/it.svg",
  pt: "/flags/pt.svg",
  nl: "/flags/nl.svg",
  ar: "/flags/ma.svg",
  es: "/flags/es.svg",
  ca: "/flags/ca.svg",
  sv: "/flags/se.svg",
  no: "/flags/no.svg",
};

const LANGUAGE_ALT: Record<string, string> = {
  fr: "Francés",
  en: "Inglés",
  de: "Alemán",
  it: "Italiano",
  pt: "Portugués",
  nl: "Neerlandés",
  ar: "Árabe",
  es: "Español",
  ca: "Catalán",
  sv: "Sueco",
  no: "Noruego",
};

const ANALYZING_MESSAGES = [
  "Identificando tipo de documento...",
  "Detectando idioma de origen...",
  "Extrayendo datos clave...",
  "Estimando complejidad...",
  "Calculando presupuesto...",
];

export default function DocumentAnalysis({
  documentId,
  onAnalysisComplete,
  onError,
}: Props) {
  const [status, setStatus] = useState<"analyzing" | "done" | "error">("analyzing");
  const [analysis, setAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate analyzing messages
  useEffect(() => {
    if (status !== "analyzing") return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ANALYZING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [status]);

  // Call analyze API
  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      try {
        const res = await fetch("/api/documents/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        });

        if (cancelled) return;
        const data = await res.json();

        if (!data.ok) {
          setStatus("error");
          onError(data.error || "Error al analizar el documento.");
          return;
        }

        setAnalysis(data.analysis);
        setStatus("done");
        onAnalysisComplete(data.analysis, data.quote);
      } catch {
        if (cancelled) return;
        setStatus("error");
        onError("Error de conexión al analizar el documento.");
      }
    }

    analyze();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // ─── Analyzing state — skeleton loader ───
  if (status === "analyzing") {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Progress header */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-bleu/15 bg-card p-6 shadow-paper">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-bleu/20 border-t-bleu animate-spin" />
            <FileText className="absolute inset-0 m-auto h-5 w-5 text-bleu" />
          </div>
          <p className="text-sm font-medium text-bleu transition-all duration-300">
            {ANALYZING_MESSAGES[messageIndex]}
          </p>
          <div className="w-full max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-bleu/10">
              <div
                className="h-full rounded-full bg-bleu transition-all duration-[2500ms] ease-linear"
                style={{
                  width: `${((messageIndex + 1) / ANALYZING_MESSAGES.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Skeleton that mimics the result structure */}
        <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper animate-pulse">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-sepia/20" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 rounded bg-sepia/20" />
              <div className="h-4 w-1/3 rounded bg-sepia/15" />
            </div>
            <div className="h-7 w-16 rounded-full bg-sepia/15" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-1/3 rounded bg-sepia/15" />
                <div className="h-4 w-2/3 rounded bg-sepia/20" />
              </div>
            ))}
          </div>
          <div className="mt-5 h-10 w-1/2 rounded-lg bg-bleu/10" />
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (status === "error") {
    return null; // Handled by parent
  }

  // ─── Analysis result ───
  if (!analysis) return null;

  const IconComponent =
    CATEGORY_ICON_MAP[analysis.document_type.category] || File;
  const confidence = analysis.document_type.confidence;
  const confidenceLevel =
    confidence >= 0.85 ? "high" : confidence >= 0.7 ? "medium" : "low";

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bleu/10">
            <IconComponent className="h-6 w-6 text-bleu" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-baskerville text-xl text-encre">
              {analysis.document_type.specific_type_es}
            </h3>
            <p className="text-sm text-graphite mt-0.5">
              {analysis.document_type.category.replace(/_/g, " ")}
            </p>
          </div>
          {/* Confidence badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              confidenceLevel === "high"
                ? "bg-vert/10 text-vert"
                : confidenceLevel === "medium"
                ? "bg-or/10 text-or"
                : "bg-bleu/10 text-bleu"
            }`}
          >
            {confidenceLevel === "high" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : confidenceLevel === "medium" ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Info className="h-3.5 w-3.5" />
            )}
            {Math.round(confidence * 100)}%
          </div>
        </div>

        {/* Details grid */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Language */}
          <div>
            <p className="text-xs text-graphite uppercase tracking-wide">Idioma</p>
            <div className="mt-1 flex items-center gap-2">
              {LANGUAGE_FLAGS[analysis.language.source] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={LANGUAGE_FLAGS[analysis.language.source]}
                  alt={LANGUAGE_ALT[analysis.language.source] || analysis.language.source_name}
                  className="h-4 w-5 rounded-sm object-cover"
                />
              )}
              <span className="text-sm font-medium text-encre">
                {analysis.language.source_name}
              </span>
              <span className="text-graphite">&rarr;</span>
              {LANGUAGE_FLAGS[analysis.language.target] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={LANGUAGE_FLAGS[analysis.language.target]}
                  alt={LANGUAGE_ALT[analysis.language.target] || analysis.language.target_name}
                  className="h-4 w-5 rounded-sm object-cover"
                />
              )}
              <span className="text-sm font-medium text-encre">
                {analysis.language.target_name}
              </span>
            </div>
          </div>

          {/* Country */}
          <div>
            <p className="text-xs text-graphite uppercase tracking-wide">País</p>
            <p className="mt-1 text-sm font-medium text-encre">
              {analysis.country.origin_name}
            </p>
          </div>

          {/* Pages + Words */}
          <div>
            <p className="text-xs text-graphite uppercase tracking-wide">
              Extensión
            </p>
            <p className="mt-1 text-sm font-medium text-encre">
              {analysis.document_metrics.pages}{" "}
              {analysis.document_metrics.pages === 1 ? "página" : "páginas"}
            </p>
          </div>
        </div>

        {/* Extracted data (censored) */}
        {(analysis.extracted_data.names.length > 0 ||
          analysis.extracted_data.dates.length > 0) && (
          <div className="mt-4 rounded-lg bg-cream/60 p-3">
            <p className="text-xs text-graphite uppercase tracking-wide mb-2">
              Datos detectados
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {analysis.extracted_data.names.slice(0, 3).map((name, i) => (
                <span
                  key={i}
                  className="rounded-md bg-white px-2 py-1 text-encre border border-cream"
                >
                  {name.slice(0, 3)}***
                </span>
              ))}
              {analysis.extracted_data.dates.slice(0, 3).map((date, i) => (
                <span
                  key={`d-${i}`}
                  className="rounded-md bg-white px-2 py-1 text-encre border border-cream"
                >
                  {date}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {analysis.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {analysis.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-or/5 border border-or/15 px-3 py-2 text-xs text-or-dark"
              >
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-or" />
                {warning}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
