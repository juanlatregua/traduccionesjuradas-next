// app/api/documents/[id]/contact/route.ts — Guardar datos de contacto antes del análisis IA

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
      select: { id: true, status: true },
    });

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "Documento no encontrado." },
        { status: 404 }
      );
    }

    await prisma.documentAnalysis.update({
      where: { id },
      data: {
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        clientPhone: clientPhone?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[documents/contact]", err);
    return NextResponse.json(
      { ok: false, error: "Error al guardar los datos de contacto." },
      { status: 500 }
    );
  }
}
