import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateGeneralUploadFile } from "@/lib/file-security";
import { isBlobConfigured } from "@/lib/payment-config";
import { getAssignmentByToken } from "@/lib/collaborators";

export const runtime = "nodejs";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `encargo-upload:${params.token}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas subidas. Inténtalo de nuevo más tarde." },
      { status: 429 }
    );
  }

  const assignment = await getAssignmentByToken(params.token);
  if (!assignment) {
    return NextResponse.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });
  }
  if (assignment.status !== "ACCEPTED") {
    return NextResponse.json(
      { ok: false, error: "Este encargo no acepta entregas en este momento." },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Solo se aceptan archivos PDF o Word." },
        { status: 400 }
      );
    }

    const validation = await validateGeneralUploadFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande (max 20 MB)." },
        { status: 400 }
      );
    }

    if (!isBlobConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Subida de archivos no disponible en este entorno." },
        { status: 503 }
      );
    }

    const pathname = `collaborator-deliveries/${assignment.order.reference}/${Date.now()}-${validation.safeName}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      ok: true,
      fileUrl: blob.url,
      fileKey: blob.pathname,
      filename: file.name,
      mimeType: file.type,
    });
  } catch (err: any) {
    console.error("[encargo-upload] error", err);
    return NextResponse.json(
      { ok: false, error: "Error al subir archivo." },
      { status: 500 }
    );
  }
}
