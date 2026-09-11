import { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;

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

  return Response.json({
    deleted: deletedResult.count,
    updated: updatedResult.count,
    threshold: threshold.toISOString(),
  });
}
