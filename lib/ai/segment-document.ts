// lib/ai/segment-document.ts — Segmentación de PDFs con VARIOS documentos
//
// Clientes que mandan todo junto en un PDF (expediente + título + apostilla…),
// a veces en idiomas distintos (ES + PT). Este módulo detecta los documentos
// distintos y su rango de páginas con Haiku sobre el texto por página, y
// clasifica cada uno por separado. El conteo de palabras de cada documento se
// hace en local sobre el texto de SUS páginas (autoritativo, no depende del
// modelo). Ver lib/ai/run-analysis.ts (orquestador) y prompts.ts.

import Anthropic from "@anthropic-ai/sdk";
import { DOCUMENT_SEGMENTATION_PROMPT } from "./prompts";
import { TEXT_MODEL_ID, parseModelJson } from "./analyze-document";
import type { DocumentAnalysisResult } from "./analyze-document";
import { countDocumentWords } from "./word-counter";

const MAX_TOKENS = 8_192;
const TIMEOUT_MS = 110_000;
const MAX_RETRIES = 4;

export type DocumentSegment = DocumentAnalysisResult & {
  page_start: number;
  page_end: number;
};

type RawSegment = {
  page_start?: number;
  page_end?: number;
  document_type?: Partial<DocumentAnalysisResult["document_type"]>;
  language?: Partial<DocumentAnalysisResult["language"]>;
  country?: Partial<DocumentAnalysisResult["country"]>;
  complexity?: DocumentAnalysisResult["complexity"];
  requirements?: DocumentAnalysisResult["requirements"];
  extracted_data?: Partial<DocumentAnalysisResult["extracted_data"]>;
  warnings?: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n) || lo));
}

// Segmento placeholder para páginas SIN texto (p.ej. escaneadas) que el
// segmentador no pudo ver. Evita perder documentos en silencio: aparece como
// línea editable con aviso para que el staff lo complete a mano.
export function makePlaceholderSegment(pageStart: number, pageEnd: number, targetLang?: string): DocumentSegment {
  const span = pageEnd > pageStart ? `${pageStart}-${pageEnd}` : `${pageStart}`;
  const tgt = targetLang && LANG_NAMES[targetLang] ? targetLang : "es";
  return {
    document_type: { category: "other", specific_type: "other", specific_type_es: "Documento sin texto (escaneado, revisar)", confidence: 0 },
    language: { source: "unknown", source_name: "", target: tgt, target_name: LANG_NAMES[tgt] || "Español", confidence: 0 },
    country: { origin: "unknown", origin_name: "", issuing_authority: "", confidence: 0 },
    document_metrics: { estimated_words: 0, pages: pageEnd - pageStart + 1, has_tables: false, has_stamps_seals: false, has_handwriting: false, scan_quality: "poor", is_legible: false },
    extracted_data: { names: [], dates: [], reference_numbers: [], institutions: [], notes: "" },
    complexity: { level: "standard", reasons: [], estimated_hours: 0.5 },
    requirements: { needs_apostille_translation: false, has_apostille: false, has_legalization: false, special_notes: "" },
    warnings: [`Páginas ${span} sin capa de texto (posible escaneo): el sistema no pudo leerlas. Revísalas y añade el tipo, idioma y palabras a mano.`],
    page_start: pageStart,
    page_end: pageEnd,
  };
}

function normalizeSegment(seg: RawSegment, pages: string[], pageCount: number): DocumentSegment {
  const start = clamp(seg.page_start ?? 1, 1, pageCount);
  const end = clamp(seg.page_end ?? start, start, pageCount);
  const text = pages.slice(start - 1, end).join("\n");
  const words = countDocumentWords(text);

  return {
    document_type: {
      category: seg.document_type?.category || "other",
      specific_type: seg.document_type?.specific_type || "other",
      specific_type_es: seg.document_type?.specific_type_es || "Documento",
      specific_type_fr: seg.document_type?.specific_type_fr,
      confidence: seg.document_type?.confidence ?? 0,
    },
    language: {
      source: seg.language?.source || "unknown",
      source_name: seg.language?.source_name || "",
      target: seg.language?.target || "es",
      target_name: seg.language?.target_name || "Español",
      confidence: seg.language?.confidence ?? 0,
    },
    country: {
      origin: seg.country?.origin || "unknown",
      origin_name: seg.country?.origin_name || "",
      issuing_authority: seg.country?.issuing_authority || "",
      confidence: seg.country?.confidence ?? 0,
    },
    document_metrics: {
      estimated_words: words,
      pages: end - start + 1,
      has_tables: false,
      has_stamps_seals: false,
      has_handwriting: false,
      scan_quality: "good",
      is_legible: true,
    },
    extracted_data: {
      names: seg.extracted_data?.names || [],
      dates: seg.extracted_data?.dates || [],
      reference_numbers: [],
      institutions: [],
      notes: seg.extracted_data?.notes || "",
    },
    complexity: seg.complexity || { level: "standard", reasons: [], estimated_hours: 0.5 },
    requirements:
      seg.requirements || {
        needs_apostille_translation: false,
        has_apostille: false,
        has_legalization: false,
        special_notes: "",
      },
    warnings: seg.warnings || [],
    page_start: start,
    page_end: end,
  };
}

