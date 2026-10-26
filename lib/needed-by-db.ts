import { prisma } from "@/lib/prisma";
import type { DeadlineUrgency } from "@/lib/needed-by";

/** Estampa la fecha del cliente en los documentos de su sesión y en su(s) caso(s). */
export async function saveSessionDeadline(sessionToken: string, d: { urgency: DeadlineUrgency; neededBy: Date | null }): Promise<number> {
  const data = { urgency: d.urgency, neededBy: d.neededBy };
  const res = await prisma.documentAnalysis.updateMany({ where: { sessionToken }, data });
  if (res.count === 0) return 0;
  const casos = await prisma.documentAnalysis.findMany({ where: { sessionToken, casoId: { not: null } }, select: { casoId: true }, distinct: ["casoId"] });
  const ids = casos.map((c) => c.casoId).filter((id): id is string => !!id);
  if (ids.length) await prisma.caso.updateMany({ where: { id: { in: ids } }, data });
  return res.count;
}
