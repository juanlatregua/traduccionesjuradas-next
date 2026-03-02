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

/**
 * Mapea el specific_type a un nombre legible en español
 */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  birth_certificate: "Certificado de nacimiento",
  marriage_certificate: "Certificado de matrimonio",
  death_certificate: "Certificado de defunción",
  divorce_decree: "Sentencia de divorcio",
  criminal_record: "Antecedentes penales",
  passport: "Pasaporte",
  id_card: "Documento de identidad",
  degree: "Título académico",
  transcript: "Expediente académico",
  contract: "Contrato",
  power_of_attorney: "Poder notarial",
  company_registration: "Registro mercantil",
  payslip: "Nómina",
  tax_return: "Declaración fiscal",
  medical_report: "Informe médico",
  apostille: "Apostilla",
  other: "Otro documento",
};

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
