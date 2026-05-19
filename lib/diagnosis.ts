// lib/diagnosis.ts — Diagnóstico completo de la puerta (v2 · Fase 1)
//
// Deriva las 5 cosas que el cliente ve tras subir un documento:
//   tipo · ¿necesita jurada? · precio · plazo · validez
//
// Es una función pura sobre el análisis IA ya existente: no llama a Claude
// ni toca la BD. La puerta (Bloque 1.2) la consume; el motor la devuelve.

import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";

// inbound  = documento extranjero → español (uso en España)
// outbound = documento español → idioma extranjero (uso en el país de destino)
export type TranslationDirection = "inbound" | "outbound";

export type Diagnosis = {
  type: {
    specificType: string;
    label: string;
    category: string;
  };
  sworn: {
    required: boolean;
    direction: TranslationDirection;
    statement: string;
  };
  price: {
    base: number;
    total: number;
    currency: "EUR";
  };
  delivery: {
    hours: number | null;
    label: string;
    note: string;
  };
  validity: {
    swornTranslation: string;
    originalDocument: string | null;
  };
};

// ── Plazo de entrega ────────────────────────────────────────────────
// Horas desde la confirmación del pago. Tabla decidida en
// docs/v2-fase1-plan.md (reglas de negocio). Determinista por
// (idioma extranjero, nº de páginas).

const AUTOMATED_48H = new Set(["de", "en", "pt", "it"]);

export function getDeliveryHours(foreignLang: string, pages: number): number {
  if (foreignLang === "fr") return pages <= 2 ? 24 : 48;
  if (AUTOMATED_48H.has(foreignLang)) return 48;
  // árabe y resto de idiomas (gestión manual): plazo conservador
  return 72;
}

function deliveryLabel(hours: number): string {
  if (hours <= 24) return "24 horas";
  if (hours <= 48) return "48 horas (2 días laborables)";
  return "72 horas (3 días laborables)";
}

// ── Idioma extranjero del par ───────────────────────────────────────
// Mismo criterio que pricing-engine/calculator.ts: el lado no-español.
// Devuelve null cuando el original está en español y el destino aún no
// se ha determinado (la puerta lo pregunta antes del diagnóstico).

function resolveForeignLang(language: DocumentAnalysisResult["language"]): string | null {
  if (language.source && language.source !== "es") return language.source;
  if (language.target && language.target !== "es" && language.target !== "unknown") {
    return language.target;
  }
  return null;
}

// ── ¿Necesita jurada? ───────────────────────────────────────────────
// Siempre sí para documentos oficiales. El valor añadido es la frase de
// validez según la dirección de la traducción.

function swornStatement(direction: TranslationDirection): string {
  if (direction === "inbound") {
    return "Sí. La firma y sella un traductor jurado nombrado por el MAEC (nº 3850); tiene plena validez ante cualquier organismo oficial en España.";
  }
  return "Sí. La realiza un traductor jurado nombrado por el MAEC (nº 3850); gracias a los acuerdos de reconocimiento, es válida ante las autoridades del país de destino sin necesidad de contratar otro traductor allí.";
}

// ── Validez ─────────────────────────────────────────────────────────
// La traducción jurada no caduca. El documento ORIGINAL sí puede tener
// un plazo de aceptación: dato sensible (YMYL), mensajes con matiz y
// remisión al organismo.

const SWORN_VALIDITY =
  "La traducción jurada no caduca: una vez emitida, firmada y sellada, su validez es indefinida.";

function originalDocumentValidity(specificType: string): string | null {
  switch (specificType) {
    case "criminal_record":
      return "El certificado de antecedentes penales suele aceptarse con una antigüedad máxima de 3 meses. Confirma el plazo que te exige el organismo de destino.";
    case "birth_certificate":
    case "marriage_certificate":
    case "death_certificate":
      return "El acta en sí no caduca, pero muchos trámites piden un certificado literal reciente (emitido en los últimos 3-6 meses).";
    default:
      return null;
  }
}

// ── Construcción del diagnóstico ────────────────────────────────────

export function buildDiagnosis(
  analysis: DocumentAnalysisResult,
  quote: Quote
): Diagnosis {
  const { document_type, language, document_metrics } = analysis;

  const direction: TranslationDirection =
    language.source === "es" ? "outbound" : "inbound";
  const foreignLang = resolveForeignLang(language);

  const hours = foreignLang
    ? getDeliveryHours(foreignLang, document_metrics.pages || 1)
    : null;

  return {
    type: {
      specificType: document_type.specific_type,
      label: document_type.specific_type_es,
      category: document_type.category,
    },
    sworn: {
      required: true,
      direction,
      statement: swornStatement(direction),
    },
    price: {
      base: quote.basePrice,
      total: quote.totalPrice,
      currency: "EUR",
    },
    delivery: {
      hours,
      label: hours
        ? deliveryLabel(hours)
        : "Plazo pendiente: indícanos el idioma de destino.",
      note: "a partir de la confirmación del pago, en horario laborable",
    },
    validity: {
      swornTranslation: SWORN_VALIDITY,
      originalDocument: originalDocumentValidity(document_type.specific_type),
    },
  };
}
