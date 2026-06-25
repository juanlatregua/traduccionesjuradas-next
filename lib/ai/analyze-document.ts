// lib/ai/analyze-document.ts — Análisis de documentos con Claude API (visión)

import Anthropic from "@anthropic-ai/sdk";
import { DOCUMENT_ANALYSIS_PROMPT, LARGE_DOCUMENT_ADDENDUM } from "./prompts";
import { countDocumentWords, billableWordCount } from "./word-counter";

const MODEL = "claude-sonnet-4-20250514";
// Camino barato: PDFs con capa de texto se clasifican con Haiku sobre el texto
// extraído (sin imagen). ~15× más barato que Sonnet visión y sin tokens de
// imagen. Ver lib/ai/extract-text.ts y lib/ai/run-analysis.ts.
const TEXT_MODEL = "claude-haiku-4-5-20251001";

// Reutilizables por otros analizadores que comparten el mismo criterio de
// coste (texto→Haiku, visión→Sonnet), p.ej. lib/ai/requirements.ts.
export const VISION_MODEL = MODEL;
export const TEXT_MODEL_ID = TEXT_MODEL;
const MAX_TOKENS = 16_384;
const MAX_TOKENS_LARGE = 8_192;
const LARGE_DOC_THRESHOLD = 5; // pages
const TIMEOUT_MS = 110_000;
// El SDK reintenta solo en 408/409/429 y >=500 (incluye 529 overloaded) con
// backoff exponencial + jitter, respetando la cabecera retry-after. Subimos de
// los 2 por defecto para sobrevivir a blips transitorios de la API que antes se
// mostraban al cliente como fallo definitivo. El AbortController (TIMEOUT_MS)
// sigue siendo el tope duro del tiempo total, reintentos incluidos.
const MAX_RETRIES = 4;

export type DocumentAnalysisResult = {
  document_type: {
    category: string;
    specific_type: string;
    specific_type_es: string;
    specific_type_fr?: string;
    confidence: number;
  };
  language: {
    source: string;
    source_name: string;
    target: string;
    target_name: string;
    confidence: number;
  };
  country: {
    origin: string;
    origin_name: string;
    issuing_authority: string;
    confidence: number;
  };
  document_metrics: {
    estimated_words: number;
    extracted_text?: string;
    pages: number;
    has_tables: boolean;
    has_stamps_seals: boolean;
    has_handwriting: boolean;
    scan_quality: "good" | "medium" | "poor";
    is_legible: boolean;
    // true en documentos oficiales con el MISMO contenido en dos idiomas en
    // paralelo (castellano + català/gallego/euskera, etc.): se traduce un solo
    // idioma. El conteo de palabras se divide entre 2. Ver lib/ai/word-counter.ts.
    is_bilingual_duplicate?: boolean;
  };
  extracted_data: {
    names: string[];
    dates: string[];
    reference_numbers: string[];
    institutions: string[];
    notes: string;
  };
  complexity: {
    level: "standard" | "complex" | "highly_complex";
    reasons: string[];
    estimated_hours: number;
  };
  requirements: {
    needs_apostille_translation: boolean;
    has_apostille: boolean;
    has_legalization: boolean;
    special_notes: string;
  };
  warnings: string[];
  // Red de seguridad de autotarificación (lib/ai/price-risk.ts): si risky=true,
  // el documento NO se autocobra (se manda a presupuesto manual). Lo rellena
  // run-analysis tras el análisis.
  price_risk?: import("./price-risk").PriceRisk;
};

type AnalyzeInput = {
  fileBase64: string;
  mimeType: string;
  fileName: string;
  ocrText?: string;
  pageCount?: number;
};

