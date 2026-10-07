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
  return tokens.filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[\t\f\r ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// Render de pdf-parse con un cambio: el de serie pega los fragmentos de una
// misma línea sin espacio («investmentand», «19,371H») y el conteo se queda
// corto (carta de suscripción: 483 en vez de 502). Se separa con espacio solo
// si hay hueco visible entre fragmentos; sin hueco es una palabra partida.
function renderPageText(pageData: any): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((textContent: any) => {
      let lastY: number | undefined;
      let lastEnd = 0;
      let text = "";
      for (const item of textContent.items) {
        const [a, b, , , x, y] = item.transform;
        if (lastY === undefined) text += item.str;
        else if (lastY === y) {
          const fontSize = Math.hypot(a, b) || 10;
          text += (x - lastEnd > fontSize * 0.15 ? " " : "") + item.str;
        } else text += "\n" + item.str;
        lastY = y;
        lastEnd = x + (item.width || 0);
      }
      return text;
    });
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
    // Importar el módulo interno, NO "pdf-parse" (su index.js ejecuta un bloque
    // de debug al cargarse que lee un PDF de prueba inexistente → ENOENT en el
    // bundle de Next/webpack, donde module.parent es falsy).
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    if (typeof pdfParse !== "function") return empty;

    const pages: string[] = [];
    const renderPage = (pageData: any) =>
      renderPageText(pageData).then((text) => {
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
    // Importar el módulo interno, NO "pdf-parse" (su index.js ejecuta un bloque
    // de debug al cargarse que lee un PDF de prueba inexistente → ENOENT en el
    // bundle de Next/webpack, donde module.parent es falsy).
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    if (typeof pdfParse !== "function") return empty;

    const parsed = await pdfParse(buffer, { pagerender: renderPageText });
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
