import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { calculatePrice, VAT_RATE } from "@/lib/pricing-engine/calculator";
import { getRate, getLanguageName } from "@/lib/pricing-engine/languages";
import { clientPriceFromCost, round2 } from "@/lib/quote-math";
import { getMinimum, getApostilleSurcharge } from "@/lib/pricing-engine/rules";

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

const DEFAULT_WORDS_PER_PAGE = 250;
const MIN_WORDS_FALLBACK = 150;

export function getQuoteEstimate(input: QuoteEstimateInput): QuoteEstimateOutput {
  const language = (input.language ?? "fr").toLowerCase();
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
