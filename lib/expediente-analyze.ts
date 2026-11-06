// lib/expediente-analyze.ts — Análisis de un documento de expediente (staff y
// agente de bandeja). El archivo ya está en Vercel Blob; se clasifica con el
// runner por capas (Haiku/texto barato o Sonnet/visión) y se guarda el análisis
// segmentado + precio en la fila DocumentAnalysis (status QUOTE_GENERATED).

import { prisma } from "@/lib/prisma";
import { runDocumentSegmentation, type SegmentedRun } from "@/lib/ai/run-analysis";
import { censorExtractedNames } from "@/lib/ai/analyze-document";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { PAGE_PRICED_LANGS } from "@/lib/pricing-engine/page-pricing";
import { expandZipDocument, isZipDocument } from "@/lib/expediente-unzip";
import { getLanguageName, isAutoPriceable, manualPriceReason, resolvePriceablePair } from "@/lib/pricing-engine/languages";

// Análisis ya hecho por este endpoint (marca builderRun): se reconstruye sin volver
// a llamar a la IA. Antes cada apertura del builder con ?exp/?session/?lead volvía a
// segmentar y la IA podía partir el PDF de otra manera (Fortuny, 10-sep-2026). Lo
// analizado por la puerta pública no lleva la marca y se segmenta aquí como siempre.
function savedRun(json: any, pageCount: number): SegmentedRun | null {
  const mode = json?.builderRun?.mode;
  if (mode !== "text" && mode !== "vision") return null;
  if (json.segmented) {
    if (!Array.isArray(json.documents) || json.documents.length === 0) return null;
    return { documents: json.documents, mode, pageCount, split: json.documents.length > 1 };
  }
  const { builderRun, ...analysis } = json;
  const pages = pageCount || analysis.document_metrics?.pages || 1;
  const absorbedPages = Array.isArray(builderRun.absorbedPages) && builderRun.absorbedPages.length ? builderRun.absorbedPages : undefined;
  return { documents: [{ analysis, pageStart: 1, pageEnd: pages, absorbedPages }], mode, pageCount: pages, split: false };
}

// Un documento por segmento detectado (1..N). Cada uno con su precio — SOLO si el
// par de idiomas es tarificable: original ES sin destino o par sin español
// (traducción cruzada) NO llevan precio automático, se analizan a mano
// (presupuesto 2026-00045: se tarificó es→unknown en silencio con la tarifa por defecto).
export function toBuilderDocuments(
  run: SegmentedRun,
  ctx: { id: string; fileName: string; fileUrl: string; targetLang?: string }
) {
  const { targetLang } = ctx;
  return run.documents.map((d, i) => {
    const a = d.analysis;
    // Original ES sin destino detectado + destino fijado por el staff → el
    // destino del expediente manda (el camino de 1 documento no se lo pasa al
    // modelo; sin esto la fila llegaba "a mano" con el par ES→EN a la vista).
    const srcIsEs = (a.language.source || "").toLowerCase() === "es";
    const tgtUnknown = !a.language.target || a.language.target === "unknown";
    if (targetLang && targetLang !== "es" && srcIsEs && tgtUnknown) {
      a.language = { ...a.language, target: targetLang, target_name: getLanguageName(targetLang) };
    }
    const foreign = resolvePriceablePair(a.language.source, a.language.target);
    // Apostilla clasificada como documento propio (fr/de): no se cobra sola; el
    // builder le suma +5 € si acompaña a un documento por página (pairApostilles).
    const apostilleAlone = a.document_type.specific_type === "apostille" && a.language.source !== "es" && PAGE_PRICED_LANGS.has(String(foreign));
    const priceable = !!foreign && isAutoPriceable(foreign) && !apostilleAlone;
    const quote = priceable ? calculatePrice(a) : null;
    return {
      id: ctx.id,
      index: i,
      fileName: ctx.fileName,
      fileUrl: ctx.fileUrl,
      documentType: a.document_type.specific_type,
      documentTypeEs: a.document_type.specific_type_es,
      category: a.document_type.category,
      sourceLang: a.language.source,
      sourceName: a.language.source_name,
      targetLang: a.language.target,
      targetName: a.language.target_name,
      countryOrigin: a.country.origin_name,
      countryCode: a.country?.origin ?? null,
      hasApostille: !!a.requirements?.has_apostille,
      words: a.document_metrics.estimated_words,
      pages: a.document_metrics.pages,
      pageStart: d.pageStart,
      pageEnd: d.pageEnd,
      absorbedPages: d.absorbedPages ?? null,
      complexity: a.complexity.level,
      confidence: a.document_type.confidence,
      hasTables: !!a.document_metrics.has_tables,
      apostilleSeparatePage: a.requirements?.apostille_separate_page === true,
      // En el builder basePrice es el COSTE de la línea. Con tarifa por página
      // DE→ES el coste es el de Morton (10/15 €/pág.) y el precio de venta va
      // aparte en clientPrice; FR (coste 0, motor propio) conserva coste = precio.
      basePrice: quote ? (quote.pagePricing && quote.pagePricing.costPerPage > 0 ? quote.pagePricing.costEur : quote.basePrice) : null,
      clientPrice: quote?.pagePricing && quote.pagePricing.costPerPage > 0 ? quote.pagePricing.priceEur : null,
      totalPrice: quote ? quote.totalPrice : null,
      // El precio viene del SUELO del par (las palabras dan menos): el
      // builder lo señala para que el staff lo vea antes de enviar
      // (expedientes con varios certificados cortos suman un mínimo por doc).
      minimumApplied: quote ? quote.breakdown.minimumApplied : false,
      minimumAmount: quote ? quote.breakdown.minimumAmount : null,
      manualPriceReason: priceable
        ? null
        : apostilleAlone
          ? "Apostilla suelta: +5 € si acompaña a un documento por página; si no, precio a mano"
          : manualPriceReason(a.language.source, foreign),
      warnings: a.warnings || [],
    };
  });
}

