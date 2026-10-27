// lib/ai/classify-document.ts — Clasificación de documentos (wrapper)

import type { DocumentAnalysisResult } from "./analyze-document";

export type DocumentClassification = {
  category: string;
  specificType: string;
  specificTypeEs: string;
  specificTypeFr?: string;
  confidence: number;
};

/**
 * Extrae solo la clasificación del resultado completo de análisis IA
 */
export function classifyDocument(analysis: DocumentAnalysisResult): DocumentClassification {
  return {
    category: analysis.document_type.category,
    specificType: analysis.document_type.specific_type,
    specificTypeEs: analysis.document_type.specific_type_es,
    specificTypeFr: analysis.document_type.specific_type_fr,
    confidence: analysis.document_type.confidence,
  };
}

export { DOCUMENT_TYPE_LABELS } from "@/lib/document-labels";

/**
 * Mapea la categoría a un icono Lucide
 */
export const CATEGORY_ICONS: Record<string, string> = {
  civil_registry: "FileText",
  identity: "CreditCard",
  academic: "GraduationCap",
  legal: "Scale",
  financial: "Landmark",
  labor: "Briefcase",
  immigration: "Globe",
  medical: "Heart",
  other: "File",
};
