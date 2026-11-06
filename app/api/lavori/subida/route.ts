import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { hasMotorAuth } from "@/lib/lavori-motor-auth";
import { LAVORI_UPLOAD_CONTENT_TYPES, LAVORI_UPLOAD_MAX_BYTES, lavoriUploadPathname } from "@/lib/lavori-upload";

export const runtime = "nodejs";

/* Ficheros grandes lavori → motor (6-nov-2026). lavori pide aquí un token de
   subida, sube el fichero directo a nuestro Blob (sin el tope de 4,5 MB del cuerpo
   de Vercel) y manda entrega_subida / factura_subida con datos.blobUrl.
   POST { motorRef, tipo: "entrega" | "factura", nombre, contentType?, bytes? }
   → { ok, pathname, clientToken, maxBytes, validUntil } */
export async function POST(req: Request) {
  if (!hasMotorAuth(req)) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  let body: { motorRef?: string; tipo?: string; nombre?: string; contentType?: string; bytes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const motorRef = String(body.motorRef || "").trim();
  const tipo = body.tipo === "factura" ? "factura" : body.tipo === "entrega" ? "entrega" : null;
  if (!motorRef) return NextResponse.json({ ok: false, error: "motorRef obligatoria" }, { status: 400 });
  if (!tipo) return NextResponse.json({ ok: false, error: "tipo debe ser entrega o factura" }, { status: 400 });
  const bytes = Number(body.bytes || 0);
  if (bytes > LAVORI_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `fichero >${Math.round(LAVORI_UPLOAD_MAX_BYTES / 1e6)}MB` }, { status: 413 });
  }

  const pathname = lavoriUploadPathname(motorRef, tipo, String(body.nombre || `${tipo}.pdf`));
  const validUntil = Date.now() + 30 * 60 * 1000;
  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    maximumSizeInBytes: LAVORI_UPLOAD_MAX_BYTES,
    allowedContentTypes: LAVORI_UPLOAD_CONTENT_TYPES,
    validUntil,
    addRandomSuffix: true,
  });
  return NextResponse.json({ ok: true, pathname, clientToken, maxBytes: LAVORI_UPLOAD_MAX_BYTES, validUntil });
}
