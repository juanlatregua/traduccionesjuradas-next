// lib/ai/extract-data.ts — Extracción de datos clave (wrapper)

import type { DocumentAnalysisResult } from "./analyze-document";
import { censorExtractedNames } from "./analyze-document";

export type ExtractedData = {
  names: string[];
  namesCensored: string[];
  dates: string[];
  referenceNumbers: string[];
  institutions: string[];
  notes: string;
};

/**
 * Extrae los datos clave del resultado de análisis IA.
 * Los nombres se devuelven censurados para RGPD.
 */
export function extractData(analysis: DocumentAnalysisResult): ExtractedData {
  const names = analysis.extracted_data.names || [];
  return {
    names,
    namesCensored: censorExtractedNames(names),
    dates: analysis.extracted_data.dates || [],
    referenceNumbers: analysis.extracted_data.reference_numbers || [],
    institutions: analysis.extracted_data.institutions || [],
    notes: analysis.extracted_data.notes || "",
  };
}
