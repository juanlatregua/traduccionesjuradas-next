// lib/ai/price-risk.ts — Red de seguridad de autotarificación.
//
// Algunos documentos hacen que el conteo automático de palabras infracuente y,
// por tanto, el motor infracobre (incidente 1099-MISC: 8 copias del formulario
// tiladas en 1 página → 898 palabras contadas vs 2.738 reales → cobro a 1/3).
// Esta función detecta esos documentos "de riesgo" para NO autotarificarlos:
// la puerta los manda a presupuesto manual (WhatsApp) en vez de cobrar mal.
//
// Calibrada para MINIMIZAR falsos positivos (mandar un documento legítimo a
// WhatsApp = venta perdida): solo dispara con señales FUERTES, no con palabras
// genéricas ("fiscal", "tax", "NIF") que aparecen en documentación oficial
// normal, ni con boilerplate repetido de contratos/expedientes.
// Mismo espíritu que isAutoPriceable() por idioma, pero por TIPO/forma del
// documento. Función pura → testeable y reutilizable en cliente y servidor.

import type { DocumentAnalysisResult } from "./analyze-document";

export type PriceRiskReason =
  | "fiscal_financial" // formulario fiscal/financiero (denso, multi-casilla)
  | "repeated_copies" // la MISMA plantilla repetida N veces (multi-copia)
  | "suspicious_text"; // capa de texto pegada/concatenada → conteo poco fiable

export type PriceRisk = { risky: boolean; reasons: PriceRiskReason[] };

// Tipos del clasificador que casi siempre infracuentan.
const FISCAL_SPECIFIC_TYPES = new Set(["tax_return", "payslip", "company_registration"]);

// SOLO identificadores específicos de formularios fiscales. NO usamos palabras
// genéricas ("tax", "fiscal", "impuesto", "NIF", "modelo N"): aparecen en
// certificados, escrituras y contratos perfectamente autotarificables (el NIF
// es el "Número de Identificación FISCAL" de casi todo documento español).
const FISCAL_FORM_PATTERNS: RegExp[] = [
  /\b1099[-\s]?(misc|nec|int|div|r|k|g|b|c|s)\b/i, // 1099-MISC, 1099-NEC...
  /\bform\s?1040\b/i, // formulario 1040 (US)
  /\bw[-\s]?[2349]\b/i, // W-2, W-3, W-4, W-9
  /\bp(60|45|11d)\b/i, // P60/P45/P11D (UK)
  // Modelos tributarios españoles REALES (no "modelo 3 del coche").
  /\bmodelo\s?(030|036|037|10[0-9]|111|11[35]|123|13[0-1]|18[04]|190|20[02]|303|34[79]|390|714|720)\b/i,
];

// Una plantilla repetida N veces (multi-copia) produce DECENAS de trigramas
// distintos que reaparecen; el boilerplate normal de un contrato/expediente,
// pocos. Umbral 25: el 1099 real da 53; falsos positivos medidos ≤12.
const REPEATED_TEMPLATE_THRESHOLD = 25;

function repeatedTemplateScore(text: string): number {
  const words = text.toLowerCase().match(/[\p{L}]{3,}/gu) || [];
  if (words.length < 30) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i + 3 <= words.length; i++) {
    const key = words.slice(i, i + 3).join(" ");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let repeated = 0;
  for (const c of counts.values()) if (c >= 4) repeated++;
  return repeated;
}

export function assessAutoPriceRisk(input: {
  analysis: DocumentAnalysisResult;
  extractedText?: string;
  fileName?: string;
}): PriceRisk {
  const { analysis } = input;
  const reasons: PriceRiskReason[] = [];

  const text = (input.extractedText || analysis.document_metrics?.extracted_text || "").slice(0, 50_000);
  const haystack = [
    input.fileName || "",
    analysis.document_type?.specific_type || "",
    analysis.document_type?.specific_type_es || "",
    text.slice(0, 3000),
  ].join(" ");

  // 1. Fiscal/financiero: por clasificación (fiable) o por identificador de
  //    formulario específico (1099-MISC, W-2, modelo 303...). NO por palabras
  //    sueltas tipo "fiscal"/"tax"/"NIF".
  if (
    analysis.document_type?.category === "financial" ||
    FISCAL_SPECIFIC_TYPES.has(analysis.document_type?.specific_type || "") ||
    FISCAL_FORM_PATTERNS.some((re) => re.test(haystack))
  ) {
    reasons.push("fiscal_financial");
  }

  // 2. Copias repetidas: muchos trigramas distintos reapareciendo = la misma
  //    plantilla varias veces. Discrimina multi-copia (1099=53) de boilerplate
  //    normal (contrato 12, expediente 10, certificado plurilingüe 0).
  if (text && repeatedTemplateScore(text) >= REPEATED_TEMPLATE_THRESHOLD) {
    reasons.push("repeated_copies");
  }

  // 3. Texto sospechoso: capa de texto pegada (p.ej. "1Rents2RoyaltiesInstr...")
  //    → el conteo de palabras miente. Umbral alto (>15%) para no penalizar
  //    alemán (palabras compuestas largas) ni URLs/IBAN sueltos.
  if (text) {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length >= 40) {
      const glued = tokens.filter((t) => t.length > 25).length;
      if (glued / tokens.length > 0.15) reasons.push("suspicious_text");
    }
  }

  return { risky: reasons.length > 0, reasons };
}
