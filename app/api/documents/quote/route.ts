// app/api/documents/quote/route.ts — Obtener presupuesto de un documento analizado

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

  return NextResponse.json({ ok: true, document: doc });
}
