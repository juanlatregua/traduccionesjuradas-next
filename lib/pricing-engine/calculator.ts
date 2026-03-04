// lib/pricing-engine/calculator.ts — Motor de cálculo de precios

import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { getRate } from "./languages";
import {
  getMinimum,
  getComplexityMultiplier,
  URGENCY_MULTIPLIER,
  MOROCCO_PRICING,
  MOROCCO_PER_WORD_RATE,
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
  const { document_type, language, document_metrics, complexity, country } = analysis;

  // Use the "foreign" language rate (non-Spanish side of the pair)
  const foreignLang =
    language.source === "es" && language.target && language.target !== "unknown"
      ? language.target
      : language.source;
  const rate = getRate(foreignLang);
  const minimum = getMinimum(document_type.specific_type);
  const complexityMult = getComplexityMultiplier(complexity.level);

  // Morocco special pricing: fixed price for 1-3 pages
  const isMorocco = country?.origin === "MA";
  const moroccoFixedPrice = isMorocco
    ? MOROCCO_PRICING[document_metrics.pages]
    : undefined;

  let basePrice: number;
  let wordPrice: number;
  let effectiveRate = rate;

  if (moroccoFixedPrice !== undefined) {
    // Morocco docs with 1-3 pages: use fixed price
    basePrice = moroccoFixedPrice;
    wordPrice = moroccoFixedPrice;
    effectiveRate = 0;
  } else if (isMorocco) {
    // Morocco docs with 4+ pages: use Morocco per-word rate
    effectiveRate = MOROCCO_PER_WORD_RATE;
    wordPrice = document_metrics.estimated_words * effectiveRate * complexityMult;
    basePrice = Math.max(wordPrice, minimum);
  } else {
    wordPrice = document_metrics.estimated_words * rate * complexityMult;
    basePrice = Math.max(wordPrice, minimum);
  }

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
      ratePerWord: effectiveRate,
      wordSubtotal: round2(wordPrice),
      minimumApplied: !moroccoFixedPrice && wordPrice < minimum,
      minimumAmount: minimum,
      complexityMultiplier: complexityMult,
      ivaIncluded: true,
    },
  };
}
