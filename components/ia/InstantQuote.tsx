"use client";

import { useState, useMemo } from "react";
import { Clock, Zap, CreditCard, MessageCircle, Check, FileText, AlertCircle, Plus } from "lucide-react";
import type { Quote } from "@/lib/pricing-engine/calculator";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import {
  addBusinessDays,
  getBusinessStart,
  formatDeliveryDate,
  isWeekendOrFridayEvening,
} from "@/lib/delivery-date";

type DocumentEntry = {
  id: string;
  analysis: DocumentAnalysisResult;
  quote: Quote;
};

type Props = {
  documents: DocumentEntry[];
  onPaymentStart: (isUrgent: boolean) => void;
  onAddAnother: () => void;
  hasWarnings: boolean;
};

function getLongestRange(
  documents: DocumentEntry[],
  mode: "standard" | "urgent"
): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const d of documents) {
    const b = d.quote.breakdown;
    if (mode === "standard") {
      if (b.standardDaysMin > min) min = b.standardDaysMin;
      if (b.standardDaysMax > max) max = b.standardDaysMax;
    } else {
      if (b.urgentDaysMin > min) min = b.urgentDaysMin;
      if (b.urgentDaysMax > max) max = b.urgentDaysMax;
    }
  }
  return { min, max };
}

function formatDeliveryRange(min: number, max: number): string {
  const start = getBusinessStart();
  const fromDate = addBusinessDays(start, min);
  const toDate = addBusinessDays(start, max);
  if (min === max) return formatDeliveryDate(fromDate);
  return `${formatDeliveryDate(fromDate)} – ${formatDeliveryDate(toDate)}`;
}

export default function InstantQuote({
  documents,
  onPaymentStart,
  onAddAnother,
  hasWarnings,
}: Props) {
  const [selectedMode, setSelectedMode] = useState<"standard" | "urgent">(
    "standard"
  );

  const isMultiDoc = documents.length > 1;
  const totalBase = documents.reduce((sum, d) => sum + d.quote.basePrice, 0);
  const totalUrgent = documents.reduce((sum, d) => sum + d.quote.urgentPrice, 0);
  const totalWithVat = documents.reduce((sum, d) => sum + d.quote.totalPrice, 0);
  const urgentWithVat = documents.reduce((sum, d) => sum + d.quote.urgentTotalPrice, 0);

  const baseForMode = selectedMode === "standard" ? totalBase : totalUrgent;
  const price = selectedMode === "standard" ? totalWithVat : urgentWithVat;
  const ivaAmount = Math.round((price - baseForMode) * 100) / 100;
  const range = getLongestRange(documents, selectedMode);
  const deliveryLabel = useMemo(
    () => formatDeliveryRange(range.min, range.max),
    [range.min, range.max]
  );
  const showWeekendNotice = isWeekendOrFridayEvening();

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
            Entrega: <strong className="capitalize">{deliveryLabel}</strong>
          </div>
          {showWeekendNotice && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-or">
              <AlertCircle className="h-3.5 w-3.5" />
              Los plazos cuentan a partir del lunes
            </div>
          )}
          <p className="mt-1 text-center text-[11px] text-graphite/60">
            Días laborables (lunes a viernes)
          </p>
        </div>

        {/* Breakdown */}
        <div className="mt-5 space-y-2 rounded-lg bg-cream/40 p-3 text-xs text-graphite">
          {isMultiDoc ? (
            <>
              {documents.map((doc) => (
                <div key={doc.id} className="flex justify-between">
                  <span className="flex items-center gap-1.5 truncate pr-2">
                    <FileText className="h-3 w-3 shrink-0" />
                    {doc.analysis.document_type.specific_type_es}
                  </span>
                  <span className="font-medium text-encre shrink-0">
                    {(selectedMode === "standard"
                      ? doc.quote.totalPrice
                      : doc.quote.urgentTotalPrice
                    ).toFixed(2)}€
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-cream pt-2">
                <span>Base imponible</span>
                <span className="font-medium text-encre">{baseForMode.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (21%)</span>
                <span className="font-medium text-encre">{ivaAmount.toFixed(2)}€</span>
              </div>
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
              {documents[0].quote.breakdown.apostilleSurcharge > 0 && (
                <div className="flex justify-between">
                  <span>Apostilla de La Haya</span>
                  <span className="font-medium text-encre">
                    {documents[0].quote.breakdown.apostilleSurcharge.toFixed(2)}€
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
              <div className="flex justify-between border-t border-cream pt-2">
                <span>Base imponible</span>
                <span className="font-medium text-encre">{baseForMode.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (21%)</span>
                <span className="font-medium text-encre">{ivaAmount.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-medium text-encre">
                <span>Total</span>
                <span>{price.toFixed(2)}€</span>
              </div>
            </>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={onAddAnother}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-bleu/30 px-6 py-3 text-sm font-medium text-bleu hover:border-bleu/50 hover:bg-bleu/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Añadir otro documento
          </button>

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
