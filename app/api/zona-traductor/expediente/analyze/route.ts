// app/api/zona-traductor/expediente/analyze/route.ts
// Análisis de un documento de expediente para STAFF (zona-traductor / admin).
// El archivo ya está subido a Vercel Blob por el cliente; aquí se clasifica con
// el runner por capas (Haiku/texto barato o Sonnet/visión) y se devuelven los
// datos extraídos + precio para prerellenar un presupuesto. Sin los topes de
// rate-limit públicos: un expediente puede tener 16+ documentos.
// El núcleo vive en lib/expediente-analyze.ts (lo comparte el agente de bandeja).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { analyzeDocumentRow, analyzeExpedienteDocument, type ExpedienteAnalyzeResult } from "@/lib/expediente-analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

function toResponse(result: ExpedienteAnalyzeResult) {
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, ...(result.debug !== undefined ? { _debug: result.debug } : {}) },
      { status: result.status }
    );
  }
  return NextResponse.json({
    ok: true,
    mode: result.mode,
    analysisMs: result.analysisMs,
    ...(result.cached ? { cached: true } : {}),
    split: result.split,
    documents: result.documents,
    // Compatibilidad: primer documento como `document`.
    document: result.documents[0],
  });
}

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

  const documentId = String(body?.documentId || "");
  // Idioma destino del expediente, si el staff lo fijó antes de analizar
  // (caso "idiomas distintos → un tercer idioma", p. ej. todo a inglés).
  const targetLang = String(body?.targetLang || "").trim().toLowerCase() || undefined;

  // Dos modos: analizar un documento YA registrado (expediente entrante,
  // por documentId) o uno recién subido a Blob por el staff (por blobUrl).
  if (documentId) {
    return toResponse(await analyzeExpedienteDocument(documentId, { targetLang }));
  }

  const blobUrl = String(body?.blobUrl || "");
  const fileName = String(body?.fileName || "documento").slice(0, 255);
  const fileSize = Number(body?.fileSize) || 0;
  const mimeType = String(body?.mimeType || "application/octet-stream");
  if (!blobUrl) {
    return NextResponse.json({ ok: false, error: "blobUrl o documentId requerido." }, { status: 400 });
  }
  if (!isOwnBlobUrl(blobUrl, process.env.BLOB_READ_WRITE_TOKEN)) {
    return NextResponse.json({ ok: false, error: "blobUrl no válido." }, { status: 400 });
  }
  const doc = await prisma.documentAnalysis.create({
    data: {
      fileName,
      fileUrl: blobUrl,
      fileSize,
      mimeType,
      sessionToken: `staff:${access.email}`,
      gdprConsent: true,
      gdprConsentAt: new Date(),
      status: "ANALYZING",
    },
  });
  return toResponse(await analyzeDocumentRow(doc, targetLang));
}
