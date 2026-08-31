// app/api/documents/extract-pages/route.ts
// Sirve un DOCUMENTO concreto dentro de un PDF origen, extrayendo su rango de
// páginas (segmentación). Permite "ver" (inline) y "descargar" cada documento
// detectado como su propio PDF, en el builder y en el presupuesto. Solo staff:
// acepta la URL por query, así que abrirlo seria regalar un proxy. La version
// del CLIENTE es /api/q/[token]/document, que saca la URL de la BD.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { extractPageRange, isAllowedBlobUrl, safeDocName } from "@/lib/pdf-extract";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const url = String(searchParams.get("url") || "").trim();
  const download = searchParams.get("download") === "1";
  const name = safeDocName(searchParams.get("name"));

  // Solo se acepta una URL de Vercel Blob (evita SSRF a hosts arbitrarios).
  if (!isAllowedBlobUrl(url)) {
    return NextResponse.json({ ok: false, error: "URL no permitida." }, { status: 400 });
  }

  let doc;
  try {
    doc = await extractPageRange({ url, start: Number(searchParams.get("start")), end: Number(searchParams.get("end")) });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo acceder al archivo." }, { status: 502 });
  }

  return new NextResponse(doc.buffer as any, {
    status: 200,
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}.${doc.ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
