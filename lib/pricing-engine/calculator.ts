// lib/pricing-engine/calculator.ts — Motor de cálculo de precios

import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { getRate } from "./languages";
import {
  getMinimum,
  getComplexityMultiplier,
  URGENCY_MULTIPLIER,
} from "./rules";

export type Quote = {
  basePrice: number;
  urgentPrice: number;
  estimatedDaysStandard: string;
  estimatedDaysUrgent: string;
  breakdown: {
    words: number;
    ratePerWord: number;
    wordSubtotal: number;
    minimumApplied: boolean;
    minimumAmount: number;
    complexityMultiplier: number;
    ivaIncluded: boolean;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getEstimatedDays(
  specificType: string,
  pages: number,
  estimatedWords: number
): { standard: string; urgent: string } {
  // Certificados sencillos
  if (
    [
      "birth_certificate",
      "marriage_certificate",
      "death_certificate",
      "criminal_record",
      "passport",
      "id_card",
    ].includes(specificType)
  ) {
    return { standard: "24-48h", urgent: "12-24h" };
  }

  // Documentos académicos
  if (["degree", "transcript"].includes(specificType)) {
    if (pages <= 2) return { standard: "48-72h", urgent: "24h" };
    return { standard: "3-5 días", urgent: "48h" };
  }

  // Documentos legales/financieros extensos
  if (estimatedWords > 2000) {
    return { standard: "5-10 días", urgent: "3-5 días" };
  }

  // Paquetes (múltiples documentos)
  if (pages > 5) {
    return { standard: "5-7 días", urgent: "3-4 días" };
  }

  // Default
  return { standard: "2-5 días", urgent: "24-48h" };
}

/**
 * Calcula el presupuesto a partir del análisis IA
 */
export function calculatePrice(analysis: DocumentAnalysisResult): Quote {
  const { document_type, language, document_metrics, complexity } = analysis;

  const rate = getRate(language.source);
  const minimum = getMinimum(document_type.specific_type);
  const complexityMult = getComplexityMultiplier(complexity.level);

  const wordPrice = document_metrics.estimated_words * rate * complexityMult;
  const basePrice = Math.max(wordPrice, minimum);

  const estimatedDays = getEstimatedDays(
    document_type.specific_type,
    document_metrics.pages,
    document_metrics.estimated_words
  );

  return {
    basePrice: round2(basePrice),
    urgentPrice: round2(basePrice * URGENCY_MULTIPLIER),
    estimatedDaysStandard: estimatedDays.standard,
    estimatedDaysUrgent: estimatedDays.urgent,
    breakdown: {
      words: document_metrics.estimated_words,
      ratePerWord: rate,
      wordSubtotal: round2(wordPrice),
      minimumApplied: wordPrice < minimum,
      minimumAmount: minimum,
      complexityMultiplier: complexityMult,
      ivaIncluded: true,
    },
  };
}
