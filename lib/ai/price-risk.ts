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
  | "suspicious_text" // capa de texto pegada/concatenada → conteo poco fiable
  | "bilingual_duplicate" // co-oficial ca/es: el conteo se divide /2 por una señal del modelo → revisar antes de cobrar
  | "oversized_estimate"; // documento extenso: el conteo es una EXTRAPOLACIÓN sobre una muestra, no una cuenta

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

// Por encima de estas páginas el camino de visión trunca el PDF y el conteo
// pasa a ser una extrapolación (mismo umbral que LARGE_DOC_THRESHOLD en
// lib/ai/run-analysis.ts y lib/ai/analyze-document.ts). Y este techo de palabras
// es el punto a partir del cual un error de estimación deja de ser calderilla:
// a tarifa normal son varios cientos de euros.
const EXTRAPOLATION_PAGES = 5;
const MAX_AUTO_WORDS = 3000;

// Una plantilla repetida N veces (multi-copia) produce DECENAS de trigramas
// distintos que reaparecen; el boilerplate normal de un contrato/expediente,
// pocos. Umbral 25: el 1099 real da 53; falsos positivos medidos ≤12.
const REPEATED_TEMPLATE_THRESHOLD = 25;

// Señal fiscal SOLO por texto/título, sin análisis IA completo. La usan flujos
// que no tienen el análisis de la puerta (estimador legado, gate server de
// /api/orders, que solo dispone del título del pedido).
export function matchesFiscalForm(text: string): boolean {
  return FISCAL_FORM_PATTERNS.some((re) => re.test(text || ""));
}

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

  // 4. Duplicado bilingüe co-oficial: cuando el conteo se ha dividido /2 porque
  //    el MODELO marcó is_bilingual_duplicate, el precio depende de una señal NO
  //    determinista. Un falso positivo (doc monolingüe largo mal marcado, o
  //    bilingüe de contenido distinto) infracobraría a mitad de precio sin red.
  //    No autotarificamos: el conteo /2 se muestra en el presupuesto, pero un
  //    humano confirma el precio antes de cobrar. Ver incidente Candela y #149.
  if (analysis.document_metrics?.is_bilingual_duplicate === true) {
    reasons.push("bilingual_duplicate");
  }

  // 5. Documento extenso: por encima de EXTRAPOLATION_PAGES el análisis NO ha
  //    contado el documento, ha extrapolado a partir de una muestra de las
  //    primeras páginas (ver LARGE_DOCUMENT_ADDENDUM y la extrapolación de
  //    analyze-document.ts). Esa cifra se mueve entre llamadas idénticas: medido
  //    27-ago-2026, la MISMA sentencia de 4 páginas dio entre 950 y 1.350
  //    palabras en 19 pasadas. Autotarificar sobre una estimación así es cobrar
  //    a ojo, y el error escala con el tamaño: el PDF real de 291 páginas
  //    (26-ago) se autotarificó en 24.552 € con el semáforo en verde.
  //    Aquí no se rechaza nada: se manda a presupuesto manual, que es donde
  //    debe estar un encargo de ese tamaño.
  const pages = analysis.document_metrics?.pages || 0;
  const words = analysis.document_metrics?.estimated_words || 0;
  if (pages > EXTRAPOLATION_PAGES || words > MAX_AUTO_WORDS) {
    reasons.push("oversized_estimate");
  }

  return { risky: reasons.length > 0, reasons };
}
