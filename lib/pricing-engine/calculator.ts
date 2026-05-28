// lib/pricing-engine/calculator.ts — Motor de cálculo de precios

import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { getRate } from "./languages";
import {
  getMinimum,
  getPageMinimum,
  getComplexityMultiplier,
  getApostilleSurcharge,
  URGENCY_MULTIPLIER,
  MOROCCO_PRICING,
  FRENCH_CRIMINAL_RECORD_PRICE,
} from "./rules";

export const VAT_RATE = 0.21;

export type Quote = {
  basePrice: number;
  urgentPrice: number;
  totalPrice: number;
  urgentTotalPrice: number;
  estimatedDaysStandard: string;
  estimatedDaysUrgent: string;
  breakdown: {
    words: number;
    ratePerWord: number;
    wordSubtotal: number;
    minimumApplied: boolean;
    minimumAmount: number;
    complexityMultiplier: number;
    apostilleSurcharge: number;
    ivaRate: number;
    ivaAmount: number;
    standardDaysMin: number;
    standardDaysMax: number;
    urgentDaysMin: number;
    urgentDaysMax: number;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type EstimatedDays = {
  standard: string;
  urgent: string;
  standardMin: number;
  standardMax: number;
  urgentMin: number;
  urgentMax: number;
};

function pluralDias(min: number, max: number): string {
  if (min === max) return `${min} día${min === 1 ? "" : "s"} laborable${min === 1 ? "" : "s"}`;
  return `${min}-${max} días laborables`;
}

function getEstimatedDays(
  specificType: string,
  pages: number,
  estimatedWords: number
): EstimatedDays {
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
    return {
      standard: pluralDias(1, 2), urgent: pluralDias(1, 1),
      standardMin: 1, standardMax: 2, urgentMin: 1, urgentMax: 1,
    };
  }

  // Documentos académicos
  if (["degree", "transcript"].includes(specificType)) {
    if (pages <= 2) {
      return {
        standard: pluralDias(2, 3), urgent: pluralDias(1, 1),
        standardMin: 2, standardMax: 3, urgentMin: 1, urgentMax: 1,
      };
    }
    return {
      standard: pluralDias(3, 5), urgent: pluralDias(2, 2),
      standardMin: 3, standardMax: 5, urgentMin: 2, urgentMax: 2,
    };
  }

  // Documentos legales/financieros extensos
  if (estimatedWords > 2000) {
    return {
      standard: pluralDias(5, 10), urgent: pluralDias(3, 5),
      standardMin: 5, standardMax: 10, urgentMin: 3, urgentMax: 5,
    };
  }

  // Paquetes (múltiples documentos)
  if (pages > 5) {
    return {
      standard: pluralDias(5, 7), urgent: pluralDias(3, 4),
      standardMin: 5, standardMax: 7, urgentMin: 3, urgentMax: 4,
    };
  }

  // Default
  return {
    standard: pluralDias(2, 5), urgent: pluralDias(1, 2),
    standardMin: 2, standardMax: 5, urgentMin: 1, urgentMax: 2,
  };
}

/**
 * Calcula el presupuesto a partir del análisis IA
 */
export function calculatePrice(analysis: DocumentAnalysisResult): Quote {
  const { document_type, language, document_metrics, complexity, country, requirements } = analysis;

  // Use the "foreign" language rate (non-Spanish side of the pair)
  const foreignLang =
    language.source === "es" && language.target && language.target !== "unknown"
      ? language.target
      : language.source;
  const rate = getRate(foreignLang);
  // El suelo efectivo es el mayor de: mínimo por tipo, mínimo por idioma y
  // suelo por página (40 €/pág, salvo certificados simples exentos).
  const minimum = Math.max(
    getMinimum(document_type.specific_type, foreignLang),
    getPageMinimum(document_type.specific_type, document_metrics.pages)
  );
  const complexityMult = getComplexityMultiplier(complexity.level);

  // Apostille surcharge: fijo según idioma (árabe 10€, resto 25€)
  const apostilleSurcharge = requirements?.has_apostille ? getApostilleSurcharge(foreignLang) : 0;

  // Morocco special pricing: solo aplica a francés (no árabe)
  const isMorocco = country?.origin === "MA" && foreignLang !== "ar";
  const moroccoMaxPage = Math.max(...Object.keys(MOROCCO_PRICING).map(Number));
  const moroccoFixedPrice = isMorocco
    ? MOROCCO_PRICING[Math.min(document_metrics.pages, moroccoMaxPage)] ?? MOROCCO_PRICING[moroccoMaxPage]
    : undefined;

  // Penales franceses con formulario multilingüe UE (Bulletin n°3 de ~5 páginas):
  // el anexo distorsiona el conteo. La versión de 1 carilla sigue el cálculo normal.
  const isFrenchCriminalRecord =
    document_type.specific_type === "criminal_record" &&
    foreignLang === "fr" &&
    document_metrics.pages >= 3;

  let basePrice: number;
  let wordPrice: number;
  let effectiveRate = rate;
  let fixedPriceApplied = false;

  if (isFrenchCriminalRecord) {
    basePrice = FRENCH_CRIMINAL_RECORD_PRICE + apostilleSurcharge;
    wordPrice = FRENCH_CRIMINAL_RECORD_PRICE;
    effectiveRate = 0;
    fixedPriceApplied = true;
  } else if (isMorocco && moroccoFixedPrice !== undefined) {
    basePrice = moroccoFixedPrice + apostilleSurcharge;
    wordPrice = moroccoFixedPrice;
    effectiveRate = 0;
    fixedPriceApplied = true;
  } else {
    wordPrice = document_metrics.estimated_words * rate * complexityMult;
    basePrice = Math.max(wordPrice, minimum) + apostilleSurcharge;
  }

  const estimatedDays = getEstimatedDays(
    document_type.specific_type,
    document_metrics.pages,
    document_metrics.estimated_words
  );

  const roundedBase = round2(basePrice);
  const roundedUrgent = round2(basePrice * URGENCY_MULTIPLIER);

  return {
    basePrice: roundedBase,
    urgentPrice: roundedUrgent,
    totalPrice: round2(roundedBase * (1 + VAT_RATE)),
    urgentTotalPrice: round2(roundedUrgent * (1 + VAT_RATE)),
    estimatedDaysStandard: estimatedDays.standard,
    estimatedDaysUrgent: estimatedDays.urgent,
    breakdown: {
      words: document_metrics.estimated_words,
      ratePerWord: effectiveRate,
      wordSubtotal: round2(wordPrice),
      minimumApplied: !fixedPriceApplied && wordPrice < minimum,
      minimumAmount: minimum,
      complexityMultiplier: complexityMult,
      apostilleSurcharge,
      ivaRate: VAT_RATE,
      ivaAmount: round2(roundedBase * VAT_RATE),
      standardDaysMin: estimatedDays.standardMin,
      standardDaysMax: estimatedDays.standardMax,
      urgentDaysMin: estimatedDays.urgentMin,
      urgentDaysMax: estimatedDays.urgentMax,
    },
  };
}
