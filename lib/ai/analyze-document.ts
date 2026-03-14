// lib/ai/analyze-document.ts — Análisis de documentos con Claude API (visión)

import Anthropic from "@anthropic-ai/sdk";
import { DOCUMENT_ANALYSIS_PROMPT } from "./prompts";
import { countDocumentWords } from "./word-counter";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;
const TIMEOUT_MS = 55_000;

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
};

type AnalyzeInput = {
  fileBase64: string;
  mimeType: string;
  fileName: string;
  ocrText?: string; // Texto OCR previo si existe
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

export async function analyzeDocument(input: AnalyzeInput): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada.");
  }

  const client = new Anthropic({ apiKey });
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

  // Add OCR text if available (helps with scanned documents)
  let textPrompt = `Analiza este documento (${input.fileName}) y devuelve el JSON de análisis.`;
  if (input.ocrText) {
    textPrompt += `\n\nTexto OCR extraído previamente (puede tener errores):\n${input.ocrText.slice(0, 3000)}`;
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
        max_tokens: MAX_TOKENS,
        system: DOCUMENT_ANALYSIS_PROMPT,
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
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let result: DocumentAnalysisResult;
    try {
      result = JSON.parse(jsonStr) as DocumentAnalysisResult;
    } catch (parseErr: any) {
      console.error("[analyzeDocument] JSON parse failed. First 500 chars:", jsonStr.slice(0, 500));
      throw new Error(`JSON_PARSE: ${parseErr.message}`);
    }

    // Override word count with local counter if extracted_text is available
    if (result.document_metrics.extracted_text) {
      const claudeWords = result.document_metrics.estimated_words;
      const localWords = countDocumentWords(result.document_metrics.extracted_text);
      console.log(`[analyzeDocument] Words: Claude=${claudeWords}, local=${localWords}`);
      result.document_metrics.estimated_words = localWords;
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
