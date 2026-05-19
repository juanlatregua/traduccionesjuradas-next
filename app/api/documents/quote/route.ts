// app/api/documents/quote/route.ts — Obtener presupuesto de un documento analizado

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { buildDiagnosis } from "@/lib/diagnosis";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `quote:${ip}`,
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ ok: false, error: "documentId requerido." }, { status: 400 });
  }

  const doc = await prisma.documentAnalysis.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      status: true,
      fileName: true,
      documentType: true,
      documentCategory: true,
      sourceLanguage: true,
      targetLanguage: true,
      countryOrigin: true,
      estimatedWords: true,
      complexity: true,
      confidence: true,
      pageCount: true,
      extractedNames: true,
      extractedDates: true,
      quoteAmount: true,
      quoteUrgent: true,
      estimatedDays: true,
      estimatedDaysUrgent: true,
      quoteBreakdown: true,
      analysisJson: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
  }

  let diagnosis = null;
  if (doc.analysisJson) {
    try {
      const analysis = doc.analysisJson as unknown as DocumentAnalysisResult;
      diagnosis = buildDiagnosis(analysis, calculatePrice(analysis));
    } catch (err: any) {
      console.error("[documents/quote] diagnosis error:", err?.message);
    }
  }

  return NextResponse.json({ ok: true, document: doc, diagnosis });
}
