// lib/diagnosis.ts — Diagnóstico completo de la puerta (v2 · Fase 1)
//
// Deriva las 5 cosas que el cliente ve tras subir un documento:
//   tipo · ¿necesita jurada? · precio · plazo · validez
//
// Es una función pura sobre el análisis IA ya existente: no llama a Claude
// ni toca la BD. La puerta (Bloque 1.2) la consume; el motor la devuelve.

import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";
import { isAutoPriceable } from "@/lib/pricing-engine/languages";
import { clientPriceFromCost, round2, DEFAULT_VAT_RATE } from "@/lib/quote-math";
import type { Locale } from "@/lib/i18n/locales";

// inbound  = documento extranjero → español (uso en España)
// outbound = documento español → idioma extranjero (uso en el país de destino)
export type TranslationDirection = "inbound" | "outbound";

// Idioma del diagnóstico que ve el cliente. El contenido (no solo las
// etiquetas) se traduce: cada cliente vive la promesa entera en su idioma.
//
// Regla de dos niveles: el nº 3850 es la acreditación FRANCESA de Juan; da
// autoridad en es/fr pero sería impreciso en en/de/pt (otro documento lo jura
// el traductor acreditado correspondiente). Por eso en en/de/pt la autoridad es
// genérica: "acreditado/nombrado por el MAEC", sin número.
export type DiagnosisLang = Locale;

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
  // false = idioma fuera del set auto-tarificable (ruso, ucraniano, etc.): no se
  // muestra precio instantáneo ni se permite checkout; se enruta a manual.
  autoPriceable: boolean;
  // true = documento de riesgo de infraconteo (fiscal/financiero, multi-copia):
  // se enruta a presupuesto manual con un mensaje DISTINTO al de "elige idioma".
  priceRisky: boolean;
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

const DELIVERY_LABELS: Record<DiagnosisLang, { h24: string; h48: string; h72: string }> = {
  es: { h24: "24 horas", h48: "48 horas (2 días laborables)", h72: "72 horas (3 días laborables)" },
  fr: { h24: "24 heures", h48: "48 heures (2 jours ouvrés)", h72: "72 heures (3 jours ouvrés)" },
  en: { h24: "24 hours", h48: "48 hours (2 business days)", h72: "72 hours (3 business days)" },
  de: { h24: "24 Stunden", h48: "48 Stunden (2 Werktage)", h72: "72 Stunden (3 Werktage)" },
  pt: { h24: "24 horas", h48: "48 horas (2 dias úteis)", h72: "72 horas (3 dias úteis)" },
};

function deliveryLabel(hours: number, lang: DiagnosisLang): string {
  const l = DELIVERY_LABELS[lang];
  if (hours <= 24) return l.h24;
  if (hours <= 48) return l.h48;
  return l.h72;
}

// ── Idioma extranjero del par ───────────────────────────────────────
// Mismo criterio que pricing-engine/calculator.ts: el lado no-español.
// Devuelve null cuando el original está en español y el destino aún no
// se ha determinado (la puerta lo pregunta antes del diagnóstico).

export function resolveForeignLang(language: DocumentAnalysisResult["language"]): string | null {
  if (language.source && language.source !== "es") return language.source;
  if (language.target && language.target !== "es" && language.target !== "unknown") {
    return language.target;
  }
  return null;
}

// ── ¿Necesita jurada? ───────────────────────────────────────────────
// Siempre sí para documentos oficiales. El valor añadido es la frase de
// validez según la dirección de la traducción.

const SWORN_STATEMENT: Record<DiagnosisLang, { inbound: string; outbound: string }> = {
  es: {
    inbound: "Sí. La firma y sella un traductor jurado nombrado por el MAEC (nº 3850); tiene plena validez ante cualquier organismo oficial en España.",
    outbound: "Sí. La realiza un traductor jurado nombrado por el MAEC (nº 3850); gracias a los acuerdos de reconocimiento, es válida ante las autoridades del país de destino sin necesidad de contratar otro traductor allí.",
  },
  fr: {
    inbound: "Oui. Elle est signée et cachetée par un traducteur assermenté nommé par le MAEC (n° 3850) ; elle a pleine validité devant toute administration officielle en Espagne.",
    outbound: "Oui. Elle est réalisée par un traducteur assermenté nommé par le MAEC (n° 3850) ; grâce aux accords de reconnaissance, elle est valable devant les autorités du pays de destination sans devoir engager un autre traducteur sur place.",
  },
  en: {
    inbound: "Yes. It's signed and stamped by a sworn translator appointed by Spain's Ministry of Foreign Affairs (MAEC); it is fully valid before any official body in Spain.",
    outbound: "Yes. It's produced by a sworn translator appointed by Spain's Ministry of Foreign Affairs (MAEC); thanks to recognition agreements, it is valid before the authorities of the destination country without needing to hire another translator there.",
  },
  de: {
    inbound: "Ja. Sie wird von einem vom spanischen Außenministerium (MAEC) ermächtigten vereidigten Übersetzer unterschrieben und gestempelt; sie ist vor jeder Behörde in Spanien voll gültig.",
    outbound: "Ja. Sie wird von einem vom spanischen Außenministerium (MAEC) ermächtigten vereidigten Übersetzer angefertigt; dank der Anerkennungsabkommen ist sie bei den Behörden des Ziellandes gültig, ohne dass Sie dort einen weiteren Übersetzer beauftragen müssen.",
  },
  pt: {
    inbound: "Sim. É assinada e carimbada por um tradutor ajuramentado nomeado pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC); tem plena validade perante qualquer organismo oficial em Espanha.",
    outbound: "Sim. É realizada por um tradutor ajuramentado nomeado pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC); graças aos acordos de reconhecimento, é válida perante as autoridades do país de destino sem necessidade de contratar outro tradutor lá.",
  },
};

