// app/api/zona-traductor/expediente/analyze/route.ts
// Análisis de un documento de expediente para STAFF (zona-traductor / admin).
// El archivo ya está subido a Vercel Blob por el cliente; aquí se clasifica con
// el runner por capas (Haiku/texto barato o Sonnet/visión) y se devuelven los
// datos extraídos + precio para prerellenar un presupuesto. Sin los topes de
// rate-limit públicos: un expediente puede tener 16+ documentos.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { runDocumentSegmentation } from "@/lib/ai/run-analysis";
import { censorExtractedNames } from "@/lib/ai/analyze-document";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { isAutoPriceable, manualPriceReason, resolvePriceablePair } from "@/lib/pricing-engine/languages";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const documentId = String(body?.documentId || "");
  // Idioma destino del expediente, si el staff lo fijó antes de analizar
  // (caso "idiomas distintos → un tercer idioma", p. ej. todo a inglés).
  const targetLang = String(body?.targetLang || "").trim().toLowerCase() || undefined;

  // Dos modos: analizar un documento YA registrado (expediente entrante,
  // por documentId) o uno recién subido a Blob por el staff (por blobUrl).
  let doc;
  if (documentId) {
    const existing = await prisma.documentAnalysis.findUnique({ where: { id: documentId } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    }
    doc = await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: { status: "ANALYZING" },
    });
  } else {
    const blobUrl = String(body?.blobUrl || "");
    const fileName = String(body?.fileName || "documento").slice(0, 255);
    const fileSize = Number(body?.fileSize) || 0;
    const mimeType = String(body?.mimeType || "application/octet-stream");
    if (!blobUrl) {
      return NextResponse.json({ ok: false, error: "blobUrl o documentId requerido." }, { status: 400 });
    }
    doc = await prisma.documentAnalysis.create({
      data: {
        fileName,
        fileUrl: blobUrl,
        fileSize,
        mimeType,
        sessionToken: `staff:${access.email}`,
        gdprConsent: true,
        gdprConsentAt: new Date(),
        status: "ANALYZING",
      },
    });
  }

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
      return NextResponse.json(
        { ok: false, error: "No se pudo acceder al archivo subido." },
        { status: 422 }
      );
    }

    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    const started = Date.now();
    const run = await runDocumentSegmentation({ buffer, mimeType, fileName, targetLang });
    const analysisMs = Date.now() - started;

    // Un documento por segmento detectado (1..N). Cada uno con su precio —
    // SOLO si el par de idiomas es tarificable: original ES sin destino o par
    // sin español (traducción cruzada) NO llevan precio automático, se
    // analizan a mano (presupuesto 2026-00045: se tarificó es→unknown en
    // silencio con la tarifa por defecto).
    const documents = run.documents.map((d, i) => {
      const a = d.analysis;
      const foreign = resolvePriceablePair(a.language.source, a.language.target);
      const priceable = !!foreign && isAutoPriceable(foreign);
      const quote = priceable ? calculatePrice(a) : null;
      return {
        id: doc.id,
        index: i,
        fileName,
        fileUrl: blobUrl,
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
        complexity: a.complexity.level,
        confidence: a.document_type.confidence,
        basePrice: quote ? quote.basePrice : null,
        totalPrice: quote ? quote.totalPrice : null,
        // El precio viene del SUELO del par (las palabras dan menos): el
        // builder lo señala para que el staff lo vea antes de enviar
        // (expedientes con varios certificados cortos suman un mínimo por doc).
        minimumApplied: quote ? quote.breakdown.minimumApplied : false,
        minimumAmount: quote ? quote.breakdown.minimumAmount : null,
        manualPriceReason: priceable ? null : manualPriceReason(a.language.source, foreign),
        warnings: a.warnings || [],
      };
    });

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
        analysisJson: (run.split ? { segmented: true, documents: run.documents } : primary) as any,
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

    return NextResponse.json({
      ok: true,
      mode: run.mode,
      analysisMs,
      split: run.split,
      documents,
      // Compatibilidad: primer documento como `document`.
      document: documents[0],
    });
  } catch (err: any) {
    console.error("[expediente/analyze]", err?.message || err);
    await prisma.documentAnalysis
      .update({ where: { id: doc.id }, data: { status: "ANALYSIS_FAILED" } })
      .catch(() => {});
    return NextResponse.json(
      { ok: false, error: "No se pudo analizar el documento.", _debug: err?.message },
      { status: 422 }
    );
  }
}
