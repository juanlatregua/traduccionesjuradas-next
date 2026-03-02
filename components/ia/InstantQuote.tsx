"use client";

import { useState } from "react";
import { Clock, Zap, CreditCard, MessageCircle, Check, Info } from "lucide-react";
import type { Quote } from "@/lib/pricing-engine/calculator";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";

type Props = {
  quote: Quote;
  analysis: DocumentAnalysisResult;
  documentId: string;
  onPaymentStart: (isUrgent: boolean) => void;
  hasWarnings: boolean;
};

export default function InstantQuote({
  quote,
  analysis,
  documentId,
  onPaymentStart,
  hasWarnings,
}: Props) {
  const [selectedMode, setSelectedMode] = useState<"standard" | "urgent">(
    "standard"
  );

  const price =
    selectedMode === "standard" ? quote.basePrice : quote.urgentPrice;
  const estimatedDays =
    selectedMode === "standard"
      ? quote.estimatedDaysStandard
      : quote.estimatedDaysUrgent;

  const whatsappMsg = encodeURIComponent(
    `Hola, he subido un documento (${analysis.document_type.specific_type_es}) para traducción jurada ${analysis.language.source_name} → ${analysis.language.target_name}. Me gustaría más información.`
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
          {!hasWarnings && (
            <span className="rounded-full bg-vert/10 px-3 py-1 text-xs font-medium text-vert flex items-center gap-1">
              <Check className="h-3 w-3" />
              Precio cerrado
            </span>
          )}
          {hasWarnings && (
            <span className="rounded-full bg-or/10 px-3 py-1 text-xs font-medium text-or flex items-center gap-1">
              <Info className="h-3 w-3" />
              Orientativo
            </span>
          )}
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
          <p className="mt-1 text-sm text-graphite">IVA incluido</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-encre">
            <Clock className="h-4 w-4 text-bleu" />
            Plazo: <strong>{estimatedDays}</strong>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-5 space-y-2 rounded-lg bg-cream/40 p-3 text-xs text-graphite">
          <div className="flex justify-between">
            <span>Palabras estimadas</span>
            <span className="font-medium text-encre">
              ~{quote.breakdown.words}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tarifa por palabra</span>
            <span className="font-medium text-encre">
              {quote.breakdown.ratePerWord.toFixed(2)}€
            </span>
          </div>
          {quote.breakdown.minimumApplied && (
            <div className="flex justify-between">
              <span>Mínimo por tipo de documento</span>
              <span className="font-medium text-or">
                {quote.breakdown.minimumAmount.toFixed(2)}€ aplicado
              </span>
            </div>
          )}
          {quote.breakdown.complexityMultiplier > 1 && (
            <div className="flex justify-between">
              <span>Multiplicador complejidad</span>
              <span className="font-medium text-encre">
                &times;{quote.breakdown.complexityMultiplier}
              </span>
            </div>
          )}
          {selectedMode === "urgent" && (
            <div className="flex justify-between text-rouge">
              <span>Urgencia</span>
              <span className="font-medium">+25%</span>
            </div>
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
          {hasWarnings
            ? "Este presupuesto es orientativo. Nuestro equipo lo confirmará en menos de 1 hora."
            : "Precio cerrado. Sin sorpresas. Traducción jurada oficial válida para cualquier trámite."}
        </p>
      </div>
    </div>
  );
}
