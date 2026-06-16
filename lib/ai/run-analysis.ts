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
import { extractPdfText, extractPdfPages } from "./extract-text";
import { segmentDocumentText, makePlaceholderSegment } from "./segment-document";
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

/* ------------------------------------------------------------------ */
/*  Segmentación: un archivo → 1..N documentos                         */
/*  Maneja el caso de clientes que mandan varios documentos fusionados */
/*  en un solo PDF (a veces en idiomas distintos). Solo intenta dividir */
/*  PDFs con capa de texto; escaneos/imágenes caen a 1 documento.      */
/* ------------------------------------------------------------------ */

export type SegmentedDocument = {
  analysis: DocumentAnalysisResult;
  pageStart: number;
  pageEnd: number;
};

export type SegmentedRun = {
  documents: SegmentedDocument[];
  mode: "text" | "vision";
  pageCount?: number;
  split: boolean; // true si se detectó más de un documento en el archivo
};

function wrapSingle(run: AnalysisRun, pageCount?: number): SegmentedRun {
  const pages = pageCount || run.pageCount || run.analysis.document_metrics.pages || 1;
  return {
    documents: [{ analysis: run.analysis, pageStart: 1, pageEnd: pages }],
    mode: run.mode,
    pageCount: pages,
    split: false,
  };
}

export async function runDocumentSegmentation(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  targetLang?: string; // destino fijado por el staff (p. ej. "en")
}): Promise<SegmentedRun> {
  const { buffer, mimeType, fileName, targetLang } = input;

  // Imágenes y no-PDF: no se segmentan (un archivo = un documento).
  if (mimeType !== "application/pdf") {
    return wrapSingle(await runDocumentAnalysis(input));
  }

  const perPage = await extractPdfPages(buffer);

  // Escaneo / sin capa de texto fiable / una sola página → camino normal (1 doc).
  // (La segmentación automática de escaneos queda fuera de alcance por ahora;
  // el staff puede dividirlos a mano.)
  if (!perPage.hasTextLayer || perPage.pages.length <= 1) {
    return wrapSingle(await runDocumentAnalysis(input), perPage.pageCount || undefined);
  }

  // PDF digital multipágina → segmentar (devuelve 1..N).
  let segments;
  try {
    segments = await segmentDocumentText({ pages: perPage.pages, fileName, targetLang });
  } catch (err) {
    console.error("[run-analysis] segmentación falló, fallback a 1 documento:", err);
    return wrapSingle(await runDocumentAnalysis(input), perPage.pageCount || undefined);
  }

  // Cubrir páginas sin texto (escaneadas) que el segmentador no vio → no perder
  // documentos en silencio: se añaden como placeholders editables con aviso.
  const covered = new Set<number>();
  for (const s of segments) for (let pg = s.page_start; pg <= s.page_end; pg += 1) covered.add(pg);
  const gaps: Array<[number, number]> = [];
  for (let pg = 1; pg <= perPage.pageCount; pg += 1) {
    if (covered.has(pg)) continue;
    const last = gaps[gaps.length - 1];
    if (last && last[1] === pg - 1) last[1] = pg;
    else gaps.push([pg, pg]);
  }
  for (const [start, end] of gaps) segments.push(makePlaceholderSegment(start, end, targetLang));
  segments.sort((a, b) => a.page_start - b.page_start);

  const documents: SegmentedDocument[] = segments.map((seg) => {
    const text = perPage.pages.slice(seg.page_start - 1, seg.page_end).join("\n");
    const analysis = finalizeAnalysis(seg, { extractedText: text, fileName });
    return { analysis, pageStart: seg.page_start, pageEnd: seg.page_end };
  });

  return {
    documents,
    mode: "text",
    pageCount: perPage.pageCount,
    split: documents.length > 1,
  };
}
