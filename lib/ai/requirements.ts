// lib/ai/requirements.ts — Lector de requerimientos (utilidad flagship v2)
//
// Lee una PETICIÓN oficial (carta/email/notificación de una administración) y
// extrae, de forma PRUDENTE (YMYL), qué documentos pide, si parecen exigir
// traducción jurada, qué legalización podría aplicar y qué plazo menciona.
//
// Decide el camino más barato igual que lib/ai/run-analysis.ts (PDF con capa de
// texto → Haiku sobre texto; foto/escaneo → Sonnet visión), pero con su PROPIO
// prompt y schema. NO reusa analyzeDocument: su post-proceso (conteo de
// palabras) asume DocumentAnalysisResult y rompería con este schema.

import Anthropic from "@anthropic-ai/sdk";
import { parseModelJson, VISION_MODEL, TEXT_MODEL_ID } from "./analyze-document";
import { extractPdfText } from "./extract-text";
import {
  REQUIREMENTS_EXTRACTION_PROMPT,
  REQUIREMENTS_PROMPT_VERSION,
  REQUIREMENTS_DISCLAIMER_VERSION,
} from "./prompts";
import { HCCH_TABLE } from "@/lib/legalization/hcch-table";
import { TYPE_LABELS } from "@/lib/diagnosis";

export type SwornAssessment =
  | "likely_required"
  | "possibly_required"
  | "not_required"
  | "unclear";

export type RequirementLegalization =
  | "apostille"
  | "consular"
  | "eu-exempt"
  | "verify_with_authority";

export type RequiredDocument = {
  documentType: string;
  label: string;
  languagePair: { source: string | null; target: string | null };
  swornAssessment: SwornAssessment;
  swornEvidence: string;
  legalization: RequirementLegalization;
  legalizationNote: string;
  quantity: number | null;
  confidence: number;
};

export type RequirementsExtraction = {
  isRequirement: boolean;
  summary: string;
  procedure: {
    context: string;
    requestingAuthority: string;
    country: string | null;
    countryName: string;
  };
  documents: RequiredDocument[];
  deadlineLiteral: string | null;
  deadlineNote: string | null;
  urgency: "none" | "mentioned" | "unclear";
  nextSteps: string[];
  warnings: string[];
  // Trazabilidad defensiva — la fija el servidor, no la IA.
  promptVersion: string;
  hcchTableReviewedAt: string;
  disclaimerVersion: string;
};

const MAX_TOKENS = 4096;
const TIMEOUT_MS = 110_000;
const MAX_RETRIES = 4;
const MAX_TEXT_CHARS = 24_000;

// La lista cerrada de tipos = claves del mapa de etiquetas (es está vacío; fr
// tiene el set completo). Mantiene alineado el documentType con el vocabulario
// que entiende la puerta (TYPE_LABELS / diagnosis).
const VALID_DOC_TYPES = Object.keys(TYPE_LABELS.fr);

const LANG_NAMES: Record<string, string> = {
  es: "español",
  fr: "francés (français)",
  en: "inglés (English)",
  de: "alemán (Deutsch)",
  pt: "portugués (português)",
};

function buildHcchLines(): string[] {
  const regimeWord: Record<string, string> = {
    apostille: "apostilla (Convenio de La Haya)",
    consular: "legalización consular (no es parte del Convenio)",
    "eu-1191-exempt": "UE — Reglamento 2016/1191 (posible exención de apostilla)",
    unknown: "verificar con el organismo",
  };
  return Object.entries(HCCH_TABLE.entries).map(
    ([iso2, e]) =>
      `${iso2}: ${regimeWord[e.regime] || e.regime}${e.note ? " — " + e.note : ""}`
  );
}

type MediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "application/pdf";

function getMediaType(mimeType: string): MediaType {
  const map: Record<string, MediaType> = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
    "image/heic": "image/jpeg",
    "application/pdf": "application/pdf",
  };
  return map[mimeType] || "image/jpeg";
}

export async function analyzeRequirement(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  lang: string;
}): Promise<RequirementsExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");

  const systemPrompt = REQUIREMENTS_EXTRACTION_PROMPT({
    lang: input.lang,
    validDocTypes: VALID_DOC_TYPES,
    hcchLines: buildHcchLines(),
  });

  // Camino barato (Haiku/texto) si el PDF tiene capa de texto fiable; si no,
  // visión (Sonnet). Las imágenes van siempre por visión.
  const mediaType = getMediaType(input.mimeType);
  let useText = false;
  let extractedText = "";
  if (mediaType === "application/pdf") {
    try {
      const extraction = await extractPdfText(input.buffer);
      if (extraction.hasTextLayer && extraction.text.trim().length > 40) {
        useText = true;
        extractedText = extraction.text;
      }
    } catch (err) {
      console.error("[requirements] extractPdfText error, usando visión:", err);
    }
  }

  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const model = useText ? TEXT_MODEL_ID : VISION_MODEL;
    const userContent: Anthropic.ContentBlockParam[] = [];

    // Recordatorio de idioma en el propio mensaje (no solo en el system): los
    // modelos pequeños tienden a copiar el idioma de la carta si no se repite
    // aquí. swornEvidence sigue siendo la única excepción (cita literal).
    const langName = LANG_NAMES[input.lang] || input.lang;
    const langDirective =
      `\n\nIMPORTANTE: redacta TODA tu respuesta en ${langName} (código "${input.lang}"), ` +
      `aunque la carta esté en otro idioma. Única excepción: "swornEvidence" va en el idioma original de la carta.`;

    if (useText) {
      userContent.push({
        type: "text",
        text:
          `Lee esta petición oficial (${input.fileName}) a partir del TEXTO extraído de su PDF y devuelve el JSON.` +
          langDirective +
          `\n\n--- TEXTO DE LA CARTA ---\n${extractedText.slice(0, MAX_TEXT_CHARS)}`,
      });
    } else {
      if (mediaType === "application/pdf") {
        userContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: input.buffer.toString("base64"),
          },
        });
      } else {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: input.buffer.toString("base64"),
          },
        });
      }
      userContent.push({
        type: "text",
        text: `Lee esta petición oficial (${input.fileName}) y devuelve el JSON.` + langDirective,
      });
    }

    const response = await client.messages.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userContent }],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (response.stop_reason === "max_tokens") {
      throw new Error("TRUNCATED: respuesta truncada por límite de tokens.");
    }

    const textContent = response.content.find((b) => b.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Claude no devolvió texto en la respuesta.");
    }

    const result = parseModelJson<RequirementsExtraction>(
      textContent.text,
      "analyzeRequirement"
    );

    // Trazabilidad defensiva + saneado de arrays (la IA podría omitirlos).
    result.promptVersion = REQUIREMENTS_PROMPT_VERSION;
    result.hcchTableReviewedAt = HCCH_TABLE.lastReviewed;
    result.disclaimerVersion = REQUIREMENTS_DISCLAIMER_VERSION;
    result.documents = Array.isArray(result.documents) ? result.documents : [];
    result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
    result.nextSteps = Array.isArray(result.nextSteps) ? result.nextSteps : [];

    console.log(
      `[requirements] ${input.fileName}: ${useText ? "TEXT/Haiku" : "VISION/Sonnet"}, ` +
        `isReq=${result.isRequirement}, docs=${result.documents.length}, country=${result.procedure?.country}`
    );

    return result;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("El análisis del requerimiento ha excedido el tiempo límite.");
    }
    throw err;
  }
}
