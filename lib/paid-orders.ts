// «Ya pagó» para leads: ventana de CARGA de pedidos (14 días) y regla de cobertura. Una llegada la cubre un
// pago solo si es la misma persona Y (comparte huella de documento con el pedido O llega a ±24 h del pago).
// Un documento distinto más de 24 h después del pago sigue siendo un lead nuevo.
import { phoneKey, realEmailKey } from "./client-identity.ts";
import { WA_LOCAL, personKeys } from "./vigia-persona.ts";

export const PAID_LOOKBACK_DAYS = 14;
export const PAID_COVER_HOURS = 24;

export type PaidArrival = { email?: string | null; phone?: string | null; at: Date; hashes?: (string | null | undefined)[]; sameRoot?: (o: PaidOrderLike) => boolean };
export type PaidOrderLike = { clientEmail: string | null; clientPhone: string | null; paidAt: Date; fileHashes?: (string | null | undefined)[] };

export const paidSince = (now: Date) => new Date(now.getTime() - PAID_LOOKBACK_DAYS * 864e5);

const hashKeys = (hashes?: (string | null | undefined)[]) => personKeys({ hashes });
const emailOf = (email?: string | null) => realEmailKey(email);
const phoneOf = (email?: string | null, phone?: string | null) => phoneKey(phone) || phoneKey(WA_LOCAL.exec(String(email || "").trim().toLowerCase())?.[1]);

/**
 * Una llegada la cubre un pedido pagado de la misma persona (o de su misma raíz en el grafo) si:
 * (a) comparte huella con el pedido (antes o después del pago); (b) llegó antes del pago, como mucho 24 h antes;
 * (c) llegó después sin huella (WhatsApp/email) en las 72 h siguientes; (d) el pedido no tiene huellas y está a ±24 h.
 * Un documento nuevo (huella distinta) después del pago es un lead nuevo.
 */
export function hasPaidOrder(a: PaidArrival, paidOrders: PaidOrderLike[]): boolean {
  const e = emailOf(a.email);
  const p = phoneOf(a.email, a.phone);
  const mine = new Set(hashKeys(a.hashes));
  return paidOrders.some((o) => {
    const oe = emailOf(o.clientEmail);
    const op = phoneOf(o.clientEmail, o.clientPhone);
    if (!((!!e && oe === e) || (!!p && op === p) || a.sameRoot?.(o))) return false;
    const dt = a.at.getTime() - o.paidAt.getTime();
    const day = PAID_COVER_HOURS * 36e5;
    const theirs = hashKeys(o.fileHashes);
    if (theirs.some((k) => mine.has(k))) return true;
    if (dt <= 0) return -dt <= day;
    if (!mine.size) return dt <= 3 * day;
    return !theirs.length && dt <= day;
  });
}

/** where de Prisma: pedidos PAGADOS de esa persona en la ventana de carga (null si no hay email ni teléfono). Después, hasPaidOrder decide. */
export function personPaidOrdersWhere(a: { email?: string | null; phone?: string | null }, now: Date) {
  const e = emailOf(a.email);
  const p = phoneOf(a.email, a.phone);
  const who = [...(e ? [{ clientEmail: { equals: e, mode: "insensitive" as const } }] : []), ...(p ? [{ clientPhone: { endsWith: p } }, { clientEmail: { endsWith: `${p}@whatsapp.local` } }] : [])];
  return who.length ? { paymentStatus: "PAID" as const, paidAt: { gte: paidSince(now) }, OR: who } : null;
}
