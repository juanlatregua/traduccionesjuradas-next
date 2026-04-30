import type Anthropic from "@anthropic-ai/sdk";
import { getQuoteEstimate, type QuoteEstimateInput } from "./quote";
import { recommendPath, type RecommendPathInput } from "./recommend";
import { verifyTranslatorCredentials, type VerifyTranslatorInput } from "./verify";

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_quote_estimate",
    description:
      "Calcula un presupuesto orientativo de traducción jurada basado en el motor de precios oficial del sitio. Úsala SIEMPRE que el usuario pregunte por precio, coste, tarifa o cuánto cuesta — nunca improvises cifras. Devuelve precio mínimo aplicable, precio base, precio con IVA, precio urgente (+25%) y plazo de entrega estimado. Si la información es parcial, usa valores por defecto y devuelve `partial_info: true` para que recomiendes el funnel.",
    input_schema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description:
            "Código ISO 639-1 del idioma origen no español. Valores admitidos: 'fr' (francés), 'en' (inglés), 'de' (alemán), 'it' (italiano), 'pt' (portugués), 'ca' (catalán), 'nl' (neerlandés), 'sv' (sueco), 'no' (noruego), 'ar' (árabe), 'ro' (rumano).",
        },
        document_type: {
          type: "string",
          enum: [
            "birth_certificate",
            "marriage_certificate",
            "death_certificate",
            "criminal_record",
            "passport",
            "id_card",
            "divorce_decree",
            "degree",
            "transcript",
            "apostille",
            "contract",
            "power_of_attorney",
            "company_registration",
            "payslip",
            "medical_report",
            "tax_return",
            "other",
          ],
          description:
            "Tipo de documento. Si no está claro por la consulta, omite el campo o usa 'other'.",
        },
        pages: {
          type: "number",
          description: "Número de páginas del documento. Por defecto 1.",
        },
        estimated_words: {
          type: "number",
          description:
            "Conteo aproximado de palabras del documento. Si se omite, se calcula como 250 × pages.",
        },
        has_apostille: {
          type: "boolean",
          description:
            "True si el documento incluye una apostilla de La Haya que también requiere traducción jurada (recargo de 15 €).",
        },
        country: {
          type: "string",
          description:
            "Código ISO 3166-1 alpha-2 del país emisor. Activa precios especiales: 'MA' (Marruecos en francés → tarifa fija por páginas).",
        },
      },
      required: ["language"],
    },
  },
  {
    name: "recommend_path",
    description:
      "Devuelve la URL canónica de traduccionesjuradas.net que corresponde al contexto del usuario (país, idioma, tipo de documento, intención). Úsala SIEMPRE que vayas a enlazar al usuario a una página del sitio o a un blog post — así los enlaces son siempre correctos y no inventas URLs. Devuelve URL primaria, blog post relevante, página de idioma, página de tipo de documento, CTAs ordenadas por prioridad y la razón de la recomendación.",
    input_schema: {
      type: "object",
      properties: {
        country: {
          type: "string",
          description:
            "Código ISO 3166-1 alpha-2 del país emisor. Países con guía propia: MA (Marruecos), DZ (Argelia), TN (Túnez), GB/UK (Reino Unido), IT (Italia), BR (Brasil), SN (Senegal).",
        },
        language: {
          type: "string",
          description:
            "Código ISO 639-1 del idioma origen no español (fr, en, de, it, pt, ca, nl, sv, no, ar, ro).",
        },
        document_type: {
          type: "string",
          description:
            "Tipo de documento si se conoce (mismos valores que get_quote_estimate).",
        },
        intent: {
          type: "string",
          enum: ["quote", "info", "urgent", "compare", "unknown"],
          description:
            "Intención del usuario. 'compare' devuelve siempre el hub agregador. 'urgent' añade WhatsApp como CTA prioritaria.",
        },
      },
    },
  },
  {
    name: "verify_translator_credentials",
    description:
      "Verifica las credenciales de un traductor jurado. Úsala cuando el usuario pregunte si Juan Silva es real, si el servicio es de fiar, cómo verificar a un traductor, o pida validar a alguien por nombre o número MAEC. Si coincide con Juan Silva (nº 3850, francés, 2009), devuelve sus datos oficiales. Para otros, devuelve la URL del listado oficial del MAEC e instrucciones de validación.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nombre del traductor a verificar.",
        },
        maec_number: {
          type: "number",
          description: "Número de traductor jurado del MAEC.",
        },
      },
    },
  },
];

export async function executeToolCall(
  name: string,
  input: unknown,
): Promise<unknown> {
  switch (name) {
    case "get_quote_estimate":
      return getQuoteEstimate(input as QuoteEstimateInput);
    case "recommend_path":
      return recommendPath(input as RecommendPathInput);
    case "verify_translator_credentials":
      return verifyTranslatorCredentials(input as VerifyTranslatorInput);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export { getQuoteEstimate, recommendPath, verifyTranslatorCredentials };
