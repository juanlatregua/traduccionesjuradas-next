// app/api/documents/analyze/route.ts — Análisis IA de documentos

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { analyzeDocument, censorExtractedNames } from "@/lib/ai/analyze-document";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { sendQuoteFollowupEmail } from "@/lib/emails/quote-followup";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60s for IA analysis

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Rate limit: 5 análisis por IP por día
  const rl = await checkRateLimit({
    key: `doc-analyze:${ip}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Has superado el límite diario de análisis. Inténtalo mañana." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ ok: false, error: "documentId requerido." }, { status: 400 });
    }

    // Fetch document record
    const doc = await prisma.documentAnalysis.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    }

    // Rate limit por email: 3 análisis por email por día
    if (doc.clientEmail) {
      const rlEmail = await checkRateLimit({
        key: `doc-analyze:email:${doc.clientEmail}`,
        limit: 3,
        windowMs: 24 * 60 * 60 * 1000,
      });
      if (!rlEmail.ok) {
        return NextResponse.json(
          { ok: false, error: "Has superado el límite diario de análisis para este email." },
          { status: 429, headers: { "Retry-After": String(rlEmail.retryAfterSec) } }
        );
      }
    }

    if (doc.status === "ANALYZED" || doc.status === "QUOTE_GENERATED") {
      // Already analyzed — return cached result
      return NextResponse.json({
        ok: true,
        analysis: doc.analysisJson,
        quote: doc.quoteAmount
          ? {
              basePrice: doc.quoteAmount,
              urgentPrice: doc.quoteUrgent,
              estimatedDaysStandard: doc.estimatedDays,
              estimatedDaysUrgent: doc.estimatedDaysUrgent,
              breakdown: doc.quoteBreakdown,
            }
          : null,
        cached: true,
      });
    }

    // Mark as analyzing
    await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: { status: "ANALYZING" },
    });

    // Fetch the file to get base64
    const fileResponse = await fetch(doc.fileUrl);
    if (!fileResponse.ok) {
      await prisma.documentAnalysis.update({
        where: { id: documentId },
        data: { status: "ANALYSIS_FAILED" },
      });
      return NextResponse.json(
        { ok: false, error: "No se pudo acceder al archivo. Vuelve a subirlo." },
        { status: 422 }
      );
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    const fileBase64 = fileBuffer.toString("base64");

    // Call Claude API for analysis
    let analysis;
    try {
      analysis = await analyzeDocument({
        fileBase64,
        mimeType: doc.mimeType,
        fileName: doc.fileName,
      });
    } catch (err: any) {
      console.error("[documents/analyze] Claude error:", err.message);
      await prisma.documentAnalysis.update({
        where: { id: documentId },
        data: { status: "ANALYSIS_FAILED" },
      });
      return NextResponse.json(
        {
          ok: false,
          error: "No hemos podido analizar el documento. Puedes contactarnos por WhatsApp para una respuesta rápida.",
          whatsappUrl: "https://wa.me/34951333614",
        },
        { status: 422 }
      );
    }

    // Calculate price
    const quote = calculatePrice(analysis);

    // Censor names for GDPR
    const censoredNames = censorExtractedNames(analysis.extracted_data.names || []);

    // Update document record
    await prisma.documentAnalysis.update({
      where: { id: documentId },
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
        extractedDates: analysis.extracted_data.dates || [],
        quoteAmount: quote.basePrice,
        quoteUrgent: quote.urgentPrice,
        estimatedDays: quote.estimatedDaysStandard,
        estimatedDaysUrgent: quote.estimatedDaysUrgent,
        quoteBreakdown: quote.breakdown as any,
        pageCount: analysis.document_metrics.pages,
      },
    });

    // Send follow-up email (fire-and-forget, non-blocking)
    if (doc.clientEmail && doc.clientName) {
      sendQuoteFollowupEmail({
        email: doc.clientEmail,
        name: doc.clientName,
        documentType: analysis.document_type.specific_type_es,
        price: quote.basePrice,
        langPair: `${analysis.language.source_name} → ${analysis.language.target_name}`,
        estimatedDays: quote.estimatedDaysStandard,
      }).catch((err) => {
        console.error("[documents/analyze] Follow-up email error:", err.message);
      });
    }

    return NextResponse.json({
      ok: true,
      analysis,
      quote,
      cached: false,
    });
  } catch (err: any) {
    console.error("[documents/analyze]", err);
    return NextResponse.json(
      { ok: false, error: "Error interno al analizar el documento." },
      { status: 500 }
    );
  }
}
