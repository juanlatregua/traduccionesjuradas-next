// app/api/q/[token]/document/route.ts
// CLIENTE: sirve UN documento de su presupuesto desde el enlace publico. El
// publicToken del presupuesto ES la credencial — la misma con la que ve precios
// y paga —, asi que da acceso a lo suyo y solo a lo suyo.
//
// La URL del fichero sale de la BD, NUNCA del query string: por eso esta ruta
// puede ser publica y la de staff (/api/documents/extract-pages, que acepta la
// URL por parametro) no. Aqui el unico parametro es el id de la linea, y se
// comprueba que esa linea pertenece a este presupuesto.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractPageRange, isAllowedBlobUrl, safeDocName } from "@/lib/pdf-extract";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `quote-doc:${params.token}:${ip}`,
    limit: 90,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas consultas. Espera unos minutos." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const lineId = String(searchParams.get("line") || "").trim();
  const download = searchParams.get("download") === "1";
  if (!lineId) {
    return NextResponse.json({ ok: false, error: "Falta el documento." }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    select: { id: true, tokenExpiresAt: true },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Enlace no valido." }, { status: 404 });
  }
  // Mismo criterio que la pagina: un enlace caducado deja de dar acceso.
  if (quote.tokenExpiresAt && quote.tokenExpiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "Este enlace ha caducado." }, { status: 403 });
  }

  // La linea tiene que ser DE ESTE presupuesto: sin este filtro, el token de un
  // presupuesto abriria los documentos de cualquier otro.
  const line = await prisma.quoteLine.findFirst({
    where: { id: lineId, quoteId: quote.id },
    select: { description: true, sourceFileUrl: true, pageStart: true, pageEnd: true },
  });
  if (!line || !line.sourceFileUrl) {
    return NextResponse.json({ ok: false, error: "Documento no disponible." }, { status: 404 });
  }
  if (!isAllowedBlobUrl(line.sourceFileUrl)) {
    return NextResponse.json({ ok: false, error: "Documento no disponible." }, { status: 400 });
  }

  let doc;
  try {
    doc = await extractPageRange({ url: line.sourceFileUrl, start: line.pageStart, end: line.pageEnd });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo abrir el documento." }, { status: 502 });
  }

  const name = safeDocName(line.description.slice(0, 60));
  return new NextResponse(doc.buffer as any, {
    status: 200,
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}.${doc.ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
