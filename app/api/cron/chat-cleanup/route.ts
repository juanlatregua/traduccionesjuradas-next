import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 90;

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel Cron uses this header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
