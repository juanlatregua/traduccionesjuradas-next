// app/api/documents/extract-pages/route.ts
// Sirve un DOCUMENTO concreto dentro de un PDF origen, extrayendo su rango de
// páginas (segmentación). Permite "ver" (inline) y "descargar" cada documento
// detectado como su propio PDF, en el builder y en el presupuesto. Solo staff.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

// Solo se acepta una URL de Vercel Blob (evita SSRF a hosts arbitrarios).
const BLOB_HOST_RE = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//;

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const url = String(searchParams.get("url") || "").trim();
  const start = Math.max(1, Math.round(Number(searchParams.get("start")) || 1));
  const endRaw = Math.round(Number(searchParams.get("end")) || start);
  const download = searchParams.get("download") === "1";
  const name = (searchParams.get("name") || "documento").replace(/[^\w.\- ]+/g, "_").slice(0, 80);

  if (!BLOB_HOST_RE.test(url)) {
    return NextResponse.json({ ok: false, error: "URL no permitida." }, { status: 400 });
  }

  let buffer: Buffer;
  let contentType: string;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    contentType = res.headers.get("content-type") || "application/octet-stream";
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "No se pudo acceder al archivo." }, { status: 502 });
  }

  // Solo se extrae de PDFs. Imágenes u otros → se devuelven tal cual.
  const isPdf = contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf");

  let outBuffer = buffer;
  let outType = isPdf ? "application/pdf" : contentType;
  let ext = isPdf ? "pdf" : (url.split(".").pop()?.split("?")[0] || "bin").slice(0, 5);

  if (isPdf) {
    try {
      const { PDFDocument } = require("pdf-lib");
      const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const total = src.getPageCount();
      const from = Math.min(start, total);
      const to = Math.min(Math.max(endRaw, from), total);
      // Si el rango cubre todo el documento, servimos el original sin tocar.
      if (!(from === 1 && to === total)) {
        const out = await PDFDocument.create();
        const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
        const copied = await out.copyPages(src, indices);
        copied.forEach((p: any) => out.addPage(p));
        outBuffer = Buffer.from(await out.save());
      }
    } catch (err) {
      console.error("[extract-pages] pdf-lib error, sirviendo original:", err);
      outBuffer = buffer;
    }
  }

  const disposition = `${download ? "attachment" : "inline"}; filename="${name}.${ext}"`;
  return new NextResponse(outBuffer as any, {
    status: 200,
    headers: {
      "Content-Type": outType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
