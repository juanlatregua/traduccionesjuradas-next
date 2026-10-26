import { prisma } from "@/lib/prisma";
import type { DeadlineUrgency } from "@/lib/needed-by";

/** Estampa la fecha del cliente en los documentos de su sesión y en su(s) caso(s). */
export async function saveSessionDeadline(sessionToken: string, d: { urgency: DeadlineUrgency; neededBy: Date | null }): Promise<number> {
  const data = { urgency: d.urgency, neededBy: d.neededBy };
  const res = await prisma.documentAnalysis.updateMany({ where: { sessionToken, orderId: null }, data });
  if (res.count === 0) return 0;
  const casos = await prisma.documentAnalysis.findMany({ where: { sessionToken, casoId: { not: null } }, select: { casoId: true }, distinct: ["casoId"] });
  const ids = casos.map((c) => c.casoId).filter((id): id is string => !!id);
  // Un caso con pedido ya tiene su plazo pactado: solo se rellena si no lo tenía.
  if (ids.length) await prisma.caso.updateMany({ where: { id: { in: ids }, OR: [{ orders: { none: {} } }, { urgency: null }] }, data });
  return res.count;
}
