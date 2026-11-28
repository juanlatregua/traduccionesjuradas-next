import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { DEFAULT_LIMITS, documentLabel, type ModelReading } from "@/lib/lectura/index.ts";
import { explicitRssCeilingMb } from "@/lib/lectura-constructor/flag.ts";
import { download, startDeps } from "@/lib/lectura-constructor/server.ts";
import { startReading } from "@/lib/lectura-constructor/run.ts";
import { put } from "@vercel/blob";
import { buildGroupingMapping, documentParts, expedienteAgruparOn, needsMerge, type GroupedDocument, type MergedFile } from "@/lib/expediente-agrupar";
import { mergedAnalysisJson, mergeIntoPdf, mergeTooLarge } from "@/lib/expediente-unir";
import { hashFileBuffer } from "@/lib/document-dedup";
import { safeDocName } from "@/lib/pdf-extract";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  if (!expedienteAgruparOn()) return NextResponse.json({ ok: false, error: "Agrupación desactivada." }, { status: 404 });
  if (explicitRssCeilingMb() === null || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "La lectura del conjunto no está configurada en este servidor." }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const ids: string[] = [...new Set<string>((Array.isArray(body?.analysisIds) ? body.analysisIds : []).map((x: unknown) => String(x)).filter(Boolean))];
  if (ids.length < 2) return NextResponse.json({ ok: false, error: "Hacen falta al menos dos archivos." }, { status: 400 });
  if (ids.length > DEFAULT_LIMITS.maxFiles) return NextResponse.json({ ok: false, error: `Máximo ${DEFAULT_LIMITS.maxFiles} archivos.` }, { status: 400 });
  const targetLang = String(body?.targetLang || "").trim().toLowerCase() || null;

  const found = await prisma.documentAnalysis.findMany({
    where: { id: { in: ids } },
    select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true, pageCount: true, sessionToken: true, casoId: true, analysisJson: true },
  });
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const analyses = ids.map((id) => found.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a && isOwnBlobUrl(a.fileUrl, token));
  if (analyses.length < 2) return NextResponse.json({ ok: false, error: "No se encuentran los archivos analizados." }, { status: 404 });

  const refs = analyses.map((a) => ({ name: a.fileName, url: a.fileUrl, mimeType: a.mimeType }));
  const started = await startReading(
    { ...startDeps, listFiles: async () => refs },
    { source: { casoId: null, sessionKey: null, quoteId: null }, targetLang, sourceLang: null, notes: null, reread: false, by: access.email }
  );
  if (started.kind === "busy" || started.kind === "in_progress") {
    return NextResponse.json({ ok: false, retry: true, error: started.kind === "busy" ? started.reasonEs : "Lectura en curso." }, { status: 409 });
  }
  if (started.kind !== "done") return NextResponse.json({ ok: false, error: "Sin archivos que leer." }, { status: 422 });

  const lote = await prisma.lecturaLote.findUnique({
    where: { id: started.loteId },
    select: {
      status: true,
      detailEs: true,
      readingJson: true,
      files: { select: { position: true, url: true, sha256: true, pageCount: true, state: true, name: true } },
      documents: { select: { docKey: true, words: true, typeLabelEs: true, holder: true, apostille: true } },
    },
  });
  if (!lote || (lote.status !== "ok" && lote.status !== "confirmed") || !lote.readingJson) {
    return NextResponse.json({ ok: false, error: lote?.detailEs || "La lectura del conjunto no ha salido bien." }, { status: 422 });
  }
  const docInfo = new Map(
    lote.documents.map((d) => [d.docKey, { words: d.words, labelEs: documentLabel({ typeLabelEs: d.typeLabelEs, holder: d.holder, apostille: (d.apostille ?? null) as Parameters<typeof documentLabel>[0]["apostille"] }) }])
  );
  const mapping = buildGroupingMapping(lote.readingJson as unknown as ModelReading, lote.files, analyses, docInfo);
  const bytesOf = new Map<string, Promise<Uint8Array>>();
  const fileOf = (id: string) => {
    const a = analyses.find((x) => x.id === id)!;
    if (!bytesOf.has(id)) bytesOf.set(id, download({ name: a.fileName, url: a.fileUrl, mimeType: a.mimeType }));
    return bytesOf.get(id)!;
  };
  for (const doc of mapping.documents) {
    if (!needsMerge(doc)) continue;
    try {
      doc.merged = await mergeDocument(doc, analyses, fileOf);
    } catch (err) {
      doc.mergeError = err instanceof Error ? err.message.slice(0, 200) : "no se pudo unir";
    }
  }
  return NextResponse.json({ ok: true, reused: started.reused, mapping });
}

type Analysis = { id: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string; pageCount: number; sessionToken: string | null; casoId: string | null; analysisJson: unknown };

async function mergeDocument(doc: GroupedDocument, analyses: Analysis[], fileOf: (id: string) => Promise<Uint8Array>): Promise<MergedFile> {
  const parts = documentParts(doc);
  const tooLarge = mergeTooLarge([...new Set(parts.map((p) => p.analysisId))].map((id) => analyses.find((x) => x.id === id)?.fileSize ?? 0));
  if (tooLarge) throw new Error(tooLarge);
  const sources = [];
  for (const p of parts) {
    const a = analyses.find((x) => x.id === p.analysisId);
    if (!a) throw new Error("falta un archivo del documento");
    sources.push({ bytes: await fileOf(a.id), pageStart: p.pageStart, pageEnd: p.pageEnd, name: a.fileName });
  }
  const merged = await mergeIntoPdf(sources);
  if (!merged.ok) throw new Error(merged.reasonEs);
  const host = analyses.find((x) => x.id === doc.parts[0].analysisId)!;
  const buffer = Buffer.from(merged.bytes);
  const fileName = `${safeDocName(doc.labelEs)}.pdf`;
  const blob = await put(`expedientes/${Date.now()}-${fileName}`, buffer, { access: "public", addRandomSuffix: true, contentType: "application/pdf" });
  const analysisJson = mergedAnalysisJson(doc, host.analysisJson, merged.pageCount);
  const row = await prisma.documentAnalysis.create({
    data: {
      fileName,
      fileUrl: blob.url,
      fileSize: buffer.length,
      mimeType: "application/pdf",
      fileHash: hashFileBuffer(buffer),
      pageCount: merged.pageCount,
      sessionToken: host.sessionToken,
      casoId: host.casoId,
      gdprConsent: true,
      gdprConsentAt: new Date(),
      status: analysisJson ? "QUOTE_GENERATED" : "UPLOADED",
      ...(analysisJson ? { analysisJson: analysisJson as any, estimatedWords: doc.words || null, documentType: doc.type } : {}),
    },
    select: { id: true },
  });
  return { analysisId: row.id, url: blob.url, fileName, pageCount: merged.pageCount };
}
