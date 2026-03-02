// lib/ai/estimate-complexity.ts — Estimación de complejidad (wrapper)

import type { DocumentAnalysisResult } from "./analyze-document";

export type ComplexityEstimation = {
  level: "standard" | "complex" | "highly_complex";
  reasons: string[];
  estimatedHours: number;
};

/**
 * Extrae la estimación de complejidad del análisis IA
 */
export function estimateComplexity(analysis: DocumentAnalysisResult): ComplexityEstimation {
  return {
    level: analysis.complexity.level,
    reasons: analysis.complexity.reasons || [],
    estimatedHours: analysis.complexity.estimated_hours,
  };
}

/**
 * Label de complejidad en español
 */
export function getComplexityLabel(level: string): string {
  switch (level) {
    case "standard":
      return "Estándar";
    case "complex":
      return "Complejo";
    case "highly_complex":
      return "Muy complejo";
    default:
      return "Estándar";
  }
}
