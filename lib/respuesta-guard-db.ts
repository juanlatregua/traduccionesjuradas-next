import { prisma } from "@/lib/prisma";
import { hasInboxMessageFrom, isInboxConfigured } from "@/lib/azure-mail-read";
import {
  expandIdentity, liveBlock, LIVE_DAYS,
  type Identity, type LiveFact, type Pair,
} from "@/lib/respuesta-guard";

const eq = (f: string, emails: string[]) => emails.map((e) => ({ [f]: { equals: e, mode: "insensitive" as const } }));
const ends = (f: string, phones: string[]) => phones.map((p) => ({ [f]: { endsWith: p } }));

/**
 * Identidad ampliada: los registros con email Y teléfono (Quote, Customer, Order, DocumentAnalysis,
 * buzón) ligan el email de la puerta con el teléfono del presupuesto de WhatsApp, y al revés.
 */
export async function loadIdentity(seed: Pair): Promise<Identity> {
  const base = expandIdentity(seed, []);
  const emails = [...base.emails];
  const phones = [...base.phones];
  if (!emails.length && !phones.length) return base;
  const or = (ef: string, pf: string) => [...eq(ef, emails), ...ends(pf, phones)];
  const [q, c, o, d, i] = await Promise.all([
    prisma.quote.findMany({ where: { deletedAt: null, OR: or("customerEmail", "customerPhone") }, select: { customerEmail: true, customerPhone: true }, take: 50 }),
    prisma.customer.findMany({ where: { OR: or("email", "phone") }, select: { email: true, phone: true }, take: 50 }),
    prisma.order.findMany({ where: { OR: or("clientEmail", "clientPhone") }, select: { clientEmail: true, clientPhone: true }, take: 50 }),
    prisma.documentAnalysis.findMany({ where: { OR: or("clientEmail", "clientPhone") }, select: { clientEmail: true, clientPhone: true }, take: 50 }),
    prisma.inboundEmail.findMany({ where: { OR: or("fromEmail", "fromPhone") }, select: { fromEmail: true, fromPhone: true }, take: 50 }),
  ]);
  return expandIdentity(seed, [
    ...q.map((r) => ({ email: r.customerEmail, phone: r.customerPhone })),
    ...c.map((r) => ({ email: r.email, phone: r.phone })),
    ...o.map((r) => ({ email: r.clientEmail, phone: r.clientPhone })),
    ...d.map((r) => ({ email: r.clientEmail, phone: r.clientPhone })),
    ...i.map((r) => ({ email: r.fromEmail, phone: r.fromPhone })),
  ]);
}

/** Presupuesto vivo / pedido en curso o pagado (30 días) de esta persona. Ante un fallo lanza: quien llama NO envía. */
export async function findLiveBlock(seed: Pair, now = new Date()) {
  const id = await loadIdentity(seed);
  const emails = [...id.emails];
  const phones = [...id.phones];
  if (!emails.length && !phones.length) return null;
  const since = new Date(now.getTime() - LIVE_DAYS * 864e5);
  const [quotes, orders] = await Promise.all([
    prisma.quote.findMany({
      where: { deletedAt: null, createdAt: { gte: since }, OR: [...eq("customerEmail", emails), ...ends("customerPhone", phones)] },
      select: { quoteNumber: true, status: true, paidAt: true, createdAt: true, customerEmail: true, customerPhone: true },
      take: 50,
    }),
    prisma.order.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { paidAt: { gte: since } }], AND: [{ OR: [...eq("clientEmail", emails), ...ends("clientPhone", phones)] }] },
      select: { reference: true, status: true, paidAt: true, createdAt: true, clientEmail: true, clientPhone: true },
      take: 50,
    }),
  ]);
  const facts: LiveFact[] = [
    ...quotes.map((r) => ({ kind: "quote" as const, ref: r.quoteNumber, status: String(r.status), paidAt: r.paidAt, createdAt: r.createdAt, email: r.customerEmail, phone: r.customerPhone })),
    ...orders.filter((r) => String(r.status) !== "CANCELLED").map((r) => ({ kind: "order" as const, ref: r.reference, status: String(r.status), paidAt: r.paidAt, createdAt: r.createdAt, email: r.clientEmail, phone: r.clientPhone })),
  ];
  return liveBlock(id, facts, now);
}

export const GRAPH_CHECKS_PER_RUN = 40;

export type ReplyCheck = { ok: boolean; replied: boolean };

/**
 * Comprobador de respuestas de UNA ejecución: primero lo ya importado (email/WhatsApp en InboundEmail),
 * luego Graph por remitente (una consulta por email distinto, máx. `limit` por ejecución).
 * ok=false (Graph caído, sin configurar o sin cupo) → quien llama NO cierra ni recuerda.
 */
export function createReplyChecker(limit = GRAPH_CHECKS_PER_RUN) {
  const cache = new Map<string, boolean>();
  let used = 0;
  return async function check(seed: Pair, since: Date): Promise<ReplyCheck> {
    const id = await loadIdentity(seed);
    const emails = [...id.emails];
    const phones = [...id.phones];
    if (!emails.length && !phones.length) return { ok: true, replied: false };
    const n = await prisma.inboundEmail.count({
      where: { receivedAt: { gt: since }, OR: [...eq("fromEmail", emails), ...ends("fromPhone", phones)] },
    });
    if (n > 0) return { ok: true, replied: true };
    if (!emails.length) return { ok: true, replied: false };
    if (!isInboxConfigured()) return { ok: false, replied: false };
    for (const e of emails) {
      const key = `${e}|${since.getTime()}`;
      let r = cache.get(key);
      if (r === undefined) {
        if (used >= limit) return { ok: false, replied: false };
        used += 1;
        try {
          r = await hasInboxMessageFrom(e, since);
        } catch (err) {
          console.error("[respuesta-guard] Graph falló, no se cierra/recuerda:", err);
          return { ok: false, replied: false };
        }
        cache.set(key, r);
      }
      if (r) return { ok: true, replied: true };
    }
    return { ok: true, replied: false };
  };
}

