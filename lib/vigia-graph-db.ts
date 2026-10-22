import { prisma } from "@/lib/prisma";

/** Huellas de los documentos de cada presupuesto (misma vía que lavori-dup-guard). */
export async function loadQuoteHashes(quoteIds: string[]): Promise<Map<string, string[]>> {
  const qLines = quoteIds.length ? await prisma.quoteLine.findMany({ where: { quoteId: { in: quoteIds }, sourceFileUrl: { not: null } }, select: { quoteId: true, sourceFileUrl: true } }).catch(() => []) : [];
  const lineUrls = [...new Set(qLines.map((l) => l.sourceFileUrl!))];
  const hashRows = lineUrls.length ? await prisma.documentAnalysis.findMany({ where: { fileUrl: { in: lineUrls }, fileHash: { not: null } }, select: { fileUrl: true, fileHash: true } }).catch(() => []) : [];
  const hashOfUrl = new Map(hashRows.map((r) => [r.fileUrl, r.fileHash!]));
  const hashesOfQuote = new Map<string, string[]>();
  for (const l of qLines) { const h = hashOfUrl.get(l.sourceFileUrl!); if (h) hashesOfQuote.set(l.quoteId, [...(hashesOfQuote.get(l.quoteId) || []), h]); }
  return hashesOfQuote;
}
