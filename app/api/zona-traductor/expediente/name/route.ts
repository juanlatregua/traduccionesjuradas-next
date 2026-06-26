// app/api/zona-traductor/expediente/name/route.ts
//
// Sugerencia BARATA del nombre/tipo de un documento (solo nombre, sin contar
// palabras ni segmentar). Para filas que el staff suelta sin análisis o cuyo
// análisis falló: una llamada mínima a la IA que devuelve el tipo en español.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { suggestDocumentName } from "@/lib/ai/suggest-name";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const blobUrl = String(body?.blobUrl || "");
  const fileName = String(body?.fileName || "documento").slice(0, 255);
  const mimeType = String(body?.mimeType || "application/pdf");
  if (!blobUrl) {
    return NextResponse.json({ ok: false, error: "blobUrl requerido." }, { status: 400 });
  }

  try {
    const r = await fetch(blobUrl);
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "No se pudo acceder al archivo." }, { status: 422 });
    }
    const buffer = Buffer.from(await r.arrayBuffer());
    const name = await suggestDocumentName({ buffer, mimeType, fileName });
    return NextResponse.json({ ok: true, name });
  } catch (err: any) {
    console.error("[expediente-name] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al sugerir el nombre." },
      { status: 500 }
    );
  }
}