/**
 * Segmenta un PDF (con capa de texto) en sus documentos distintos a partir del
 * texto POR PÁGINA. Devuelve 1..N segmentos, cada uno un DocumentAnalysisResult
 * con su rango de páginas y sus palabras contadas en local.
 */
const LANG_NAMES: Record<string, string> = {
  es: "español", fr: "francés", en: "inglés", de: "alemán", it: "italiano",
  pt: "portugués", ca: "catalán", nl: "neerlandés", sv: "sueco", no: "noruego",
  ar: "árabe", ro: "rumano",
};

export async function segmentDocumentText(input: {
  pages: string[];
  fileName: string;
  targetLang?: string; // idioma destino del expediente (si el staff lo fijó)
}): Promise<DocumentSegment[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");

  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
  const pageCount = input.pages.length;

  // Pista de destino: si el staff fijó el idioma destino (p. ej. "todo a
  // inglés"), se lo decimos al modelo para que ponga ese target en cada
  // documento (source = el idioma del propio documento). Resuelve el caso
  // "idiomas distintos → un tercer idioma".
  const tgt = input.targetLang && LANG_NAMES[input.targetLang] ? input.targetLang : "";
  const targetHint = tgt
    ? `\n\nIMPORTANTE — DESTINO FIJADO: el idioma DESTINO de TODAS las traducciones es ${LANG_NAMES[tgt]} ("${tgt}"). En CADA documento pon language.target = "${tgt}" y language.source = el idioma real del documento. Si un documento ya está en ${LANG_NAMES[tgt]}, indícalo igualmente con source = "${tgt}".`
    : "";

  // Texto marcado por página, acotado para limitar tokens (6 KB/pág, 48 KB total).
  const marked = input.pages
    .map((t, i) => `=== PÁGINA ${i + 1} ===\n${t.slice(0, 6_000)}`)
    .join("\n\n")
    .slice(0, 48_000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: TEXT_MODEL_ID,
        max_tokens: MAX_TOKENS,
        system: [
          { type: "text", text: DOCUMENT_SEGMENTATION_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Archivo: ${input.fileName}. Tiene ${pageCount} página(s). ` +
                  `Identifica los documentos distintos y su rango de páginas. ` +
                  `No incluyas extracted_text ni estimated_words. Devuelve el JSON.${targetHint}\n\n${marked}`,
              },
            ],
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (response.stop_reason === "max_tokens") {
      throw new Error("TRUNCATED: segmentación truncada por límite de tokens.");
    }
    const textContent = response.content.find((b) => b.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Claude no devolvió texto en la segmentación.");
    }

    const parsed = parseModelJson<{ documents: RawSegment[] }>(textContent.text, "segmentDocumentText");
    const raw = Array.isArray(parsed?.documents) ? parsed.documents : [];
    if (raw.length === 0) throw new Error("Segmentación vacía.");

    const segments = raw.map((seg) => normalizeSegment(seg, input.pages, pageCount));
    console.log(
      `[segmentDocumentText] ${input.fileName}: ${segments.length} documento(s) en ${pageCount} págs → ` +
        segments.map((s) => `[${s.page_start}-${s.page_end} ${s.language.source} ${s.document_type.specific_type} ${s.document_metrics.estimated_words}w]`).join(" ")
    );
    return segments;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("La segmentación del documento ha excedido el tiempo límite.");
    throw err;
  }
}
