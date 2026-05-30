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

// Idioma del diagnóstico que ve el cliente. El contenido (no solo las
// etiquetas) se traduce: un francófono vive la promesa entera en su idioma.
export type DiagnosisLang = "es" | "fr";

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

function deliveryLabel(hours: number, lang: DiagnosisLang): string {
  if (lang === "fr") {
    if (hours <= 24) return "24 heures";
    if (hours <= 48) return "48 heures (2 jours ouvrés)";
    return "72 heures (3 jours ouvrés)";
  }
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

function swornStatement(direction: TranslationDirection, lang: DiagnosisLang): string {
  if (lang === "fr") {
    if (direction === "inbound") {
      return "Oui. Elle est signée et cachetée par un traducteur assermenté nommé par le MAEC (n° 3850) ; elle a pleine validité devant toute administration officielle en Espagne.";
    }
    return "Oui. Elle est réalisée par un traducteur assermenté nommé par le MAEC (n° 3850) ; grâce aux accords de reconnaissance, elle est valable devant les autorités du pays de destination sans devoir engager un autre traducteur sur place.";
  }
  if (direction === "inbound") {
    return "Sí. La firma y sella un traductor jurado nombrado por el MAEC (nº 3850); tiene plena validez ante cualquier organismo oficial en España.";
  }
  return "Sí. La realiza un traductor jurado nombrado por el MAEC (nº 3850); gracias a los acuerdos de reconocimiento, es válida ante las autoridades del país de destino sin necesidad de contratar otro traductor allí.";
}

// ── Validez ─────────────────────────────────────────────────────────
// La traducción jurada no caduca. El documento ORIGINAL sí puede tener
// un plazo de aceptación: dato sensible (YMYL), mensajes con matiz y
// remisión al organismo.

function swornValidity(lang: DiagnosisLang): string {
  if (lang === "fr") {
    return "La traduction assermentée n'expire pas : une fois émise, signée et cachetée, sa validité est illimitée.";
  }
  return "La traducción jurada no caduca: una vez emitida, firmada y sellada, su validez es indefinida.";
}

function originalDocumentValidity(specificType: string, lang: DiagnosisLang): string | null {
  if (lang === "fr") {
    switch (specificType) {
      case "criminal_record":
        return "Le casier judiciaire est généralement accepté avec une ancienneté maximale de 3 mois. Vérifiez le délai exigé par l'organisme de destination.";
      case "birth_certificate":
      case "marriage_certificate":
      case "death_certificate":
        return "L'acte en lui-même n'expire pas, mais de nombreuses démarches exigent un acte récent (délivré au cours des 3 à 6 derniers mois).";
      default:
        return null;
    }
  }
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
  quote: Quote,
  lang: DiagnosisLang = "es"
): Diagnosis {
  const { document_type, language, document_metrics } = analysis;

  const direction: TranslationDirection =
    language.source === "es" ? "outbound" : "inbound";
  const foreignLang = resolveForeignLang(language);

  const hours = foreignLang
    ? getDeliveryHours(foreignLang, document_metrics.pages || 1)
    : null;

  const pendingLabel =
    lang === "fr"
      ? "Délai à confirmer : indiquez-nous la langue de destination."
      : "Plazo pendiente: indícanos el idioma de destino.";
  const deliveryNote =
    lang === "fr"
      ? "à compter de la confirmation du paiement, en horaire ouvré"
      : "a partir de la confirmación del pago, en horario laborable";

  return {
    type: {
      specificType: document_type.specific_type,
      label: document_type.specific_type_es,
      category: document_type.category,
    },
    sworn: {
      required: true,
      direction,
      statement: swornStatement(direction, lang),
    },
    price: {
      base: quote.basePrice,
      total: quote.totalPrice,
      currency: "EUR",
    },
    delivery: {
      hours,
      label: hours ? deliveryLabel(hours, lang) : pendingLabel,
      note: deliveryNote,
    },
    validity: {
      swornTranslation: swornValidity(lang),
      originalDocument: originalDocumentValidity(document_type.specific_type, lang),
    },
  };
}

// ── Fecha de entrega y cumplimiento del plazo del cliente ───────────
// La puerta pregunta "¿para cuándo lo necesitas?" y el diagnóstico
// confirma si el plazo determinista llega a esa fecha.

// Suma N días laborables (lunes-viernes) a una fecha.
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return result;
}

// Estima la fecha de entrega a partir del plazo en horas.
// 24 h → 1 día laborable · 48 h → 2 · 72 h → 3.
export function estimateDeliveryDate(
  deliveryHours: number,
  from: Date = new Date()
): Date {
  return addBusinessDays(from, Math.max(1, Math.ceil(deliveryHours / 24)));
}

// ¿La entrega estimada llega a la fecha que pide el cliente?
// Compara por día natural: la hora del día es irrelevante para el cliente.
export function meetsDeadline(
  deliveryHours: number,
  neededBy: Date,
  from: Date = new Date()
): boolean {
  const estimate = estimateDeliveryDate(deliveryHours, from);
  const estDay = Date.UTC(estimate.getFullYear(), estimate.getMonth(), estimate.getDate());
  const needDay = Date.UTC(neededBy.getFullYear(), neededBy.getMonth(), neededBy.getDate());
  return estDay <= needDay;
}
