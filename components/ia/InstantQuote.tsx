"use client";

import { useState } from "react";
import { Clock, Zap, CreditCard, MessageCircle, Check, FileText, File } from "lucide-react";
import type { Quote } from "@/lib/pricing-engine/calculator";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";

type DocumentEntry = {
  id: string;
  analysis: DocumentAnalysisResult;
  quote: Quote;
};

type Props = {
  documents: DocumentEntry[];
  onPaymentStart: (isUrgent: boolean) => void;
  hasWarnings: boolean;
};

function longestDeadline(
  documents: DocumentEntry[],
  mode: "standard" | "urgent"
): string {
  // Return the most conservative (longest) deadline
  const deadlines = documents.map((d) =>
    mode === "standard"
      ? d.quote.estimatedDaysStandard
      : d.quote.estimatedDaysUrgent
  );
  // Sort by the largest number found in the string
  return deadlines.sort((a, b) => {
    const numA = Math.max(...(a.match(/\d+/g) || ["0"]).map(Number));
    const numB = Math.max(...(b.match(/\d+/g) || ["0"]).map(Number));
    return numB - numA;
  })[0];
}

export default function InstantQuote({
  documents,
  onPaymentStart,
  hasWarnings,
}: Props) {
  const [selectedMode, setSelectedMode] = useState<"standard" | "urgent">(
    "standard"
  );

  const isMultiDoc = documents.length > 1;
  const totalBase = documents.reduce((sum, d) => sum + d.quote.basePrice, 0);
  const totalUrgent = documents.reduce((sum, d) => sum + d.quote.urgentPrice, 0);

  const price = selectedMode === "standard" ? totalBase : totalUrgent;
  const estimatedDays = longestDeadline(documents, selectedMode);

  // For single doc, use its analysis for WhatsApp message
  const firstAnalysis = documents[0].analysis;
  const whatsappMsg = encodeURIComponent(
    isMultiDoc
      ? `Hola, he subido ${documents.length} documentos para traducción jurada. Me gustaría más información.`
      : `Hola, he subido un documento (${firstAnalysis.document_type.specific_type_es}) para traducción jurada ${firstAnalysis.language.source_name} → ${firstAnalysis.language.target_name}. Me gustaría más información.`
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      <div
        className={`rounded-xl border-2 bg-card p-6 shadow-paper ${
          hasWarnings ? "border-or/40" : "border-or/60"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-baskerville text-lg text-encre">
            Presupuesto instantáneo
          </h3>
          <span className="rounded-full bg-vert/10 px-3 py-1 text-xs font-medium text-vert flex items-center gap-1">
            <Check className="h-3 w-3" />
            Precio cerrado
          </span>
        </div>

        {/* Mode selector */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-cream/60 p-1">
          <button
            onClick={() => setSelectedMode("standard")}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
              selectedMode === "standard"
                ? "bg-white text-bleu shadow-sm"
                : "text-graphite hover:text-encre"
            }`}
          >
            <Clock className="h-4 w-4" />
            Estándar
          </button>
          <button
            onClick={() => setSelectedMode("urgent")}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
              selectedMode === "urgent"
                ? "bg-white text-rouge shadow-sm"
                : "text-graphite hover:text-encre"
            }`}
          >
            <Zap className="h-4 w-4" />
            Urgente
            <span className="rounded bg-rouge/10 px-1.5 py-0.5 text-[10px] font-bold text-rouge">
              +25%
            </span>
          </button>
        </div>

        {/* Price display */}
        <div className="mt-6 text-center">
          <p className="font-baskerville text-5xl font-bold text-bleu">
            {price.toFixed(2)}
            <span className="text-2xl">€</span>
          </p>
          <p className="mt-1 text-sm text-graphite">
            IVA incluido{isMultiDoc ? ` · ${documents.length} documentos` : ""}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-encre">
            <Clock className="h-4 w-4 text-bleu" />
            Plazo: <strong>{estimatedDays}</strong>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-5 space-y-2 rounded-lg bg-cream/40 p-3 text-xs text-graphite">
          {isMultiDoc ? (
            <>
              {documents.map((doc, i) => (
                <div key={doc.id} className="flex justify-between">
                  <span className="flex items-center gap-1.5 truncate pr-2">
                    <FileText className="h-3 w-3 shrink-0" />
                    {doc.analysis.document_type.specific_type_es}
                  </span>
                  <span className="font-medium text-encre shrink-0">
                    {(selectedMode === "standard"
                      ? doc.quote.basePrice
                      : doc.quote.urgentPrice
                    ).toFixed(2)}€
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-cream pt-2 font-medium text-encre">
                <span>Total</span>
                <span>{price.toFixed(2)}€</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span>Documento analizado</span>
                <span className="font-medium text-encre">
                  {firstAnalysis.document_type.specific_type_es} &middot;{" "}
                  {firstAnalysis.document_metrics.pages}{" "}
                  {firstAnalysis.document_metrics.pages === 1 ? "página" : "páginas"}
                </span>
              </div>
              {documents[0].quote.breakdown.minimumApplied && (
                <div className="flex justify-between">
                  <span>Mínimo por tipo de documento</span>
                  <span className="font-medium text-or">
                    {documents[0].quote.breakdown.minimumAmount.toFixed(2)}€ aplicado
                  </span>
                </div>
              )}
              {documents[0].quote.breakdown.complexityMultiplier > 1 && (
                <div className="flex justify-between">
                  <span>Multiplicador complejidad</span>
                  <span className="font-medium text-encre">
                    &times;{documents[0].quote.breakdown.complexityMultiplier}
                  </span>
                </div>
              )}
              {selectedMode === "urgent" && (
                <div className="flex justify-between text-rouge">
                  <span>Urgencia</span>
                  <span className="font-medium">+25%</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => onPaymentStart(selectedMode === "urgent")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-bleu px-6 py-3.5 text-base font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors"
          >
            <CreditCard className="h-5 w-5" />
            Aceptar y pagar
          </button>

          <a
            href={`https://wa.me/34951333614?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-vert/30 bg-vert/5 px-6 py-3 text-sm font-medium text-vert hover:bg-vert/10 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Consultar por WhatsApp
          </a>
        </div>

        {/* Legal note */}
        <p className="mt-4 text-center text-[11px] text-graphite/70">
          Precio cerrado. Sin sorpresas. Traducción jurada oficial válida para cualquier trámite.
        </p>
      </div>
    </div>
  );
}