function swornStatement(direction: TranslationDirection, lang: DiagnosisLang): string {
  return SWORN_STATEMENT[lang][direction];
}

// ── Validez ─────────────────────────────────────────────────────────
// La traducción jurada no caduca. El documento ORIGINAL sí puede tener
// un plazo de aceptación: dato sensible (YMYL), mensajes con matiz y
// remisión al organismo.

const SWORN_VALIDITY: Record<DiagnosisLang, string> = {
  es: "La traducción jurada no caduca: una vez emitida, firmada y sellada, su validez es indefinida.",
  fr: "La traduction assermentée n'expire pas : une fois émise, signée et cachetée, sa validité est illimitée.",
  en: "A sworn translation doesn't expire: once issued, signed and stamped, its validity is unlimited.",
  de: "Eine beglaubigte Übersetzung verfällt nicht: einmal ausgestellt, unterschrieben und gestempelt, ist sie unbegrenzt gültig.",
  pt: "A tradução certificada não caduca: uma vez emitida, assinada e carimbada, a sua validade é indefinida.",
};

function swornValidity(lang: DiagnosisLang): string {
  return SWORN_VALIDITY[lang];
}

const ORIGINAL_VALIDITY: Record<DiagnosisLang, { criminalRecord: string; civilCertificate: string }> = {
  es: {
    criminalRecord: "El certificado de antecedentes penales suele aceptarse con una antigüedad máxima de 3 meses. Confirma el plazo que te exige el organismo de destino.",
    civilCertificate: "El acta en sí no caduca, pero muchos trámites piden un certificado literal reciente (emitido en los últimos 3-6 meses).",
  },
  fr: {
    criminalRecord: "Le casier judiciaire est généralement accepté avec une ancienneté maximale de 3 mois. Vérifiez le délai exigé par l'organisme de destination.",
    civilCertificate: "L'acte en lui-même n'expire pas, mais de nombreuses démarches exigent un acte récent (délivré au cours des 3 à 6 derniers mois).",
  },
  en: {
    criminalRecord: "A criminal record certificate is usually accepted if issued within the last 3 months. Check the time limit required by the destination body.",
    civilCertificate: "The certificate itself doesn't expire, but many procedures require a recent full certificate (issued within the last 3–6 months).",
  },
  de: {
    criminalRecord: "Ein Führungszeugnis wird in der Regel mit einem Höchstalter von 3 Monaten akzeptiert. Prüfen Sie die von der Zielbehörde geforderte Frist.",
    civilCertificate: "Die Urkunde selbst verfällt nicht, aber viele Verfahren verlangen eine aktuelle vollständige Urkunde (in den letzten 3–6 Monaten ausgestellt).",
  },
  pt: {
    criminalRecord: "A certidão de antecedentes criminais costuma ser aceite com uma antiguidade máxima de 3 meses. Confirme o prazo exigido pelo organismo de destino.",
    civilCertificate: "A certidão em si não caduca, mas muitos processos exigem uma certidão de cópia integral recente (emitida nos últimos 3-6 meses).",
  },
};

function originalDocumentValidity(specificType: string, lang: DiagnosisLang): string | null {
  const v = ORIGINAL_VALIDITY[lang];
  switch (specificType) {
    case "criminal_record":
      return v.criminalRecord;
    case "birth_certificate":
    case "marriage_certificate":
    case "death_certificate":
      return v.civilCertificate;
    default:
      return null;
  }
}

