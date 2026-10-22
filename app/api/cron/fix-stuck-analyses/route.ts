import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCronSecret } from "@/lib/cron-auth";

const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const result = await prisma.documentAnalysis.updateMany({
    where: {
      status: "ANALYZING",
      updatedAt: { lt: threshold },
    },
    data: {
      status: "ANALYSIS_FAILED",
    },
  });

  if (result.count > 0) {
    console.warn(`[fix-stuck-analyses] Marked ${result.count} stuck analyses as ANALYSIS_FAILED`);
  }

  return Response.json({
    fixed: result.count,
    threshold: threshold.toISOString(),
  });
}