function getMediaType(
  mimeType: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf" {
  const map: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf"> = {
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

// Claude a veces envuelve el JSON en bloques ```json. Extrae y parsea.
// Genérico para reusarlo con otros schemas (p.ej. RequirementsExtraction del
// lector). Default = DocumentAnalysisResult, así los callers existentes no cambian.
export function parseModelJson<T = DocumentAnalysisResult>(rawText: string, tag: string): T {
  let jsonStr = rawText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (parseErr: any) {
    console.error(`[${tag}] JSON parse failed. First 500 chars:`, jsonStr.slice(0, 500));
    throw new Error(`JSON_PARSE: ${parseErr.message}`);
  }
}

/**
 * Camino BARATO: clasifica un documento a partir de su TEXTO ya extraído
 * (PDFs digitales con capa de texto). Usa Haiku, sin imagen → mucho menos
 * coste de tokens. El conteo de palabras es local sobre el texto completo
 * (autoritativo), así que no depende de que el modelo cuente bien.
 */
export async function analyzeDocumentText(input: {
  text: string;
  fileName: string;
  pageCount?: number;
}): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada.");
  }

  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });

  // Acotamos el texto enviado al modelo para limitar tokens; el conteo de
  // palabras lo hacemos sobre el texto COMPLETO aparte.
  const promptText = input.text.slice(0, 24_000);
  const localWords = countDocumentWords(input.text);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: TEXT_MODEL,
        max_tokens: MAX_TOKENS_LARGE,
        system: [
          {
            type: "text",
            text: DOCUMENT_ANALYSIS_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Analiza este documento (${input.fileName}) a partir del TEXTO extraído de su PDF y devuelve el JSON de análisis. ` +
                  `El documento tiene ${input.pageCount || "?"} página(s). ` +
                  `No incluyas extracted_text en la respuesta (ya disponemos del texto).\n\n--- TEXTO DEL DOCUMENTO ---\n${promptText}`,
              },
            ],
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (response.stop_reason === "max_tokens") {
      console.error("[analyzeDocumentText] Response truncated (max_tokens). Usage:", JSON.stringify(response.usage));
      throw new Error("TRUNCATED: respuesta truncada por límite de tokens.");
    }

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Claude no devolvió texto en la respuesta.");
    }

    const result = parseModelJson(textContent.text, "analyzeDocumentText");

    // Conteo local sobre texto completo = autoritativo (cogemos el mayor por
    // si el modelo estimó más alto en algún caso límite). En bilingües de mismo
    // contenido (ca/es co-oficial, etc.) el texto trae las dos columnas → mitad.
    const bilingualDuplicate = result.document_metrics?.is_bilingual_duplicate === true;
    const adjLocal = bilingualDuplicate ? Math.round(localWords / 2) : localWords;
    const claudeWords = bilingualDuplicate
      ? Math.round((result.document_metrics?.estimated_words || 0) / 2)
      : result.document_metrics?.estimated_words || 0;
    result.document_metrics.estimated_words = Math.max(adjLocal, claudeWords);
    if (input.pageCount) {
      result.document_metrics.pages = input.pageCount;
    }
    console.log(
      `[analyzeDocumentText] Haiku/text: local=${localWords}, Claude=${claudeWords}, pages=${result.document_metrics.pages}, type=${result.document_type.specific_type}`
    );

    return result;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("El análisis del documento ha excedido el tiempo límite.");
    }
    throw err;
  }
}

export async function analyzeDocument(input: AnalyzeInput): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada.");
  }

  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
  const mediaType = getMediaType(input.mimeType);

  // Build content blocks
  const contentBlocks: Anthropic.ContentBlockParam[] = [];

  // Add the document as image/PDF
  if (mediaType === "application/pdf") {
    contentBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: input.fileBase64,
      },
    });
  } else {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: input.fileBase64,
      },
    });
  }

  const isLargeDoc = (input.pageCount || 0) > LARGE_DOC_THRESHOLD;

  // Add OCR text if available (helps with scanned documents)
  let textPrompt = `Analiza este documento (${input.fileName}) y devuelve el JSON de análisis.`;
  if (input.ocrText) {
    textPrompt += `\n\nTexto OCR extraído previamente (puede tener errores):\n${input.ocrText.slice(0, 3000)}`;
  }
  if (isLargeDoc) {
    textPrompt += `\n\nEste documento tiene ${input.pageCount} páginas. ` + LARGE_DOCUMENT_ADDENDUM;
  }

  contentBlocks.push({
    type: "text",
    text: textPrompt,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: isLargeDoc ? MAX_TOKENS_LARGE : MAX_TOKENS,
        system: [
          {
            type: "text",
            text: DOCUMENT_ANALYSIS_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    // Check for truncated response (max_tokens hit)
    if (response.stop_reason === "max_tokens") {
      console.error("[analyzeDocument] Response truncated (max_tokens). Usage:", JSON.stringify(response.usage));
      throw new Error("TRUNCATED: respuesta truncada por límite de tokens.");
    }

    // Extract text from response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Claude no devolvió texto en la respuesta.");
    }

    // Parse JSON (Claude might wrap it in ```json blocks)
    const result = parseModelJson(textContent.text, "analyzeDocument");

    // Documentos bilingües de mismo contenido (ca/es co-oficial, etc.): el
    // modelo transcribe las dos columnas, pero solo se traduce/cuenta una.
    const bilingualDuplicate = result.document_metrics.is_bilingual_duplicate === true;

    // Override word count with local counter if extracted_text is available
    if (result.document_metrics.extracted_text) {
      // `estimated_words` puede faltar aunque haya extracted_text → || 0 evita
      // que Math.round(undefined/2)=NaN contamine el max() y produzca precio NaN.
      const modelWords = result.document_metrics.estimated_words || 0;
      const claudeWords = bilingualDuplicate ? Math.round(modelWords / 2) : modelWords;
      const localWords = billableWordCount(result.document_metrics.extracted_text, { bilingualDuplicate });
      const totalPages = input.pageCount || result.document_metrics.pages || 1;
      console.log(`[analyzeDocument] Words: Claude=${claudeWords}, local=${localWords}, pages=${totalPages}, bilingual=${bilingualDuplicate}`);

      if (isLargeDoc && totalPages > LARGE_DOC_THRESHOLD) {
        // Document was truncated — extracted_text only covers first pages.
        // Use local word count as sample and extrapolate to total pages.
        const analyzedPages = Math.min(3, totalPages);
        const wordsPerPage = localWords / analyzedPages;
        const extrapolated = Math.round(wordsPerPage * totalPages);
        // Use the higher of Claude's extrapolation and our own
        result.document_metrics.estimated_words = Math.max(claudeWords, extrapolated);
        console.log(`[analyzeDocument] Large doc: ${localWords} words in ${analyzedPages} pages → extrapolated ${extrapolated}, Claude said ${claudeWords}, using ${result.document_metrics.estimated_words}`);
      } else {
        // Use the higher of both: Claude's extracted_text is sometimes a
        // partial sample (especially for non-Latin scripts like Arabic),
        // so trusting the local count alone can underestimate.
        result.document_metrics.estimated_words = Math.max(localWords, claudeWords);
      }
    } else if (bilingualDuplicate) {
      // Sin transcripción: el modelo contó las dos columnas → mitad.
      result.document_metrics.estimated_words = Math.round((result.document_metrics.estimated_words || 0) / 2);
    }

    // Ensure page count reflects the real document, not the truncated version
    if (input.pageCount && input.pageCount > result.document_metrics.pages) {
      result.document_metrics.pages = input.pageCount;
    }

    return result;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("El análisis del documento ha excedido el tiempo límite (30s).");
    }
    throw err;
  }
}

/**
 * Censura nombres para RGPD: primeras 3 letras + ***
 */
export function censorName(name: string): string {
  if (!name || name.length <= 3) return "***";
  return name.slice(0, 3) + "***";
}

/**
 * Censura todos los nombres extraídos
 */
export function censorExtractedNames(names: string[]): string[] {
  return names.map(censorName);
}
