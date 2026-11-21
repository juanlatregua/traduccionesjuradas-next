// Archivos de una entrada (DocumentAnalysis «entrada:<id>», siempre UPLOADED) frente a la limpieza de 30 días
// (app/api/cron/document-cleanup): siguen mientras su caso tenga un presupuesto vivo reciente o un pedido sin terminar,
// se borran 30 días después de la entrega (la promesa del consentimiento) y nunca pasan de 180 días.
import { quoteVivo } from "../caso/estados.ts";
import { ENTRADA_SESSION_PREFIX } from "./leads.ts";

export const QUOTE_VIVO_MAX_DIAS = 90;
export const ENTRADA_FILES_MAX_DIAS = 180;

export type CasoVida = {
  quotes: { status: string; deletedAt: Date | null; lostReason: string | null; updatedAt: Date }[];
  /** deliveredAt: the delivery itself (event or document item); null = unknown, then the order's last update. */
  orders: { status: string; paymentStatus: string; updatedAt: Date; deliveredAt: Date | null }[];
};

export const isEntradaSession = (sessionToken: string | null | undefined) => Boolean(sessionToken?.startsWith(ENTRADA_SESSION_PREFIX));

/** threshold = now − 30 days. */
export function keepEntradaFiles(caso: CasoVida | null | undefined, x: { now: Date; threshold: Date; fileCreatedAt: Date }): boolean {
  if (!caso) return false;
  const day = 864e5;
  if (x.now.getTime() - x.fileCreatedAt.getTime() > ENTRADA_FILES_MAX_DIAS * day) return false;
  if (caso.quotes.some((q) => quoteVivo(q) && x.now.getTime() - q.updatedAt.getTime() < QUOTE_VIVO_MAX_DIAS * day)) return true;
  return caso.orders.some((o) => {
    if (o.status === "CANCELLED" || o.paymentStatus === "REFUNDED") return false;
    if (o.status !== "DELIVERED") return true;
    return (o.deliveredAt ?? o.updatedAt).getTime() >= x.threshold.getTime();
  });
}
