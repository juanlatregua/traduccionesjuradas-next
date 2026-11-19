import { prisma } from "@/lib/prisma";
import { entradaLeads, type EntradaLead } from "./leads.ts";
import { sessionKeyOf } from "./store.ts";

/** Fail-open: before the Entrada table exists (or if it fails) the vigía and the SLA keep working without it. */
export async function loadEntradaLeads(since: Date): Promise<EntradaLead[]> {
  try {
    const entradas = await prisma.entrada.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 500 });
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
    );
  } catch (err) {
    console.error("[entrada] leads", err);
    return [];
  }
}
