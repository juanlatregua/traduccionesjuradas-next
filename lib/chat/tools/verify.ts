export type VerifyTranslatorInput = {
  name?: string;
  maec_number?: number;
};

const JUAN_SILVA_DATA = {
  full_name: "Juan Silva Moreno",
  maec_number: 3850,
  language_pair: "francés ↔ español",
  language_iso: "fr",
  appointed_year: 2009,
  experience_years_min: 15,
  professional_address: "Calle Esperanto, 9 — 29007 Málaga",
  company: "HBTJ Consultores Lingüísticos S.L.",
  cif: "B93712784",
  total_translations_min: 3000,
  google_rating: { stars: 4.8, reviews: 46 },
} as const;

const MAEC_LISTING_URL =
  "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-.aspx";

type VerifyMatchOutput = {
  verified: true;
  match_reason: "name" | "maec_number" | "both";
  data: typeof JUAN_SILVA_DATA;
  official_listing_url: string;
  message: string;
};

type VerifyNoMatchOutput = {
  verified: false;
  message: string;
  official_listing_url: string;
  how_to_validate: string[];
};

export type VerifyTranslatorOutput = VerifyMatchOutput | VerifyNoMatchOutput;

export function verifyTranslatorCredentials(
  input: VerifyTranslatorInput,
): VerifyTranslatorOutput {
  const normalizedName = input.name?.toLowerCase().trim() ?? "";
  const nameMatch =
    normalizedName.includes("juan silva") ||
    normalizedName.includes("silva moreno");
  const numberMatch = input.maec_number === JUAN_SILVA_DATA.maec_number;

  if (nameMatch || numberMatch) {
    return {
      verified: true,
      match_reason: nameMatch && numberMatch ? "both" : nameMatch ? "name" : "maec_number",
      data: JUAN_SILVA_DATA,
      official_listing_url: MAEC_LISTING_URL,
      message:
        "Credenciales confirmadas. Juan Silva Moreno, traductor-intérprete jurado de francés nº 3850, nombrado por el MAEC en 2009. Verificable en el listado oficial del Ministerio de Asuntos Exteriores.",
    };
  }

  return {
    verified: false,
    message:
      "No tenemos en este chat la base de datos completa del MAEC. El listado oficial es público y se consulta en el Ministerio de Asuntos Exteriores.",
    official_listing_url: MAEC_LISTING_URL,
    how_to_validate: [
      "Pídele su número MAEC y su nombre completo.",
      "Búscalo en el listado oficial del Ministerio de Asuntos Exteriores.",
      "Comprueba que su firma y sello aparezcan en la traducción jurada.",
    ],
  };
}
