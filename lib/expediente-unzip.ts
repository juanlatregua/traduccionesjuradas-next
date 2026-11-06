// Un ZIP subido al expediente se abre en servidor: cada PDF/imagen pasa a ser su
// propio DocumentAnalysis (mismo expediente, caso y cliente) y la fila del ZIP se
// retira. Antes el ZIP se mandaba entero a Claude y quedaba ANALYSIS_FAILED
// (Sarah Quintão, Primeira Remessa / Remessa2 / Remessa3, oct-nov 2026).
import JSZip from "jszip";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { decodeZipName, isZipDocument, usableZipEntry } from "@/lib/zip-entries";

export { isZipDocument };

const MAX_ENTRIES = 100;
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export async function expandZipDocument(docId: string): Promise<{ created: number; ids: string[]; skipped: string[] }> {
  const doc = await prisma.documentAnalysis.findUnique({ where: { id: docId } });
  if (!doc || !isZipDocument(doc)) return { created: 0, ids: [], skipped: [] };

  const res = await fetch(doc.fileUrl);
  if (!res.ok) throw new Error(`No se pudo descargar el ZIP (${res.status})`);
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()), { decodeFileName: decodeZipName as any });

  const skipped: string[] = [];
  const entries: { name: string; mimeType: string; file: JSZip.JSZipObject }[] = [];
  let total = 0;
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    const ok = usableZipEntry(file.name);
    if (!ok) {
      if (!file.name.includes("__MACOSX") && !file.name.split("/").pop()?.startsWith(".")) skipped.push(file.name);
      continue;
    }
    const size = Number((file as any)._data?.uncompressedSize) || 0;
    if (size > MAX_ENTRY_BYTES || total + size > MAX_TOTAL_BYTES || entries.length >= MAX_ENTRIES) {
      skipped.push(file.name);
      continue;
    }
    total += size;
    entries.push({ ...ok, file });
  }
  if (entries.length === 0) return { created: 0, ids: [], skipped };

  const rows: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }[] = [];
  for (const e of entries) {
    const buf = await e.file.async("nodebuffer");
    const safe = e.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const blob = await put(`expedientes-clientes/${Date.now()}-${safe}`, buf, {
      access: "public",
      addRandomSuffix: true,
      contentType: e.mimeType,
    });
    rows.push({ fileName: e.name.slice(0, 255), fileUrl: blob.url, fileSize: buf.length, mimeType: e.mimeType });
  }

  const created = await prisma.$transaction(async (tx) => {
    const out = await tx.documentAnalysis.createManyAndReturn({
      data: rows.map((r) => ({
        ...r,
        casoId: doc.casoId,
        sessionToken: doc.sessionToken,
        clientName: doc.clientName,
        clientEmail: doc.clientEmail,
        clientPhone: doc.clientPhone,
        sourceLanguage: doc.sourceLanguage,
        targetLanguage: doc.targetLanguage,
        source: doc.source,
        gdprConsent: doc.gdprConsent,
        gdprConsentAt: doc.gdprConsentAt,
        marketingConsent: doc.marketingConsent,
        marketingConsentAt: doc.marketingConsentAt,
        urgency: doc.urgency,
        neededBy: doc.neededBy,
        status: "UPLOADED" as const,
      })),
      select: { id: true },
    });
    await tx.documentAnalysis.delete({ where: { id: doc.id } });
    return out;
  });
  return { created: created.length, ids: created.map((c) => c.id), skipped };
}
