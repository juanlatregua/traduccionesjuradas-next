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

export type PdfPagesExtraction = {
  pages: string[]; // texto por página (índice 0 = página 1)
  pageCount: number;
  hasTextLayer: boolean;
};

// Extrae el texto PÁGINA A PÁGINA (no concatenado). Necesario para segmentar un
// PDF fusionado en varios documentos: el modelo devuelve rangos de página y
// contamos las palabras de cada documento sobre el texto de SUS páginas.
export async function extractPdfPages(buffer: Buffer): Promise<PdfPagesExtraction> {
  const empty: PdfPagesExtraction = { pages: [], pageCount: 0, hasTextLayer: false };
  try {
    const pdfParse = require("pdf-parse");
    if (typeof pdfParse !== "function") return empty;

    const pages: string[] = [];
    // Mismo render que el por defecto de pdf-parse, pero acumulando por página.
    const renderPage = (pageData: any) =>
      pageData
        .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        .then((textContent: any) => {
          let lastY: number | undefined;
          let text = "";
          for (const item of textContent.items) {
            if (lastY === item.transform[5] || lastY === undefined) text += item.str;
            else text += "\n" + item.str;
            lastY = item.transform[5];
          }
          pages.push(normalizeWhitespace(text));
          return text;
        });

    const parsed = await pdfParse(buffer, { pagerender: renderPage });
    const pageCount = Number(parsed?.numpages) || pages.length;
    const totalWords = pages.reduce((s, p) => s + countWords(p), 0);
    const wordsPerPage = pageCount > 0 ? totalWords / pageCount : totalWords;
    const hasTextLayer = totalWords >= MIN_TOTAL_WORDS && wordsPerPage >= MIN_WORDS_PER_PAGE;

    return { pages, pageCount, hasTextLayer };
  } catch (err) {
    console.error("[extract-text] per-page error:", err);
    return empty;
  }
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
