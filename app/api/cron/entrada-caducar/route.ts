import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { hasCronSecret } from "@/lib/cron-auth";
import { caducarEntradas } from "@/lib/entrada/caducar";
import { sessionKeyOf } from "@/lib/entrada/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const r = await caducarEntradas(
    {
      expiradas: async (before, limit) => {
        const rows = await prisma.entrada.findMany({
          where: { emailVerifiedAt: null, casoId: null, loteId: null, createdAt: { lt: before } },
          select: { id: true },
          take: limit,
        });
        const files = await prisma.documentAnalysis.findMany({
          where: { sessionToken: { in: rows.map((e) => sessionKeyOf(e.id)) } },
          select: { id: true, fileUrl: true, sessionToken: true },
        });
        return rows.map((e) => ({ id: e.id, files: files.filter((f) => f.sessionToken === sessionKeyOf(e.id)).map((f) => ({ id: f.id, url: f.fileUrl })) }));
      },
      deleteBlob: (url) => del(url),
      borrar: (id, fileIds) =>
        prisma.$transaction(async (tx) => {
          const gone = await tx.entrada.deleteMany({ where: { id, emailVerifiedAt: null, casoId: null, loteId: null } });
          if (gone.count !== 1) return false;
          await tx.documentAnalysis.deleteMany({ where: { id: { in: fileIds }, sessionToken: sessionKeyOf(id), orderId: null } });
          return true;
        }),
    },
    new Date(),
  );
  return Response.json({ ok: true, ...r });
}
