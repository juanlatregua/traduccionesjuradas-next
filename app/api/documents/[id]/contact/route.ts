// app/api/documents/[id]/contact/route.ts — Guardar datos de contacto + enviar email con presupuesto

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendQuoteFollowupEmail } from "@/lib/emails/quote-followup";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit({
    key: `doc-upload:${ip}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Has superado el límite diario. Inténtalo mañana." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const { clientName, clientEmail, clientPhone } = body;

    if (!clientName?.trim() || !clientEmail?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Nombre y email son obligatorios." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(clientEmail.trim())) {
      return NextResponse.json(
        { ok: false, error: "Email no válido." },
        { status: 400 }
      );
    }

    const { id } = params;

    const doc = await prisma.documentAnalysis.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        quoteAmount: true,
        estimatedDays: true,
        sourceLanguage: true,
        targetLanguage: true,
        analysisJson: true,
      },
    });

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "Documento no encontrado." },
        { status: 404 }
      );
    }

    const email = clientEmail.trim().toLowerCase();

    await prisma.documentAnalysis.update({
      where: { id },
      data: {
        clientName: clientName.trim(),
        clientEmail: email,
        clientPhone: clientPhone?.trim() || null,
      },
    });

    // Send quote email (non-blocking) if we have price data
    if (doc.quoteAmount) {
      const analysis = doc.analysisJson as any;
      const documentType =
        analysis?.document_type?.specific_type_es || "Documento";
      const langSource = (doc.sourceLanguage || "?").toUpperCase();
      const langTarget = (doc.targetLanguage || "es").toUpperCase();

      sendQuoteFollowupEmail({
        email,
        name: clientName.trim(),
        documentType,
        price: doc.quoteAmount,
        totalPrice: Math.round(doc.quoteAmount * 1.21 * 100) / 100,
        langPair: `${langSource} → ${langTarget}`,
        estimatedDays: doc.estimatedDays || "2-5 días",
      }).catch((err) =>
        console.error("[documents/contact] quote email failed:", err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[documents/contact]", err);
    return NextResponse.json(
      { ok: false, error: "Error al guardar los datos de contacto." },
      { status: 500 }
    );
  }
}