// ── Etiqueta del tipo de documento por idioma ───────────────────────
// El análisis IA solo devuelve `specific_type_es`; estos mapas traducen los
// tipos oficiales frecuentes. Fallback a la etiqueta española si el tipo no
// está mapeado (mejor un nombre que un hueco).
export const TYPE_LABELS: Record<DiagnosisLang, Record<string, string>> = {
  es: {},
  fr: {
    birth_certificate: "Acte de naissance",
    marriage_certificate: "Acte de mariage",
    death_certificate: "Acte de décès",
    criminal_record: "Casier judiciaire",
    divorce_decree: "Jugement de divorce",
    power_of_attorney: "Procuration",
    transcript: "Relevé de notes",
    degree: "Diplôme",
    medical_report: "Rapport médical",
    tax_return: "Déclaration fiscale",
    contract: "Contrat",
    company_registration: "Immatriculation de société",
    payslip: "Bulletin de salaire",
    id_card: "Carte d'identité",
    passport: "Passeport",
    apostille: "Apostille",
  },
  en: {
    birth_certificate: "Birth certificate",
    marriage_certificate: "Marriage certificate",
    death_certificate: "Death certificate",
    criminal_record: "Criminal record certificate",
    divorce_decree: "Divorce decree",
    power_of_attorney: "Power of attorney",
    transcript: "Academic transcript",
    degree: "Degree certificate",
    medical_report: "Medical report",
    tax_return: "Tax return",
    contract: "Contract",
    company_registration: "Company registration",
    payslip: "Payslip",
    id_card: "ID card",
    passport: "Passport",
    apostille: "Apostille",
  },
  de: {
    birth_certificate: "Geburtsurkunde",
    marriage_certificate: "Heiratsurkunde",
    death_certificate: "Sterbeurkunde",
    criminal_record: "Führungszeugnis",
    divorce_decree: "Scheidungsurteil",
    power_of_attorney: "Vollmacht",
    transcript: "Notenübersicht",
    degree: "Hochschulabschluss",
    medical_report: "Ärztlicher Bericht",
    tax_return: "Steuererklärung",
    contract: "Vertrag",
    company_registration: "Handelsregisterauszug",
    payslip: "Gehaltsabrechnung",
    id_card: "Personalausweis",
    passport: "Reisepass",
    apostille: "Apostille",
  },
  pt: {
    birth_certificate: "Certidão de nascimento",
    marriage_certificate: "Certidão de casamento",
    death_certificate: "Certidão de óbito",
    criminal_record: "Certidão de antecedentes criminais",
    divorce_decree: "Sentença de divórcio",
    power_of_attorney: "Procuração",
    transcript: "Histórico escolar",
    degree: "Diploma",
    medical_report: "Relatório médico",
    tax_return: "Declaração fiscal",
    contract: "Contrato",
    company_registration: "Registo comercial",
    payslip: "Recibo de vencimento",
    id_card: "Cartão de cidadão",
    passport: "Passaporte",
    apostille: "Apostila",
  },
};

function typeLabel(specificType: string, specificTypeEs: string, lang: DiagnosisLang): string {
  return TYPE_LABELS[lang][specificType] || specificTypeEs;
}

// ── Plazo pendiente / nota de entrega por idioma ────────────────────
const PENDING_LABEL: Record<DiagnosisLang, string> = {
  es: "Plazo pendiente: indícanos el idioma de destino.",
  fr: "Délai à confirmer : indiquez-nous la langue de destination.",
  en: "Delivery time pending: tell us the target language.",
  de: "Lieferzeit ausstehend: Geben Sie uns die Zielsprache an.",
  pt: "Prazo pendente: indique-nos o idioma de destino.",
};

const DELIVERY_NOTE: Record<DiagnosisLang, string> = {
  es: "a partir de la confirmación del pago, en horario laborable",
  fr: "à compter de la confirmation du paiement, en horaire ouvré",
  en: "from payment confirmation, during business hours",
  de: "ab Zahlungsbestätigung, während der Geschäftszeiten",
  pt: "a partir da confirmação do pagamento, em horário útil",
};

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
  // No autotarificable si el idioma no lo permite O si el documento es de riesgo
  // de infraconteo (fiscal/financiero, multi-copia, texto pegado): en ese caso
  // se manda a presupuesto manual en vez de cobrar mal (incidente 1099-MISC).
  const autoPriceable = isAutoPriceable(foreignLang) && !analysis.price_risk?.risky;

  // Sin plazo determinista para idiomas no auto-tarificables: no anunciamos
  // "72h" de un idioma que se gestiona manualmente (o que no ofrecemos).
  const hours =
    foreignLang && autoPriceable
      ? getDeliveryHours(foreignLang, document_metrics.pages || 1)
      : null;

  const clientBase = clientPriceFromCost(quote.basePrice, foreignLang);

  return {
    type: {
      specificType: document_type.specific_type,
      label: typeLabel(document_type.specific_type, document_type.specific_type_es, lang),
      category: document_type.category,
    },
    sworn: {
      required: true,
      direction,
      statement: swornStatement(direction, lang),
    },
    // El motor da el COSTE; el cliente paga coste × (1 + margen tiered) salvo
    // francés (sin margen). El IVA se aplica encima. Ver lib/quote-math.ts.
    price: {
      base: clientBase,
      total: round2(clientBase * (1 + DEFAULT_VAT_RATE)),
      currency: "EUR",
    },
    delivery: {
      hours,
      label: hours ? deliveryLabel(hours, lang) : PENDING_LABEL[lang],
      note: DELIVERY_NOTE[lang],
    },
    validity: {
      swornTranslation: swornValidity(lang),
      originalDocument: originalDocumentValidity(document_type.specific_type, lang),
    },
    autoPriceable,
    priceRisky: Boolean(analysis.price_risk?.risky),
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
