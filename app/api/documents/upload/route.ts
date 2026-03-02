// app/api/documents/upload/route.ts — Subida de documentos para análisis IA

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isBlobConfigured } from "@/lib/payment-config";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILES_PER_SESSION = 5;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/tiff",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "heic", "tiff", "tif", "webp",
]);

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function sanitizeFileName(name: string): string {
  return String(name || "documento")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Rate limit: 5 subidas por IP por día
  const rl = await checkRateLimit({
    key: `doc-upload:${ip}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Has superado el límite diario de subidas. Inténtalo mañana." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionToken = formData.get("sessionToken") as string | null;
    const gdprConsent = formData.get("gdprConsent") === "true";

    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    if (!gdprConsent) {
      return NextResponse.json(
        { ok: false, error: "Debes aceptar el tratamiento de datos para continuar." },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = getExtension(file.name);
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { ok: false, error: "Formato no admitido. Acepta: PDF, JPG, PNG, HEIC, TIFF." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande. Máximo 20 MB." },
        { status: 400 }
      );
    }

    // Check Blob configured
    if (!isBlobConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Almacenamiento no configurado. Contacta con soporte." },
        { status: 503 }
      );
    }

    // Upload to Vercel Blob
    const safeName = sanitizeFileName(file.name);
    const pathname = `ia-documents/${Date.now()}-${safeName}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    // Generate or reuse session token
    const token = sessionToken || crypto.randomUUID();

    // Create DocumentAnalysis record
    const doc = await prisma.documentAnalysis.create({
      data: {
        fileName: file.name,
        fileUrl: blob.url,
        fileSize: file.size,
        mimeType: file.type || `application/${ext}`,
        sessionToken: token,
        ipHash: hashIp(ip),
        gdprConsent: true,
        gdprConsentAt: new Date(),
        status: "UPLOADED",
      },
    });

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      fileUrl: blob.url,
      sessionToken: token,
    });
  } catch (err: any) {
    console.error("[documents/upload]", err);
    return NextResponse.json(
      { ok: false, error: "Error al subir el archivo. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
