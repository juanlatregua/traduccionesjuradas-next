export type RecommendPathInput = {
  country?: string;
  language?: string;
  document_type?: string;
  intent?: "quote" | "info" | "urgent" | "compare" | "unknown";
};

export type Cta = {
  label: string;
  url: string;
  priority: number;
};

export type RecommendPathOutput = {
  primary_url: string;
  blog_url?: string;
  language_page?: string;
  document_type_page?: string;
  ctas: Cta[];
  reasoning: string;
};

type CountryInfo = {
  blog: string;
  default_language: string;
  note: string;
};

const COUNTRY_MAP: Record<string, CountryInfo> = {
  MA: {
    blog: "/blog/documentos-marroquies-guia-completa",
    default_language: "fr",
    note: "Marruecos: apostilla operativa desde 14/08/2016 (Min. del Interior, apostille.ma).",
  },
  DZ: {
    blog: "/blog/documentos-argelinos-guia-completa",
    default_language: "fr",
    note: "Argelia: legalización consular hasta el 9 de julio de 2026; apostilla después.",
  },
  TN: {
    blog: "/blog/documentos-tunecinos-guia-completa",
    default_language: "fr",
    note: "Túnez: apostilla operativa desde el 30/03/2018.",
  },
  GB: {
    blog: "/blog/documentos-britanicos-brexit-espana",
    default_language: "en",
    note: "UK post-Brexit: apostilla del FCDO Legalisation Office; DBS válido 3 meses.",
  },
  UK: {
    blog: "/blog/documentos-britanicos-brexit-espana",
    default_language: "en",
    note: "UK post-Brexit: apostilla del FCDO Legalisation Office; DBS válido 3 meses.",
  },
  IT: {
    blog: "/blog/documentos-italianos-espana",
    default_language: "it",
    note: "Italia: muchos certificados existen en versión plurilingüe CIEC sin necesidad de traducción.",
  },
  BR: {
    blog: "/blog/documentos-brasilenos-espana",
    default_language: "pt",
    note: "Brasil: apostilla operativa desde 2016 en cartórios y tribunais.",
  },
  SN: {
    blog: "/blog/documentos-senegaleses-espana",
    default_language: "fr",
    note: "Senegal: apostilla operativa desde marzo 2023 en MAE senegalés.",
  },
};

const LANGUAGE_PAGES: Record<string, string> = {
  fr: "/traductor-jurado-frances",
  en: "/traductor-jurado-ingles",
  de: "/traductor-jurado-aleman",
  it: "/traductor-jurado-italiano",
  pt: "/traductor-jurado-portugues",
  ca: "/traductor-jurado-catalan",
  nl: "/traductor-jurado-neerlandes",
  sv: "/traductor-jurado-sueco",
  no: "/traductor-jurado-noruego",
  ro: "/traductor-jurado-rumano",
};

const DOCUMENT_TYPE_PAGES: Record<string, string> = {
  criminal_record: "/documentos-oficiales/antecedentes-penales",
  birth_certificate: "/documentos-oficiales/certificados-registro-civil",
  marriage_certificate: "/documentos-oficiales/certificados-registro-civil",
  death_certificate: "/documentos-oficiales/certificados-registro-civil",
  divorce_decree: "/documentos-oficiales/certificados-registro-civil",
  degree: "/documentos-oficiales/documentos-academicos",
  transcript: "/documentos-oficiales/documentos-academicos",
  contract: "/documentos-oficiales/documentos-juridicos",
  power_of_attorney: "/documentos-oficiales/documentos-juridicos",
  payslip: "/documentos-oficiales/documentos-laborales",
  company_registration: "/documentos-oficiales/documentos-mercantiles",
  apostille: "/documentos-oficiales/apostilla-haya",
};

const HUB_URL = "/blog/tramites-espana-por-pais-origen";
const QUOTE_URL = "/presupuesto-instantaneo";
const WHATSAPP_URL = "https://wa.me/34951333614";

const UTM_PARAMS = "utm_source=chat&utm_medium=bot&utm_campaign=recommend_path";

function withUtm(url: string): string {
  if (!url.startsWith("/")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${UTM_PARAMS}`;
}

export function recommendPath(input: RecommendPathInput): RecommendPathOutput {
  const country = input.country?.trim().toUpperCase();
  const countryInfo = country ? COUNTRY_MAP[country] : undefined;
  const language = (input.language ?? countryInfo?.default_language)?.toLowerCase();
  const langPage = language ? LANGUAGE_PAGES[language] : undefined;
  const docPage = input.document_type ? DOCUMENT_TYPE_PAGES[input.document_type] : undefined;

  if (input.intent === "compare" || (!countryInfo && !langPage && !docPage)) {
    return {
      primary_url: withUtm(HUB_URL),
      blog_url: withUtm(HUB_URL),
      ctas: [
        { label: "Hub trámites por país", url: withUtm(HUB_URL), priority: 1 },
        { label: "Presupuesto instantáneo", url: withUtm(QUOTE_URL), priority: 2 },
      ],
      reasoning:
        input.intent === "compare"
          ? "Consulta comparativa entre países: hub agregador con tabla."
          : "Sin país, idioma ni tipo concreto: hub agregador como punto de partida.",
    };
  }

  const ctas: Cta[] = [];

  if (input.intent === "urgent") {
    ctas.push({ label: "WhatsApp directo", url: WHATSAPP_URL, priority: 0 });
  }

  if (countryInfo) {
    ctas.push({
      label: `Guía ${country}`,
      url: withUtm(countryInfo.blog),
      priority: ctas.length + 1,
    });
  }

  if (langPage && language) {
    ctas.push({
      label: `Traductor jurado de ${language}`,
      url: withUtm(langPage),
      priority: ctas.length + 1,
    });
  }

  if (docPage) {
    ctas.push({
      label: "Tipo de documento",
      url: withUtm(docPage),
      priority: ctas.length + 1,
    });
  }

  ctas.push({
    label: "Presupuesto instantáneo",
    url: withUtm(QUOTE_URL),
    priority: ctas.length + 1,
  });

  const primary = ctas[0]?.url ?? withUtm(QUOTE_URL);

  const reasoningParts: string[] = [];
  if (countryInfo) reasoningParts.push(countryInfo.note);
  if (language && !countryInfo) reasoningParts.push(`Idioma: ${language}.`);
  if (docPage) reasoningParts.push(`Tipo: ${input.document_type}.`);
  if (reasoningParts.length === 0) reasoningParts.push("Sin contexto específico.");

  return {
    primary_url: primary,
    blog_url: countryInfo ? withUtm(countryInfo.blog) : undefined,
    language_page: langPage ? withUtm(langPage) : undefined,
    document_type_page: docPage ? withUtm(docPage) : undefined,
    ctas,
    reasoning: reasoningParts.join(" "),
  };
}
