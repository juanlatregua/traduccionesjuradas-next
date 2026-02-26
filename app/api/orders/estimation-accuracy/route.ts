import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type SampleRow = {
  orderId: string;
  estimatedWords: number;
  finalWords: number;
  wordsDeltaPct: number;
  estimatedTotal: number;
  finalTotal: number;
  priceDeltaPct: number;
  wasAccurate: boolean;
  extractionMethod: string | null;
  documentType: string | null;
  confidence: number | null;
};

type BucketStats = { samples: number; accuracyRate: number };

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  try {
    const estimationEvents = await prisma.orderEvent.findMany({
      where: { type: "order.estimation_snapshot" },
      select: { orderId: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const orderIds = [...new Set(estimationEvents.map((e) => e.orderId))];
    if (orderIds.length === 0) {
      return NextResponse.json({
        ok: true,
        totalSamples: 0,
        accurateCount: 0,
        accuracyRate: 0,
        avgPriceDeltaPct: 0,
        byExtractionMethod: {},
        byDocumentType: {},
        byConfidenceBand: {
          high_085_plus: { samples: 0, accuracyRate: 0 },
          medium_070_084: { samples: 0, accuracyRate: 0 },
          low_below_070: { samples: 0, accuracyRate: 0 },
        },
        samples: [],
      });
    }

    const finalEvents = await prisma.orderEvent.findMany({
      where: { orderId: { in: orderIds }, type: "order.quote_final_snapshot" },
      select: { orderId: true, payload: true },
      orderBy: { createdAt: "desc" },
    });

    const finalByOrder = new Map<string, any>();
    for (const fe of finalEvents) {
      if (!finalByOrder.has(fe.orderId)) {
        finalByOrder.set(fe.orderId, fe.payload);
      }
    }

    const samples: SampleRow[] = [];

    for (const est of estimationEvents) {
      const final = finalByOrder.get(est.orderId);
      if (!final) continue;

      const estPayload = est.payload as any;
      const estimatedWords = Number(estPayload?.words ?? 0);
      const estimatedTotalCents = Number(estPayload?.estimatedTotalCents ?? 0);
      const estimatedTotal = estimatedTotalCents / 100;

      const finalWords = Number(final?.finalWords ?? 0);
      const finalTotal = Number(final?.finalTotal ?? 0);

      const wordsDeltaPct =
        estimatedWords > 0
          ? Math.abs(finalWords - estimatedWords) / estimatedWords * 100
          : 0;
      const priceDeltaPct =
        estimatedTotal > 0
          ? Math.abs(finalTotal - estimatedTotal) / estimatedTotal * 100
          : 0;
      const wasAccurate = priceDeltaPct <= 10;

      samples.push({
        orderId: est.orderId,
        estimatedWords,
        finalWords,
        wordsDeltaPct: Math.round(wordsDeltaPct * 100) / 100,
        estimatedTotal,
        finalTotal,
        priceDeltaPct: Math.round(priceDeltaPct * 100) / 100,
        wasAccurate,
        extractionMethod: estPayload?.extractionMethod ?? null,
        documentType: estPayload?.documentType ?? null,
        confidence: estPayload?.confidence != null ? Number(estPayload.confidence) : null,
      });
    }

    const totalSamples = samples.length;
    const accurateCount = samples.filter((s) => s.wasAccurate).length;
    const accuracyRate = totalSamples > 0 ? Math.round((accurateCount / totalSamples) * 10000) / 100 : 0;
    const avgPriceDeltaPct =
      totalSamples > 0
        ? Math.round((samples.reduce((acc, s) => acc + s.priceDeltaPct, 0) / totalSamples) * 100) / 100
        : 0;

    // By extraction method
    const byExtractionMethod: Record<string, BucketStats> = {};
    for (const s of samples) {
      const key = s.extractionMethod || "unknown";
      if (!byExtractionMethod[key]) byExtractionMethod[key] = { samples: 0, accuracyRate: 0 };
      byExtractionMethod[key].samples++;
    }
    for (const key of Object.keys(byExtractionMethod)) {
      const bucket = samples.filter((s) => (s.extractionMethod || "unknown") === key);
      const acc = bucket.filter((s) => s.wasAccurate).length;
      byExtractionMethod[key].accuracyRate =
        bucket.length > 0 ? Math.round((acc / bucket.length) * 10000) / 100 : 0;
    }

    // By document type
    const byDocumentType: Record<string, BucketStats> = {};
    for (const s of samples) {
      const key = s.documentType || "unknown";
      if (!byDocumentType[key]) byDocumentType[key] = { samples: 0, accuracyRate: 0 };
      byDocumentType[key].samples++;
    }
    for (const key of Object.keys(byDocumentType)) {
      const bucket = samples.filter((s) => (s.documentType || "unknown") === key);
      const acc = bucket.filter((s) => s.wasAccurate).length;
      byDocumentType[key].accuracyRate =
        bucket.length > 0 ? Math.round((acc / bucket.length) * 10000) / 100 : 0;
    }

    // By confidence band
    function getConfidenceBand(c: number | null): "high_085_plus" | "medium_070_084" | "low_below_070" {
      if (c == null) return "low_below_070";
      if (c >= 0.85) return "high_085_plus";
      if (c >= 0.70) return "medium_070_084";
      return "low_below_070";
    }
    const bands = {
      high_085_plus: { samples: 0, accuracyRate: 0 },
      medium_070_084: { samples: 0, accuracyRate: 0 },
      low_below_070: { samples: 0, accuracyRate: 0 },
    };
    for (const s of samples) {
      bands[getConfidenceBand(s.confidence)].samples++;
    }
    for (const band of ["high_085_plus", "medium_070_084", "low_below_070"] as const) {
      const bucket = samples.filter((s) => getConfidenceBand(s.confidence) === band);
      const acc = bucket.filter((s) => s.wasAccurate).length;
      bands[band].accuracyRate =
        bucket.length > 0 ? Math.round((acc / bucket.length) * 10000) / 100 : 0;
    }

    return NextResponse.json({
      ok: true,
      totalSamples,
      accurateCount,
      accuracyRate,
      avgPriceDeltaPct,
      byExtractionMethod,
      byDocumentType,
      byConfidenceBand: bands,
      samples,
    });
  } catch (err) {
    console.error("[estimation-accuracy] error", err);
    return NextResponse.json({ ok: false, error: "Error al calcular precision." }, { status: 500 });
  }
}
