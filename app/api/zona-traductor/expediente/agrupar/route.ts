import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { DEFAULT_LIMITS, documentLabel, type ModelReading } from "@/lib/lectura/index.ts";
import { explicitRssCeilingMb } from "@/lib/lectura-constructor/flag.ts";
import { startDeps } from "@/lib/lectura-constructor/server.ts";
import { startReading } from "@/lib/lectura-constructor/run.ts";
import { buildGroupingMapping, expedienteAgruparOn } from "@/lib/expediente-agrupar";

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
    select: { id: true, fileName: true, fileUrl: true, mimeType: true, pageCount: true },
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
  return NextResponse.json({ ok: true, reused: started.reused, mapping });
}
