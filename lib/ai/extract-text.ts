// lib/ai/extract-text.ts — Extracción de capa de texto de PDFs (pdf-parse)
//
// Objetivo: ahorro de tokens. Muchos documentos de un expediente (IRPF,
// nóminas, modelo 390, estados de cuenta, escrituras) son PDFs DIGITALES con
// capa de texto. Para esos no hace falta enviar la imagen a Claude (visión con
// Sonnet, caro): basta extraer el texto y clasificar con Haiku sobre texto.
// Solo los escaneos/imágenes (sin capa de texto) van por el camino de visión.

export type PdfTextExtraction = {
  text: string;
  pages: number;
  wordsPerPage: number;
  hasTextLayer: boolean;
};

// Umbral: si el PDF tiene al menos esta densidad media de palabras por página
// y un mínimo total, lo tratamos como digital (capa de texto fiable). Por
// debajo asumimos escaneo (texto residual o vacío) → camino de visión.
const MIN_WORDS_PER_PAGE = 40;
const MIN_TOTAL_WORDS = 30;

function countWords(text: string): number {
  const tokens = text.split(/\s+/).filter(Boolean);
  return tokens.filter((t) => /\p{L}/u.test(t)).length;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[\t\f\r ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractPdfText(buffer: Buffer): Promise<PdfTextExtraction> {
  const empty: PdfTextExtraction = { text: "", pages: 0, wordsPerPage: 0, hasTextLayer: false };
  try {
    // Carga dinámica: si pdf-parse falla, devolvemos sin capa de texto y el
    // llamador cae al camino de visión.
    const pdfParse = require("pdf-parse");
    if (typeof pdfParse !== "function") return empty;

    const parsed = await pdfParse(buffer);
    const text = normalizeWhitespace(String(parsed?.text || ""));
    const pages = Number(parsed?.numpages) || 0;
    const words = countWords(text);
    const wordsPerPage = pages > 0 ? words / pages : words;
    const hasTextLayer = words >= MIN_TOTAL_WORDS && wordsPerPage >= MIN_WORDS_PER_PAGE;

    return { text, pages, wordsPerPage: Math.round(wordsPerPage), hasTextLayer };
  } catch (err) {
    console.error("[extract-text] pdf-parse error:", err);
    return empty;
  }
}
