// lib/pricing-engine/calculator.ts — Motor de cálculo de precios

import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { getRate } from "./languages.ts";
import {
  getMinimum,
  getPageMinimum,
  getComplexityMultiplier,
  getApostilleSurcharge,
  URGENCY_MULTIPLIER,
  MOROCCO_PRICING,
  FRENCH_CRIMINAL_RECORD_PRICE,
} from "./rules.ts";

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

// ── Fórmula pura por métricas ───────────────────────────────────────
// Fuente única del precio base: la usa calculatePrice (sobre el análisis IA) y
// el builder de staff para RE-pricear una línea cuando cambia el idioma
// destino del expediente (sin re-analizar). foreignLang = lado no-español del
// par (resolvePriceablePair); quien llama garantiza que el par es válido.

export type PriceMetricsInput = {
  specificType: string;
  foreignLang: string;
  words: number;
  pages: number;
  complexity?: string;
  countryCode?: string | null;
  hasApostille?: boolean;
};

export function computeBase(input: PriceMetricsInput): {
  basePrice: number;
  wordPrice: number;
  effectiveRate: number;
  minimum: number;
  complexityMult: number;
  apostilleSurcharge: number;
  fixedPriceApplied: boolean;
} {
  const { specificType, foreignLang, words, pages } = input;
  const rate = getRate(foreignLang);
  // El suelo efectivo es el mayor de: mínimo por tipo, mínimo por idioma y
  // suelo por página (40 €/pág, salvo certificados simples exentos).
  const minimum = Math.max(getMinimum(specificType, foreignLang), getPageMinimum(specificType, pages));
  const complexityMult = getComplexityMultiplier(input.complexity || "standard");

  // Apostille surcharge: fijo según idioma (árabe 10€, resto 25€)
  const apostilleSurcharge = input.hasApostille ? getApostilleSurcharge(foreignLang) : 0;

  // Morocco special pricing: solo aplica a francés (no árabe)
  const isMorocco = input.countryCode === "MA" && foreignLang !== "ar";
  const moroccoMaxPage = Math.max(...Object.keys(MOROCCO_PRICING).map(Number));
  const moroccoFixedPrice = isMorocco
    ? MOROCCO_PRICING[Math.min(pages, moroccoMaxPage)] ?? MOROCCO_PRICING[moroccoMaxPage]
    : undefined;

  // Penales franceses con formulario multilingüe UE (Bulletin n°3 de ~5 páginas):
  // el anexo distorsiona el conteo. La versión de 1 carilla sigue el cálculo normal.
  const isFrenchCriminalRecord =
    specificType === "criminal_record" && foreignLang === "fr" && pages >= 3;

  if (isFrenchCriminalRecord) {
    return {
      basePrice: FRENCH_CRIMINAL_RECORD_PRICE + apostilleSurcharge,
      wordPrice: FRENCH_CRIMINAL_RECORD_PRICE,
      effectiveRate: 0, minimum, complexityMult, apostilleSurcharge, fixedPriceApplied: true,
    };
  }
  if (isMorocco && moroccoFixedPrice !== undefined) {
    return {
      basePrice: moroccoFixedPrice + apostilleSurcharge,
      wordPrice: moroccoFixedPrice,
      effectiveRate: 0, minimum, complexityMult, apostilleSurcharge, fixedPriceApplied: true,
    };
  }
  const wordPrice = words * rate * complexityMult;
  return {
    basePrice: Math.max(wordPrice, minimum) + apostilleSurcharge,
    wordPrice,
    effectiveRate: rate, minimum, complexityMult, apostilleSurcharge, fixedPriceApplied: false,
  };
}

/**
 * Calcula el presupuesto a partir del análisis IA
 */
export function calculatePrice(analysis: DocumentAnalysisResult): Quote {
  const { document_type, language, document_metrics, complexity, country, requirements } = analysis;

  // Use the "foreign" language rate (non-Spanish side of the pair).
  // OJO: conserva el fallback histórico (es→unknown cae al propio "es" con
  // DEFAULT_RATE) para no romper llamadores internos (post-mortem, chat). El
  // GATE de negocio vive en los BORDES con resolvePriceablePair (languages.ts):
  // cualquier borde nuevo debe gatear ahí ANTES de mostrar/cobrar este precio
  // (presupuesto 2026-00045: es→unknown tarificado en silencio).
  const foreignLang =
    language.source === "es" && language.target && language.target !== "unknown"
      ? language.target
      : language.source;

  const {
    basePrice,
    wordPrice,
    effectiveRate,
    minimum,
    complexityMult,
    apostilleSurcharge,
    fixedPriceApplied,
  } = computeBase({
    specificType: document_type.specific_type,
    foreignLang,
    words: document_metrics.estimated_words,
    pages: document_metrics.pages,
    complexity: complexity.level,
    countryCode: country?.origin,
    hasApostille: requirements?.has_apostille,
  });

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
