// app/api/zona-traductor/expediente/analyze/route.ts
// Análisis de un documento de expediente para STAFF (zona-traductor / admin).
// El archivo ya está subido a Vercel Blob por el cliente; aquí se clasifica con
// el runner por capas (Haiku/texto barato o Sonnet/visión) y se devuelven los
// datos extraídos + precio para prerellenar un presupuesto. Sin los topes de
// rate-limit públicos: un expediente puede tener 16+ documentos.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { runDocumentAnalysis } from "@/lib/ai/run-analysis";
import { censorExtractedNames } from "@/lib/ai/analyze-document";
import { calculatePrice } from "@/lib/pricing-engine/calculator";

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
    const run = await runDocumentAnalysis({ buffer, mimeType, fileName });
    const analysis = run.analysis;
    const analysisMs = Date.now() - started;

    const quote = calculatePrice(analysis);
    const censoredNames = censorExtractedNames(analysis.extracted_data?.names || []);

    await prisma.documentAnalysis.update({
      where: { id: doc.id },
      data: {
        status: "QUOTE_GENERATED",
        analysisJson: analysis as any,
        documentType: analysis.document_type.specific_type,
        documentCategory: analysis.document_type.category,
        sourceLanguage: analysis.language.source,
        targetLanguage: analysis.language.target,
        countryOrigin: analysis.country.origin,
        estimatedWords: analysis.document_metrics.estimated_words,
        complexity: analysis.complexity.level,
        confidence: analysis.document_type.confidence,
        extractedNames: censoredNames,
        extractedDates: analysis.extracted_data?.dates || [],
        quoteAmount: quote.basePrice,
        quoteUrgent: quote.urgentPrice,
        estimatedDays: quote.estimatedDaysStandard,
        estimatedDaysUrgent: quote.estimatedDaysUrgent,
        quoteBreakdown: quote.breakdown as any,
        pageCount: analysis.document_metrics.pages,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: run.mode,
      analysisMs,
      document: {
        id: doc.id,
        fileName,
        documentType: analysis.document_type.specific_type,
        documentTypeEs: analysis.document_type.specific_type_es,
        category: analysis.document_type.category,
        sourceLang: analysis.language.source,
        sourceName: analysis.language.source_name,
        targetLang: analysis.language.target,
        targetName: analysis.language.target_name,
        countryOrigin: analysis.country.origin_name,
        words: analysis.document_metrics.estimated_words,
        pages: analysis.document_metrics.pages,
        complexity: analysis.complexity.level,
        confidence: analysis.document_type.confidence,
        basePrice: quote.basePrice,
        totalPrice: quote.totalPrice,
      },
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
