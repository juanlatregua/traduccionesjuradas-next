// lib/ai/run-analysis.ts — Runner de análisis por capas (ahorro de tokens)
//
// Decide el camino más barato para clasificar un documento:
//  - PDF con capa de texto (digital): extrae texto y clasifica con Haiku sobre
//    texto, SIN enviar la imagen (camino "text"). ~15× más barato.
//  - PDF escaneado / imagen: visión con Sonnet (camino "vision"), truncando
//    PDFs largos a las 3 primeras páginas como hasta ahora.
//
// Lo usan el endpoint público (/api/documents/analyze) y el endpoint de staff
// (/api/zona-traductor/expediente/analyze) para extraer datos del expediente.

import { analyzeDocument, analyzeDocumentText } from "./analyze-document";
import type { DocumentAnalysisResult } from "./analyze-document";
import { extractPdfText } from "./extract-text";
import { countDocumentWords } from "./word-counter";
import { assessAutoPriceRisk } from "./price-risk";

// Suelo determinista: el conteo nunca debe quedar por debajo de las palabras
// que la capa de texto del PDF sí extrae (la visión de Claude infracuenta
// formularios repetitivos). Además marca el riesgo de autotarificación.
function finalizeAnalysis(
  analysis: DocumentAnalysisResult,
  opts: { extractedText?: string; fileName?: string }
): DocumentAnalysisResult {
  if (opts.extractedText) {
    const floor = countDocumentWords(opts.extractedText);
    if (floor > (analysis.document_metrics.estimated_words || 0)) {
      analysis.document_metrics.estimated_words = floor;
    }
  }
  analysis.price_risk = assessAutoPriceRisk({
    analysis,
    extractedText: opts.extractedText,
    fileName: opts.fileName,
  });
  return analysis;
}

const LARGE_DOC_THRESHOLD = 5; // pages
const TRUNCATE_TO_PAGES = 3;

export type AnalysisRun = {
  analysis: DocumentAnalysisResult;
  mode: "text" | "vision";
  pageCount?: number;
};

export async function runDocumentAnalysis(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<AnalysisRun> {
  const { buffer, mimeType, fileName } = input;

  if (mimeType !== "application/pdf") {
    // Imágenes: siempre visión.
    const analysis = await analyzeDocument({
      fileBase64: buffer.toString("base64"),
      mimeType,
      fileName,
    });
    return { analysis: finalizeAnalysis(analysis, { fileName }), mode: "vision" };
  }

  // PDF: contar páginas (pdf-lib) + extraer texto (pdf-parse).
  let pageCount: number | undefined;
  try {
    const { PDFDocument } = require("pdf-lib");
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = pdfDoc.getPageCount();
  } catch (err) {
    console.error("[run-analysis] pdf-lib pageCount error:", err);
  }

  const extraction = await extractPdfText(buffer);
  if (!pageCount) pageCount = extraction.pages || undefined;

  // Camino barato: capa de texto fiable → Haiku sobre texto.
  if (extraction.hasTextLayer) {
    console.log(
      `[run-analysis] ${fileName}: TEXT path (${extraction.wordsPerPage} w/pág, ${pageCount} págs)`
    );
    const analysis = await analyzeDocumentText({
      text: extraction.text,
      fileName,
      pageCount,
    });
    return {
      analysis: finalizeAnalysis(analysis, { extractedText: extraction.text, fileName }),
      mode: "text",
      pageCount,
    };
  }

  // Camino visión: escaneo / imagen embebida. Truncar PDFs grandes.
  let analyzeBuffer = buffer;
  if (pageCount && pageCount > LARGE_DOC_THRESHOLD) {
    try {
      const { PDFDocument } = require("pdf-lib");
      const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const truncated = await PDFDocument.create();
      const pagesToCopy = Math.min(TRUNCATE_TO_PAGES, pageCount);
      const copied = await truncated.copyPages(
        src,
        Array.from({ length: pagesToCopy }, (_, i) => i)
      );
      copied.forEach((page: any) => truncated.addPage(page));
      analyzeBuffer = Buffer.from(await truncated.save());
      console.log(
        `[run-analysis] ${fileName}: VISION path, truncado ${pageCount}→${pagesToCopy} págs`
      );
    } catch (err) {
      console.error("[run-analysis] truncate error, usando buffer completo:", err);
    }
  } else {
    console.log(`[run-analysis] ${fileName}: VISION path (${pageCount} págs)`);
  }

  const analysis = await analyzeDocument({
    fileBase64: analyzeBuffer.toString("base64"),
    mimeType,
    fileName,
    pageCount,
  });
  return {
    analysis: finalizeAnalysis(analysis, { extractedText: extraction.text, fileName }),
    mode: "vision",
    pageCount,
  };
}
