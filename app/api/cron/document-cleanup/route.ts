import { NextRequest } from "next/server";
import { del, list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;
// Expedientes de clientes (carpeta expedientes-clientes/): suben ANTES de pulsar
// «Enviar». Si el cliente abandona, no hay fila en DocumentAnalysis y nadie los
// borraría. 48 h de margen para las subidas en curso.
const ORPHAN_EXPEDIENTE_HOURS = 48;

async function sweepOrphanExpedientes(): Promise<number> {
  const cutoff = Date.now() - ORPHAN_EXPEDIENTE_HOURS * 60 * 60 * 1000;
  let cursor: string | undefined;
  let deleted = 0;
  do {
    // SOLO la carpeta de las subidas públicas (ExpedientePublicIntake). expedientes/ la
    // comparten el builder del staff y la bandeja, sin fila en DocumentAnalysis.
    const page = await list({ prefix: "expedientes-clientes/", cursor, limit: 1000 });
    const old = page.blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.url);
    if (old.length) {
      // Se conserva todo lo que esté en un análisis, un presupuesto o un pedido.
      const [known, lines, items] = await Promise.all([
        prisma.documentAnalysis.findMany({ where: { fileUrl: { in: old } }, select: { fileUrl: true } }),
        prisma.quoteLine.findMany({ where: { sourceFileUrl: { in: old } }, select: { sourceFileUrl: true } }),
        prisma.orderDocumentItem.findMany({ where: { fileUrl: { in: old } }, select: { fileUrl: true } }),
      ]);
      const keep = new Set<string>([
        ...known.map((k) => k.fileUrl),
        ...lines.map((l) => l.sourceFileUrl || ""),
        ...items.map((i) => i.fileUrl || ""),
      ]);
      const orphans = old.filter((u) => !keep.has(u));
      for (const url of orphans) {
        try {
          await del(url);
          deleted++;
        } catch {
          // Ya no existe — seguir
        }
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

const UNPAID_STATUSES = [
  "UPLOADED",
  "ANALYZING",
  "ANALYZED",
  "ANALYSIS_FAILED",
  "QUOTE_GENERATED",
  "PAYMENT_PENDING",
] as const;

const PAID_STATUSES = [
  "PAID",
  "IN_TRANSLATION",
  "TRANSLATED",
  "DELIVERED",
] as const;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - RETENTION_DAYS);

  // Phase A — Unpaid documents: delete blob + delete DB record
  const unpaid = await prisma.documentAnalysis.findMany({
    where: {
      createdAt: { lt: threshold },
      status: { in: [...UNPAID_STATUSES] },
    },
    select: { id: true, fileUrl: true },
  });

  for (const doc of unpaid) {
    try {
      await del(doc.fileUrl);
    } catch {
      // Blob may already be gone — continue with DB cleanup
    }
  }

  // Las líneas de presupuesto que apuntaban al blob borrado dejan de enlazarlo:
  // si no, el visor del presupuesto enseñaría un documento que ya no existe.
  const unpaidUrls = unpaid.map((d) => d.fileUrl).filter(Boolean);
  if (unpaidUrls.length) {
    await prisma.quoteLine.updateMany({ where: { sourceFileUrl: { in: unpaidUrls } }, data: { sourceFileUrl: null } });
  }

  const deletedResult = await prisma.documentAnalysis.deleteMany({
    where: { id: { in: unpaid.map((d) => d.id) } },
  });

  // Phase B — Paid documents: delete blob, keep record for accounting
  const paid = await prisma.documentAnalysis.findMany({
    where: {
      createdAt: { lt: threshold },
      status: { in: [...PAID_STATUSES] },
      fileUrl: { not: "[DELETED-GDPR]" },
    },
    select: { id: true, fileUrl: true },
  });

  for (const doc of paid) {
    try {
      await del(doc.fileUrl);
    } catch {
      // Blob may already be gone — still mark as deleted
    }
  }

  const paidUrls = paid.map((d) => d.fileUrl).filter(Boolean);
  if (paidUrls.length) {
    await prisma.quoteLine.updateMany({ where: { sourceFileUrl: { in: paidUrls } }, data: { sourceFileUrl: null } });
  }

  const updatedResult = await prisma.documentAnalysis.updateMany({
    where: { id: { in: paid.map((d) => d.id) } },
    data: { fileUrl: "[DELETED-GDPR]" },
  });

  // Phase C — Expedientes abandonados: blobs sin fila en DocumentAnalysis
  let orphanExpedientes = 0;
  try {
    orphanExpedientes = await sweepOrphanExpedientes();
  } catch (err) {
    console.error("[document-cleanup] orphan expedientes sweep failed:", err);
  }

  return Response.json({
    deleted: deletedResult.count,
    updated: updatedResult.count,
    orphanExpedientes,
    threshold: threshold.toISOString(),
  });
}