export type BuilderDocument = ReturnType<typeof toBuilderDocuments>[number];

export type ExpedienteAnalyzeResult =
  | { ok: true; mode: SegmentedRun["mode"]; analysisMs: number; cached: boolean; split: boolean; documents: BuilderDocument[]; run: SegmentedRun }
  | { ok: false; status: 404 | 422; error: string; debug?: string };

type AnalyzableDoc = { id: string; fileName: string; mimeType: string; fileUrl: string };

/** Analiza una fila DocumentAnalysis ya marcada ANALYZING y guarda el resultado. */
export async function analyzeDocumentRow(doc: AnalyzableDoc, targetLang?: string): Promise<ExpedienteAnalyzeResult> {
  const fileName = doc.fileName;
  const mimeType = doc.mimeType;
  const blobUrl = doc.fileUrl;

  try {
    const fileResponse = await fetch(blobUrl);
    if (!fileResponse.ok) {
      await prisma.documentAnalysis.update({
        where: { id: doc.id },
        data: { status: "ANALYSIS_FAILED" },
      });
      return { ok: false, status: 422, error: "No se pudo acceder al archivo subido." };
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    const started = Date.now();
    const run = await runDocumentSegmentation({ buffer, mimeType, fileName, targetLang });
    const analysisMs = Date.now() - started;

    const documents = toBuilderDocuments(run, { id: doc.id, fileName, fileUrl: blobUrl, targetLang });

    // Persistencia del archivo: agregada cuando hay varios documentos.
    const primary = run.documents[0].analysis;
    const totalWords = run.documents.reduce((s, d) => s + (d.analysis.document_metrics.estimated_words || 0), 0);
    // Agregados SOLO de los documentos tarificables; si ninguno lo es, el
    // quoteAmount queda null (precio a mano, no 0).
    const pricedCount = documents.filter((d) => d.basePrice != null).length;
    const totalBase = documents.reduce((s, d) => s + (d.basePrice || 0), 0);
    const totalUrgent = run.documents.reduce(
      (s, d, i) => (documents[i].basePrice != null ? s + (calculatePrice(d.analysis).urgentPrice || 0) : s),
      0
    );
    const censoredNames = censorExtractedNames(
      run.documents.flatMap((d) => d.analysis.extracted_data?.names || [])
    );

    await prisma.documentAnalysis.update({
      where: { id: doc.id },
      data: {
        status: "QUOTE_GENERATED",
        // Sin marca si la segmentación falló: la próxima apertura lo reintenta.
        analysisJson: (run.split
          ? { segmented: true, documents: run.documents, ...(run.degraded ? {} : { builderRun: { mode: run.mode } }) }
          : {
              ...primary,
              ...(run.degraded ? {} : { builderRun: { mode: run.mode, absorbedPages: run.documents[0].absorbedPages } }),
            }) as any,
        documentType: run.split ? "expediente_combinado" : primary.document_type.specific_type,
        documentCategory: primary.document_type.category,
        sourceLanguage: primary.language.source,
        targetLanguage: primary.language.target,
        countryOrigin: primary.country.origin,
        estimatedWords: totalWords,
        complexity: primary.complexity.level,
        confidence: primary.document_type.confidence,
        extractedNames: censoredNames,
        extractedDates: run.documents.flatMap((d) => d.analysis.extracted_data?.dates || []),
        quoteAmount: pricedCount ? totalBase : null,
        quoteUrgent: pricedCount ? totalUrgent : null,
        // Sin par tarificable no se persiste plazo ni breakdown del engine:
        // serían datos calculados con el fallback DEFAULT_RATE junto a un
        // quoteAmount null (residual engañoso).
        estimatedDays: documents[0].basePrice != null ? calculatePrice(primary).estimatedDaysStandard : null,
        estimatedDaysUrgent: documents[0].basePrice != null ? calculatePrice(primary).estimatedDaysUrgent : null,
        quoteBreakdown: (run.split
          ? { segments: documents }
          : documents[0].basePrice != null
            ? calculatePrice(primary).breakdown
            : null) as any,
        pageCount: run.pageCount || primary.document_metrics.pages,
      },
    });

    return { ok: true, mode: run.mode, analysisMs, cached: false, split: run.split, documents, run };
  } catch (err: any) {
    console.error("[expediente/analyze]", err?.message || err);
    await prisma.documentAnalysis
      .update({ where: { id: doc.id }, data: { status: "ANALYSIS_FAILED" } })
      .catch(() => {});
    return { ok: false, status: 422, error: "No se pudo analizar el documento.", debug: err?.message };
  }
}

/** Documento de expediente YA registrado (por id): reutiliza el análisis guardado o lo analiza. */
export async function analyzeExpedienteDocument(documentId: string, opts: { targetLang?: string } = {}): Promise<ExpedienteAnalyzeResult> {
  const existing = await prisma.documentAnalysis.findUnique({ where: { id: documentId } });
  if (!existing) return { ok: false, status: 404, error: "Documento no encontrado." };
  // ZIP: se abre y se analiza cada archivo de dentro como documento propio.
  if (isZipDocument(existing)) {
    const z = await expandZipDocument(existing.id).catch((e) => {
      console.error("[expediente/analyze] zip", e?.message || e);
      return null;
    });
    if (!z || z.ids.length === 0) return { ok: false, status: 422, error: "No se pudo abrir el ZIP: pide los documentos sueltos." };
    const parts: Extract<ExpedienteAnalyzeResult, { ok: true }>[] = [];
    for (const id of z.ids) {
      const r = await analyzeExpedienteDocument(id, opts);
      if (r.ok) parts.push(r);
    }
    if (parts.length === 0) return { ok: false, status: 422, error: "ZIP abierto, pero no se pudo analizar ningún documento." };
    const run: SegmentedRun = {
      documents: parts.flatMap((p) => p.run.documents),
      mode: parts.some((p) => p.mode === "vision") ? "vision" : "text",
      pageCount: parts.reduce((s, p) => s + (p.run.pageCount || 0), 0),
      split: true,
    };
    return {
      ok: true,
      mode: run.mode,
      analysisMs: parts.reduce((s, p) => s + p.analysisMs, 0),
      cached: parts.every((p) => p.cached),
      split: true,
      documents: parts.flatMap((p) => p.documents),
      run,
    };
  }
  const saved = existing.status === "QUOTE_GENERATED" ? savedRun(existing.analysisJson, existing.pageCount) : null;
  if (saved) {
    const documents = toBuilderDocuments(saved, {
      id: existing.id,
      fileName: existing.fileName,
      fileUrl: existing.fileUrl,
      targetLang: opts.targetLang,
    });
    return { ok: true, mode: saved.mode, analysisMs: 0, cached: true, split: saved.split, documents, run: saved };
  }
  const doc = await prisma.documentAnalysis.update({
    where: { id: documentId },
    data: { status: "ANALYZING" },
  });
  return analyzeDocumentRow(doc, opts.targetLang);
}
