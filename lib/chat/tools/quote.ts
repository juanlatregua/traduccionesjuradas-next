import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { calculatePrice, VAT_RATE } from "../../pricing-engine/calculator.ts";
import {
  getRate,
  getLanguageName,
  AUTO_PRICEABLE_FOREIGN,
} from "../../pricing-engine/languages.ts";
import { clientPriceFromCost, round2 } from "../../quote-math.ts";
import { getMinimum, getApostilleSurcharge } from "../../pricing-engine/rules.ts";

export type QuoteEstimateInput = {
  language: string;
  document_type?: string;
  pages?: number;
  estimated_words?: number;
  has_apostille?: boolean;
  country?: string;
};

export type QuoteEstimateOutput = {
  language: string;
  language_name: string;
  document_type: string;
  pages: number;
  estimated_words: number;
  minimum_price_eur: number;
  rate_per_word_eur: number;
  apostille_surcharge_eur: number;
  base_price_eur: number;
  base_price_with_vat_eur: number;
  urgent_price_eur: number;
  urgent_price_with_vat_eur: number;
  estimated_delivery_standard: string;
  estimated_delivery_urgent: string;
  is_french_criminal_record: boolean;
  is_morocco_special: boolean;
  partial_info: boolean;
  note: string;
};

/* Idioma fuera de la tarifa oficial (ru, uk, zh, ja…): el tool NO devuelve
   cifras. Antes caía al fallback DEFAULT_RATE del motor y el chatbot daba un
   precio con toda su confianza — el borde que quedaba sin gate tras el
   presupuesto 2026-00045; misma forma que el incidente TJ-20260602-NJ42. El
   schema de la tool ya restringe los valores, pero esto es el cinturón: quien
   decide el argumento es un modelo, no un formulario. */
export type QuoteEstimateUnpriceable = {
  auto_priceable: false;
  language: string;
  language_name: string;
  note: string;
};

const DEFAULT_WORDS_PER_PAGE = 250;
const MIN_WORDS_FALLBACK = 150;

export function getQuoteEstimate(
  input: QuoteEstimateInput,
): QuoteEstimateOutput | QuoteEstimateUnpriceable {
  const language = (input.language ?? "fr").toLowerCase();

  if (!AUTO_PRICEABLE_FOREIGN.has(language)) {
    return {
      auto_priceable: false,
      language,
      language_name: getLanguageName(language),
      note: "No tenemos tarifa automática para este idioma: NO des ninguna cifra, ni orientativa ni de rango. Explica que lo presupuestamos a mano y pide que nos escriba por WhatsApp o desde /contacto con el documento.",
    };
  }
  const documentType = input.document_type ?? "other";
  const pages = Math.max(1, Math.floor(input.pages ?? 1));
  const country = input.country?.toUpperCase();

  const words = Math.max(
    MIN_WORDS_FALLBACK,
    input.estimated_words ?? pages * DEFAULT_WORDS_PER_PAGE,
  );

  const synthetic: DocumentAnalysisResult = {
    document_type: {
      category: "",
      specific_type: documentType,
      specific_type_es: "",
      confidence: 1,
    },
    language: {
      source: language,
      source_name: getLanguageName(language),
      target: "es",
      target_name: "Español",
      confidence: 1,
    },
    country: {
      origin: country ?? "",
      origin_name: "",
      issuing_authority: "",
      confidence: country ? 1 : 0,
    },
    document_metrics: {
      estimated_words: words,
      pages,
      has_tables: false,
      has_stamps_seals: false,
      has_handwriting: false,
      scan_quality: "good",
      is_legible: true,
    },
    extracted_data: {
      names: [],
      dates: [],
      reference_numbers: [],
      institutions: [],
      notes: "",
    },
    complexity: { level: "standard", reasons: [], estimated_hours: 1 },
    requirements: {
      needs_apostille_translation: false,
      has_apostille: !!input.has_apostille,
      has_legalization: false,
      special_notes: "",
    },
    warnings: [],
  };

  const quote = calculatePrice(synthetic);
  const partialInfo = input.pages === undefined || input.document_type === undefined;
  const isFrenchCriminalRecord =
    documentType === "criminal_record" && language === "fr" && pages >= 3;
  const isMoroccoSpecial = country === "MA" && language !== "ar";

  let note: string;
  if (isFrenchCriminalRecord) {
    note =
      "Bulletin n°3 francés con anexo multilingüe UE: precio fijo 75 € IVA incluido (paquete).";
  } else if (isMoroccoSpecial) {
    note =
      "Marruecos (francés): tarifa fija por páginas, no por palabras. Apostilla aparte si aplica.";
  } else if (partialInfo) {
    note =
      "Estimación con información parcial. Para precio cerrado real, sube el documento al presupuesto instantáneo.";
  } else {
    note = "Precio orientativo. El presupuesto cerrado se calcula sobre el documento real.";
  }

  return {
    language,
    language_name: getLanguageName(language),
    document_type: documentType,
    pages,
    estimated_words: words,
    minimum_price_eur: getMinimum(documentType, language),
    rate_per_word_eur: getRate(language),
    apostille_surcharge_eur: input.has_apostille ? getApostilleSurcharge(language) : 0,
    // Precio CLIENTE = coste × (1 + margen tiered); FR sin margen. IVA encima.
    base_price_eur: clientPriceFromCost(quote.basePrice, language),
    base_price_with_vat_eur: round2(clientPriceFromCost(quote.basePrice, language) * (1 + VAT_RATE)),
    urgent_price_eur: clientPriceFromCost(quote.urgentPrice, language),
    urgent_price_with_vat_eur: round2(clientPriceFromCost(quote.urgentPrice, language) * (1 + VAT_RATE)),
    estimated_delivery_standard: quote.estimatedDaysStandard,
    estimated_delivery_urgent: quote.estimatedDaysUrgent,
    is_french_criminal_record: isFrenchCriminalRecord,
    is_morocco_special: isMoroccoSpecial,
    partial_info: partialInfo,
    note,
  };
}
