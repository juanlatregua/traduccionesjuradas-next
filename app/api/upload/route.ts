import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateGeneralUploadFile } from "@/lib/file-security";
import { requireStaffAccess } from "@/lib/staff-auth";
import { isBlobConfigured } from "@/lib/payment-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `upload:${actorEmail}:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas subidas en poco tiempo. Intentalo de nuevo mas tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reference = formData.get("reference") as string | null;
    const prefixField = formData.get("prefix") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ]);
    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido." }, { status: 400 });
    }

    const validation = await validateGeneralUploadFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ ok: false, error: "Archivo demasiado grande (max 10 MB)." }, { status: 400 });
    }

    const prefix = reference ? `orders/${reference}` : prefixField === "expenses" ? "expenses" : "uploads";
    const pathname = `${prefix}/${Date.now()}-${validation.safeName}`;

    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Subida de archivos no disponible en este entorno. Configura BLOB_READ_WRITE_TOKEN en Vercel.",
        },
        { status: 503 }
      );
    }

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({ ok: true, url: blob.url, pathname: blob.pathname });
  } catch (err: any) {
    console.error("[upload] error", err);
    const msg = String(err?.message || "");
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Subida de archivos no disponible en este entorno. Falta BLOB_READ_WRITE_TOKEN.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir archivo." },
      { status: 500 }
    );
  }
}
