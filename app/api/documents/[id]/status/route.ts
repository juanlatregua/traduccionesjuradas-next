// app/api/documents/[id]/status/route.ts — Estado del pedido asociado a un documento

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const doc = await prisma.documentAnalysis.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      documentType: true,
      sourceLanguage: true,
      targetLanguage: true,
      quoteAmount: true,
      estimatedDays: true,
      order: {
        select: {
          reference: true,
          status: true,
          paymentStatus: true,
          deliveryState: true,
          translatedFileUrl: true,
          dueDate: true,
        },
      },
    },
  });

  if (!doc) {
    return NextResponse.json({ ok: false, error: "No encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    document: {
      id: doc.id,
      status: doc.status,
      documentType: doc.documentType,
      sourceLanguage: doc.sourceLanguage,
      targetLanguage: doc.targetLanguage,
      quoteAmount: doc.quoteAmount,
      estimatedDays: doc.estimatedDays,
    },
    order: doc.order
      ? {
          reference: doc.order.reference,
          status: doc.order.status,
          paymentStatus: doc.order.paymentStatus,
          deliveryState: doc.order.deliveryState,
          translationUrl: doc.order.translatedFileUrl,
          dueDate: doc.order.dueDate,
        }
      : null,
  });
}
