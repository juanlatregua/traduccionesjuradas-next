// Archivos de una entrada (DocumentAnalysis «entrada:<id>», siempre UPLOADED) frente a la limpieza de 30 días
// (app/api/cron/document-cleanup): siguen mientras su caso tenga un presupuesto vivo o un pedido sin terminar,
// y se borran 30 días después de la entrega (la promesa del consentimiento).
import { quoteVivo } from "../caso/estados.ts";
import { ENTRADA_SESSION_PREFIX } from "./leads.ts";

export type CasoVida = {
  quotes: { status: string; deletedAt: Date | null; lostReason: string | null }[];
  orders: { status: string; updatedAt: Date }[];
};

export const isEntradaSession = (sessionToken: string | null | undefined) => Boolean(sessionToken?.startsWith(ENTRADA_SESSION_PREFIX));

/** threshold = now − 30 days. A DELIVERED order counts as delivered at its last update. */
export function keepEntradaFiles(caso: CasoVida | null | undefined, threshold: Date): boolean {
  if (!caso) return false;
  if (caso.quotes.some((q) => quoteVivo(q))) return true;
  return caso.orders.some((o) => o.status !== "CANCELLED" && (o.status !== "DELIVERED" || o.updatedAt.getTime() >= threshold.getTime()));
}
