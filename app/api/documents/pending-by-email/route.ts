import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit({
    key: `pending-email:${ip}`,
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  });

  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const excludeRaw = searchParams.get("exclude") || "";
  const excludeIds = excludeRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "email es obligatorio." },
      { status: 400 }
    );
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const docs = await prisma.documentAnalysis.findMany({
    where: {
      clientEmail: email,
      status: { in: ["QUOTE_GENERATED", "ANALYZED"] },
      orderId: null,
      createdAt: { gt: cutoff },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    select: {
      id: true,
      analysisJson: true,
      quoteAmount: true,
      quoteUrgent: true,
      quoteBreakdown: true,
      estimatedDays: true,
      estimatedDaysUrgent: true,
      sourceLanguage: true,
      targetLanguage: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const documents = docs
    .filter((d) => d.quoteAmount)
    .map((d) => {
      const analysis = d.analysisJson as any;
      return {
        id: d.id,
        specificTypeEs:
          analysis?.document_type?.specific_type_es || "Documento",
        sourceName:
          analysis?.language?.source_name ||
          d.sourceLanguage?.toUpperCase() ||
          "?",
        targetName:
          analysis?.language?.target_name ||
          d.targetLanguage?.toUpperCase() ||
          "Español",
        basePrice: d.quoteAmount!,
        urgentPrice: d.quoteUrgent || d.quoteAmount!,
        analysisJson: d.analysisJson,
        quoteBreakdown: d.quoteBreakdown,
        estimatedDays: d.estimatedDays,
        estimatedDaysUrgent: d.estimatedDaysUrgent,
      };
    });

  return NextResponse.json({ ok: true, documents });
}
