// Rellena QuoteLine.docKind de las líneas anteriores al 6-nov-2026 con el tipo
// de documento de su análisis (DocumentAnalysis por sourceFileUrl; si el PDF
// tenía varios documentos, el segmento que empieza en pageStart).
// Uso: npx tsx --env-file=.env.local scripts/backfill-quote-line-dockind.ts [--apply]
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function kindOf(a: { documentType: string | null; analysisJson: any }, pageStart: number | null): string | null {
  const segs = a.analysisJson?.segmented ? a.analysisJson.documents : null;
  if (Array.isArray(segs)) {
    const seg = segs.find((s: any) => s.pageStart === (pageStart ?? 1)) || (segs.length === 1 ? segs[0] : null);
    return seg?.analysis?.document_type?.specific_type || null;
  }
  return a.documentType && a.documentType !== "expediente_combinado" ? a.documentType : null;
}

(async () => {
  const lines = await prisma.quoteLine.findMany({
    where: { docKind: null, sourceFileUrl: { not: null } },
    select: { id: true, sourceFileUrl: true, pageStart: true },
  });
  const urls = Array.from(new Set(lines.map((l) => l.sourceFileUrl!)));
  const analyses = await prisma.documentAnalysis.findMany({
    where: { fileUrl: { in: urls } },
    select: { fileUrl: true, documentType: true, analysisJson: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const byUrl = new Map<string, (typeof analyses)[number]>();
  for (const a of analyses) if (!byUrl.has(a.fileUrl)) byUrl.set(a.fileUrl, a);

  const updates = lines
    .map((l) => {
      const a = byUrl.get(l.sourceFileUrl!);
      const k = a ? kindOf(a, l.pageStart) : null;
      return k && /^[a-z0-9_]{2,60}$/.test(k) ? { id: l.id, docKind: k } : null;
    })
    .filter((u): u is { id: string; docKind: string } => !!u);

  const counts = new Map<string, number>();
  for (const u of updates) counts.set(u.docKind, (counts.get(u.docKind) || 0) + 1);
  console.log(`líneas sin tipo con PDF: ${lines.length} · con tipo deducible: ${updates.length}`);
  console.log(Array.from(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${k}=${n}`).join(" "));
  if (!APPLY) {
    console.log("dry-run: añade --apply para escribir");
    return prisma.$disconnect();
  }
  for (const u of updates) await prisma.quoteLine.update({ where: { id: u.id }, data: { docKind: u.docKind } });
  console.log(`actualizadas ${updates.length}`);
  await prisma.$disconnect();
})();
