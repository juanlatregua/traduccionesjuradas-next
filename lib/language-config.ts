import { getWordRateForLangOrPair } from "@/lib/pricing";

export type LanguageConfig = {
  slug: string;
  name: string;
  nameEn: string;
  langCode: string;
  defaultPair: string;
  reversePair: string;
  hasFixedPrices: boolean;
};

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  frances: {
    slug: "frances",
    name: "francés",
    nameEn: "French",
    langCode: "fr",
    defaultPair: "fr-es",
    reversePair: "es-fr",
    hasFixedPrices: false,
  },
  ingles: {
    slug: "ingles",
    name: "inglés",
    nameEn: "English",
    langCode: "en",
    defaultPair: "en-es",
    reversePair: "es-en",
    hasFixedPrices: false,
  },
  aleman: {
    slug: "aleman",
    name: "alemán",
    nameEn: "German",
    langCode: "de",
    defaultPair: "de-es",
    reversePair: "es-de",
    hasFixedPrices: false,
  },
  portugues: {
    slug: "portugues",
    name: "portugués",
    nameEn: "Portuguese",
    langCode: "pt",
    defaultPair: "pt-es",
    reversePair: "es-pt",
    hasFixedPrices: false,
  },
  italiano: {
    slug: "italiano",
    name: "italiano",
    nameEn: "Italian",
    langCode: "it",
    defaultPair: "it-es",
    reversePair: "es-it",
    hasFixedPrices: false,
  },
  neerlandes: {
    slug: "neerlandes",
    name: "neerlandés",
    nameEn: "Dutch",
    langCode: "nl",
    defaultPair: "nl-es",
    reversePair: "es-nl",
    hasFixedPrices: false,
  },
  catalan: {
    slug: "catalan",
    name: "catalán",
    nameEn: "Catalan",
    langCode: "ca",
    defaultPair: "ca-es",
    reversePair: "es-ca",
    hasFixedPrices: false,
  },
  sueco: {
    slug: "sueco",
    name: "sueco",
    nameEn: "Swedish",
    langCode: "sv",
    defaultPair: "sv-es",
    reversePair: "es-sv",
    hasFixedPrices: false,
  },
  noruego: {
    slug: "noruego",
    name: "noruego",
    nameEn: "Norwegian",
    langCode: "no",
    defaultPair: "no-es",
    reversePair: "es-no",
    hasFixedPrices: false,
  },
};

export type DocCategory = {
  id: string;
  label: string;
  examples: string;
};

export const DOCUMENT_CATEGORIES: DocCategory[] = [
  {
    id: "registro-civil",
    label: "Certificados del registro civil",
    examples: "Nacimiento, matrimonio, defuncion, divorcio",
  },
  {
    id: "antecedentes",
    label: "Antecedentes penales",
    examples: "Penales, apostilla, buena conducta",
  },
  {
    id: "academico",
    label: "Documentos academicos",
    examples: "Titulos, diplomas, expedientes, notas",
  },
  {
    id: "laboral",
    label: "Documentos laborales",
    examples: "Contratos, nominas, certificados de empresa",
  },
  {
    id: "notarial",
    label: "Documentos notariales",
    examples: "Poderes, escrituras, actas notariales",
  },
  {
    id: "financiero",
    label: "Documentos financieros",
    examples: "Extractos bancarios, certificados de saldo, cuentas anuales",
  },
  {
    id: "identidad",
    label: "Documentos de identidad",
    examples: "DNI, pasaporte, permiso de residencia",
  },
  {
    id: "otro",
    label: "Otro tipo de documento",
    examples: "Cualquier documento no listado arriba",
  },
];

export function getEstimatedPrice(langPair: string, words: number) {
  const rate = getWordRateForLangOrPair(langPair);
  const subtotal = words * rate;
  const withMargin = Math.round(subtotal * 1.1 * 100) / 100;
  return {
    rate,
    subtotal,
    total: withMargin,
    totalCents: Math.round(withMargin * 100),
  };
}
