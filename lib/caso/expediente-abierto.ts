import { prisma } from "@/lib/prisma";
import { casoAbierto, QUOTE_FORMALIZADOS } from "@/lib/caso/estados";
import { presupuestoVivoDelCaso } from "@/lib/caso/hilo-db";
import { parFromLangs } from "@/lib/lavori-dup-guard";

export type ExpedienteAbierto = {
  ref: string;
  quote: { id: string; quoteNumber: string } | null;
};

/**
 * Expediente del caso ABIERTO, mismo par y aún sin cobrar: una 2.ª subida de la
 * misma clienta se suma a él en vez de abrir otro (Claudia 2026-00355, 7-nov-2026:
 * la 2.ª subida quedó en un expediente invisible y el presupuesto cobraba 1 de 3).
 */
export async function expedienteAbiertoDelCaso(
  casoId: string | null,
  par: { source: string | null; target: string | null }
): Promise<ExpedienteAbierto | null> {
  if (!casoId) return null;
  const caso = await prisma.caso.findUnique({ where: { id: casoId }, select: { estado: true } });
  if (!caso || !casoAbierto(caso.estado)) return null;

  const doc = await prisma.documentAnalysis.findFirst({
    where: {
      casoId,
      sessionToken: { startsWith: "exp:" },
      sourceLanguage: par.source,
      targetLanguage: par.target,
    },
    orderBy: { createdAt: "desc" },
    select: { sessionToken: true },
  });
  if (!doc?.sessionToken) return null;
  const ref = doc.sessionToken.slice("exp:".length);

  // Ya cobrado (aunque el caso no haya pasado a EN_CURSO): expediente nuevo.
  const [cobrado, pedido] = await Promise.all([
    prisma.quote.count({ where: { expedienteRef: ref, deletedAt: null, status: { in: [...QUOTE_FORMALIZADOS] } } }),
    prisma.order.count({ where: { casoId } }),
  ]);
  if (cobrado > 0 || pedido > 0) return null;

  const vivo = await presupuestoVivoDelCaso(casoId, parFromLangs(par.source, par.target || "es"));
  return { ref, quote: vivo ? { id: vivo.id, quoteNumber: vivo.quoteNumber } : null };
}
