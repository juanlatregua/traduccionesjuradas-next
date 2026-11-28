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
import { mergeIntoPdf } from "@/lib/expediente-unir";
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
    select: { id: true, fileName: true, fileUrl: true, mimeType: true, pageCount: true, sessionToken: true, casoId: true, analysisJson: true },
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

type Analysis = { id: string; fileName: string; fileUrl: string; mimeType: string; pageCount: number; sessionToken: string | null; casoId: string | null; analysisJson: unknown };

// Análisis del archivo del que sale el documento, con las cifras del documento unido: así
// el constructor lo rehidrata al editar sin volver a llamar a la IA.
function savedAnalysisFor(doc: GroupedDocument, host: Analysis, pageCount: number): object | null {
  const json = host.analysisJson as any;
  const mode = json?.builderRun?.mode;
  if (mode !== "text" && mode !== "vision") return null;
  const first = doc.parts[0];
  const base = json.segmented
    ? (json.documents as any[] | undefined)?.find((d) => d.pageStart <= first.pageStart && first.pageStart <= d.pageEnd)?.analysis
    : (({ builderRun, ...rest }) => rest)(json);
  if (!base?.document_metrics) return null;
  return {
    ...base,
    document_metrics: { ...base.document_metrics, pages: pageCount, estimated_words: doc.words || base.document_metrics.estimated_words },
    requirements: { ...base.requirements, has_apostille: !!doc.apostille || !!base.requirements?.has_apostille, apostille_separate_page: (doc.apostille?.parts.length ?? 0) > 0 || base.requirements?.apostille_separate_page === true },
    builderRun: { mode },
  };
}

async function mergeDocument(doc: GroupedDocument, analyses: Analysis[], fileOf: (id: string) => Promise<Uint8Array>): Promise<MergedFile> {
  const parts = documentParts(doc);
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
  const analysisJson = savedAnalysisFor(doc, host, merged.pageCount);
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
