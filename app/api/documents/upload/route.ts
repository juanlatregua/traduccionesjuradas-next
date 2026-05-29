// app/api/documents/upload/route.ts — Client-side upload handler
// Uses Vercel Blob client uploads to bypass 4.5MB serverless body limit

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isBlobConfigured } from "@/lib/payment-config";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/tiff",
  "image/webp",
];

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // El staff (zona-traductor) sube expedientes enteros → exento del tope
  // público de subidas.
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    // Rate limit: 40 subidas por IP por día (un expediente público puede traer
    // 16+ archivos; el gate RGPD sigue activo en onBeforeGenerateToken).
    const rl = await checkRateLimit({
      key: `doc-upload:${ip}`,
      limit: 40,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Has superado el límite diario de subidas. Inténtalo mañana." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }
  }

  if (!isBlobConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Almacenamiento no configurado. Contacta con soporte." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const parsed = clientPayload ? JSON.parse(clientPayload) : {};
        if (!parsed.gdprConsent) {
          throw new Error("Debes aceptar el tratamiento de datos para continuar.");
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
        };
      },
      onUploadCompleted: async () => {
        // DB record is created via /api/documents/register after upload
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err: any) {
    console.error("[documents/upload]", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al subir el archivo. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
