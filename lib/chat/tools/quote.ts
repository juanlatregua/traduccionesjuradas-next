import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { calculatePrice, VAT_RATE } from "../../pricing-engine/calculator.ts";
import {
  getRate,
  getLanguageName,
  AUTO_PRICEABLE_FOREIGN,
} from "../../pricing-engine/languages.ts";
import { round2 } from "../../quote-math.ts";
import { clientBaseFromQuote, clientUrgentFromQuote, isPagePricedType } from "../../pricing-engine/page-pricing.ts";
import { getMinimum, getApostilleSurcharge } from "../../pricing-engine/rules.ts";
import { DOC_FLOOR_CENTS } from "../../learned-rates-math.ts";

const DIRECT_FLOOR_LANGS = new Set(["en", "de", "nl", "pt", "ro"]);

export type QuoteEstimateInput = {
  language: string;
  document_type?: string;
  pages?: number;
  estimated_words?: number;
  has_apostille?: boolean;
  country?: string;
  // Dirección de la traducción. Sin ella NO se aplica la tarifa por página (solo
  // vale hacia el español); la tool pide que se pregunte.
  direction?: "to_spanish" | "from_spanish";
  // La apostilla va en una hoja propia del archivo (solo entonces no cuenta como página).
  apostille_separate_page?: boolean;
  // Tablas (notas, expedientes, extractos): en alemán la página cuesta 35 € en vez de 30 €.
  has_tables?: boolean;
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

  // Escaparate 24-ago: cifras públicas SOLO en francés ("el resto previa
  // cotización en lavori"). El set del motor sigue siendo más amplio, pero el
  // chatbot es público: mismo gate que la puerta.
  // Carril directo (en/de/nl/pt/ro): se publica el suelo por documento (Juan, 29-sep-2026).
  // Excepción (8-oct-2026): alemán→español en documentos «por página» también
  // lleva cifra pública (30 € / 35 € con tablas por página).
  const hacia = input.direction === "to_spanish";
  const alemanPorPagina = language === "de" && hacia && isPagePricedType(input.document_type);
  if ((language !== "fr" && !alemanPorPagina) || !AUTO_PRICEABLE_FOREIGN.has(language)) {
    const suelo = DIRECT_FLOOR_LANGS.has(language)
      ? `Puedes decir que parte de ${DOC_FLOOR_CENTS / 100} € + IVA por documento; no des otra cifra ni rango. `
      : "NO des ninguna cifra, ni orientativa ni de rango. ";
    return {
      auto_priceable: false,
      language,
      language_name: getLanguageName(language),
      note: `El precio de este idioma lo confirma directamente el traductor jurado: ${suelo}Explica que respondemos con el presupuesto normalmente el mismo día y pide que nos escriba por WhatsApp o suba el documento en /presupuesto-instantaneo.`,
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
    // Sin dirección explícita o hacia el idioma extranjero: el original se trata como
    // español → sin tarifa por página (que solo existe FR→ES y DE→ES).
    language: hacia
      ? { source: language, source_name: getLanguageName(language), target: "es", target_name: "Español", confidence: 1 }
      : { source: "es", source_name: "Español", target: language, target_name: getLanguageName(language), confidence: 1 },
    country: {
      origin: country ?? "",
      origin_name: "",
      issuing_authority: "",
      confidence: country ? 1 : 0,
    },
    document_metrics: {
      estimated_words: words,
      pages,
      has_tables: !!input.has_tables,
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
      apostille_separate_page: input.apostille_separate_page === true,
      has_legalization: false,
      special_notes: "",
    },
    warnings: [],
  };

  const quote = calculatePrice(synthetic);
  const partialInfo = input.pages === undefined || input.document_type === undefined || !input.direction;
  let note: string;
  if (quote.pagePricing) {
    note =
      language === "de"
        ? `Tarifa por página del original: ${quote.pagePricing.pricePerPage} € + IVA por página${quote.pagePricing.tables ? " (con tablas)" : " (35 € si la página lleva tablas)"}.`
        : `Tarifa por página del original: ${quote.pagePricing.pricePerPage} € + IVA por página.`;
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
    minimum_price_eur: getMinimum(documentType, language, pages),
    rate_per_word_eur: getRate(language),
    apostille_surcharge_eur: input.has_apostille ? getApostilleSurcharge(language) : 0,
    // Precio CLIENTE = coste × (1 + margen tiered); FR sin margen. IVA encima.
    base_price_eur: clientBaseFromQuote(quote, language),
    base_price_with_vat_eur: round2(clientBaseFromQuote(quote, language) * (1 + VAT_RATE)),
    urgent_price_eur: clientUrgentFromQuote(quote, language),
    urgent_price_with_vat_eur: round2(clientUrgentFromQuote(quote, language) * (1 + VAT_RATE)),
    estimated_delivery_standard: quote.estimatedDaysStandard,
    estimated_delivery_urgent: quote.estimatedDaysUrgent,
    partial_info: partialInfo,
    note,
  };
}
