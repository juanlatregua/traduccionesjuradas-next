import { prisma } from "@/lib/prisma";
import { entradaFunnel, entradaLeads, type EntradaLead } from "./leads.ts";
import { sessionKeyOf } from "./store.ts";

/** Fail-open: before the Entrada table exists (or if it fails) the vigía and the SLA keep working without it. */
export async function loadEntradaLeads(since: Date, opts: { all?: boolean } = {}): Promise<EntradaLead[]> {
  try {
    const entradas = await prisma.entrada.findMany({ where: { createdAt: { gte: since }, estado: { not: "prueba" } }, orderBy: { createdAt: "asc" }, take: 500 });
    if (entradas.length === 0) return [];
    const [files, casos] = await Promise.all([
      prisma.documentAnalysis.findMany({
        where: { sessionToken: { in: entradas.map((e) => sessionKeyOf(e.id)) }, orderId: null },
        select: { sessionToken: true, fileName: true, fileHash: true },
      }),
      prisma.caso.findMany({ where: { id: { in: entradas.map((e) => e.casoId).filter((x): x is string => !!x) } }, select: { id: true, email: true, phone9: true } }),
    ]);
    return entradaLeads(
      entradas.map((e) => {
        const caso = casos.find((c) => c.id === e.casoId);
        return {
          ...e,
          email: e.email ?? caso?.email ?? null,
          phone9: e.phone9 ?? caso?.phone9 ?? null,
          files: files.filter((f) => f.sessionToken === sessionKeyOf(e.id)).map((f) => ({ name: f.fileName, sha256: f.fileHash })),
        };
      }),
      opts,
    );
  } catch (err) {
    console.error("[entrada] leads", err);
    return [];
  }
}

export async function loadEntradaFunnel(since: Date, source?: string): Promise<{ analizado: number; lead: number }> {
  try {
    const entradas = await prisma.entrada.findMany({ where: { createdAt: { gte: since }, estado: { not: "prueba" }, ...(source ? { source } : {}) }, select: { id: true, loteId: true, email: true, phone9: true } });
    if (entradas.length === 0) return { analizado: 0, lead: 0 };
    const groups = await prisma.documentAnalysis.groupBy({ by: ["sessionToken"], where: { sessionToken: { in: entradas.map((e) => sessionKeyOf(e.id)) } }, _count: { _all: true } });
    const n = new Map(groups.map((g) => [g.sessionToken, g._count._all]));
    return entradaFunnel(entradas.map((e) => ({ ...e, files: n.get(sessionKeyOf(e.id)) ?? 0 })));
  } catch (err) {
    console.error("[entrada] funnel", err);
    return { analizado: 0, lead: 0 };
  }
}
