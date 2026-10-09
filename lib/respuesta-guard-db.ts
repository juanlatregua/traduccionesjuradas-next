import { prisma } from "@/lib/prisma";
import { hasInboxMessageFrom, isInboxConfigured } from "@/lib/azure-mail-read";
import { getMailboxAddress } from "@/lib/azure-mail";
import { isStaffEmail } from "@/lib/staff-access";
import { phoneKey, realEmailKey } from "@/lib/client-identity";
import {
  expandIdentity, isOwnAddress, liveBlock, LIVE_DAYS,
  type Identity, type LiveFact, type Pair,
} from "@/lib/respuesta-guard";

const eq = (f: string, emails: string[]) => emails.map((e) => ({ [f]: { equals: e, mode: "insensitive" as const } }));
const ends = (f: string, phones: string[]) => phones.map((p) => ({ [f]: { endsWith: p } }));

const isOwn = (e: string) => isOwnAddress(e, [getMailboxAddress(), "hola@traduccionesjuradas.net", "info@traduccionesjuradas.net"]) || isStaffEmail(e);

/** Contrapartes DISTINTAS de una clave (consulta propia, no la muestra de pares): >MAX_FANOUT = intermediario. */
async function countCounterparts(kind: "email" | "phone", key: string): Promise<number> {
  const out = new Set<string>();
  const w = (ef: string, pf: string) => (kind === "email" ? eq(ef, [key]) : ends(pf, [key]));
  const [q, c, o, d] = await Promise.all([
    prisma.quote.findMany({ where: { deletedAt: null, OR: w("customerEmail", "customerPhone") }, select: { customerEmail: true, customerPhone: true }, distinct: [kind === "email" ? "customerPhone" : "customerEmail"], take: 10 }),
    prisma.customer.findMany({ where: { OR: w("email", "phone") }, select: { email: true, phone: true }, take: 10 }),
    prisma.order.findMany({ where: { OR: w("clientEmail", "clientPhone") }, select: { clientEmail: true, clientPhone: true }, distinct: [kind === "email" ? "clientPhone" : "clientEmail"], take: 10 }),
    prisma.documentAnalysis.findMany({ where: { OR: w("clientEmail", "clientPhone") }, select: { clientEmail: true, clientPhone: true }, distinct: [kind === "email" ? "clientPhone" : "clientEmail"], take: 10 }),
  ]);
  const rows: Pair[] = [
    ...q.map((r) => ({ email: r.customerEmail, phone: r.customerPhone })),
    ...c.map((r) => ({ email: r.email, phone: r.phone })),
    ...o.map((r) => ({ email: r.clientEmail, phone: r.clientPhone })),
    ...d.map((r) => ({ email: r.clientEmail, phone: r.clientPhone })),
  ];
  for (const r of rows) {
    const other = kind === "email" ? phoneKey(r.phone) : realEmailKey(r.email);
    if (other) out.add(other);
  }
  return out.size;
}

/**
 * Identidad ampliada con UN salto: los registros con email Y teléfono (Quote, Customer, Order,
 * DocumentAnalysis, buzón) ligan el email de la puerta con el teléfono del presupuesto de WhatsApp, y al revés.
 */
export async function loadIdentity(seed: Pair): Promise<Identity> {
  const base = expandIdentity(seed, [], { isOwn });
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
  const pairs: Pair[] = [
    ...q.map((r) => ({ email: r.customerEmail, phone: r.customerPhone })),
    ...c.map((r) => ({ email: r.email, phone: r.phone })),
    ...o.map((r) => ({ email: r.clientEmail, phone: r.clientPhone })),
    ...d.map((r) => ({ email: r.clientEmail, phone: r.clientPhone })),
    ...i.map((r) => ({ email: r.fromEmail, phone: r.fromPhone })),
  ];
  // Solo se cuentan las claves que de verdad podrían ligar (las del propio registro con email Y teléfono).
  const memo = new Map<string, number>();
  const need = new Set<string>();
  for (const p of pairs) {
    const e = realEmailKey(p.email);
    const ph = phoneKey(p.phone);
    if (!e || !ph) continue;
    if (base.emails.has(e) || base.phones.has(ph)) { need.add(`email|${e}`); need.add(`phone|${ph}`); }
  }
  await Promise.all([...need].map(async (k) => {
    const [kind, key] = k.split("|") as ["email" | "phone", string];
    memo.set(k, await countCounterparts(kind, key));
  }));
  return expandIdentity(seed, pairs, { isOwn, fanout: (kind, key) => memo.get(`${kind}|${key}`) ?? 0 });
}

/** Presupuesto vivo / pedido en curso o pagado (30 días) de esta persona. Ante un fallo lanza: quien llama NO envía. */
export async function findLiveBlock(seed: Pair, opts: { now?: Date; leadAt?: Date } = {}) {
  const now = opts.now ?? new Date();
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
      where: { createdAt: { gte: since }, OR: [...eq("clientEmail", emails), ...ends("clientPhone", phones)] },
      select: { reference: true, status: true, paidAt: true, createdAt: true, clientEmail: true, clientPhone: true },
      take: 50,
    }),
  ]);
  const facts: LiveFact[] = [
    ...quotes.map((r) => ({ kind: "quote" as const, ref: r.quoteNumber, status: String(r.status), paidAt: r.paidAt, createdAt: r.createdAt, email: r.customerEmail, phone: r.customerPhone })),
    ...orders.filter((r) => String(r.status) !== "CANCELLED").map((r) => ({ kind: "order" as const, ref: r.reference, status: String(r.status), paidAt: r.paidAt, createdAt: r.createdAt, email: r.clientEmail, phone: r.clientPhone })),
  ];
  return liveBlock(id, facts, now, { leadAt: opts.leadAt });
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
    const emails = [...id.emails].filter((e) => !isOwn(e));
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

