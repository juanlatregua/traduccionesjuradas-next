import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCronSecret } from "@/lib/cron-auth";

const RETENTION_DAYS = 90;

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - RETENTION_DAYS);

  const result = await prisma.chatSession.deleteMany({
    where: { updatedAt: { lt: threshold } },
  });

  return Response.json({
    deleted: result.count,
    threshold: threshold.toISOString(),
  });
}
