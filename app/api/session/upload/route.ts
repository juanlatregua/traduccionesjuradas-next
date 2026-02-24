import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { computeSessionPricing } from "@/lib/session-pricing";
import { getSessionIdFromRequest } from "@/lib/session";
import { serializeOrderSession } from "@/lib/session-dto";
import { sanitizeFileName, validateGeneralUploadFile } from "@/lib/file-security";
import { isBlobConfigured } from "@/lib/payment-config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `session-upload:${sessionId}:${ip}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas subidas en poco tiempo. Intentalo de nuevo." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (!isBlobConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Subida no disponible en este entorno. Configura BLOB_READ_WRITE_TOKEN.",
      },
      { status: 503 }
    );
  }

  try {
    const existing = await prisma.orderSession.findUnique({
      where: { id: sessionId },
      select: { id: true, reference: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sourceLang = String(formData.get("sourceLang") || "").trim() || null;
    const targetLang = String(formData.get("targetLang") || "").trim() || "es";

    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const maxSize = 12 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande (max 12 MB)." },
        { status: 400 }
      );
    }

    const validation = await validateGeneralUploadFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }
    const safeName = (validation as { safeName?: string }).safeName || sanitizeFileName(file.name);

    const detectedMime = (validation as any).detectedMime as string | undefined;
    const pathname = `funnel/${existing.reference}/${Date.now()}-${safeName}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: detectedMime || file.type || "application/octet-stream",
    });

    await prisma.orderDocument.create({
      data: {
        sessionId: existing.id,
        fileKey: blob.pathname,
        fileUrl: blob.url,
        filename: safeName,
        mimeType: detectedMime || file.type || "application/octet-stream",
        sizeBytes: file.size,
        detectedType: detectedMime || null,
        sourceLang,
        targetLang,
      },
    });

    const pricing = await computeSessionPricing(existing.id);
    const session = await prisma.orderSession.update({
      where: { id: existing.id },
      data: {
        step: "REVIEW",
        subtotalCents: pricing.subtotalCents,
        vatCents: pricing.vatCents,
        totalCents: pricing.totalCents,
        currency: pricing.currency,
      },
      include: {
        docs: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ ok: true, session: serializeOrderSession(session) });
  } catch (err: any) {
    console.error("[session/upload] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo subir el documento." },
      { status: 500 }
    );
  }
}
