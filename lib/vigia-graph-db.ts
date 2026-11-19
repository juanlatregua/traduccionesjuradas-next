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

/** Huellas (y nombres) de los documentos de cada solicitud: su expediente (sessionToken «exp:REF», «puerta:SESIÓN» o ref a secas) y las líneas de su presupuesto. Sin columnas nuevas. */
export async function loadSolicitudHashes(sols: { ref: string; expedienteRef: string | null; quoteId: string | null }[]): Promise<Map<string, { hash: string; name: string }[]>> {
  const tokensOf = (e: string | null) => (e ? [...new Set([e, `exp:${e}`, e.replace(/^puerta:/, ""), `exp:${e.replace(/^puerta:/, "")}`])] : []);
  const tokens = [...new Set(sols.flatMap((s) => tokensOf(s.expedienteRef)))];
  const rows = tokens.length ? await prisma.documentAnalysis.findMany({ where: { sessionToken: { in: tokens }, fileHash: { not: null } }, select: { sessionToken: true, fileHash: true, fileName: true } }).catch(() => []) : [];
  const bySession = new Map<string, { hash: string; name: string }[]>();
  for (const r of rows) bySession.set(r.sessionToken!, [...(bySession.get(r.sessionToken!) || []), { hash: r.fileHash!, name: r.fileName }]);
  const quoteIds = sols.map((s) => s.quoteId).filter((x): x is string => !!x);
  const qh = await loadQuoteHashes(quoteIds);
  const out = new Map<string, { hash: string; name: string }[]>();
  for (const s of sols) {
    const docs = [...tokensOf(s.expedienteRef).flatMap((t) => bySession.get(t) || []), ...(s.quoteId ? (qh.get(s.quoteId) || []).map((hash) => ({ hash, name: "documento" })) : [])];
    out.set(s.ref, docs.filter((d, i) => docs.findIndex((x) => x.hash === d.hash) === i));
  }
  return out;
}
