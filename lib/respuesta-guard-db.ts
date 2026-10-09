import { prisma } from "@/lib/prisma";
import { listInboxMessages, isInboxConfigured } from "@/lib/azure-mail-read";
import {
  expandIdentity, liveBlock, repliedSince, LIVE_DAYS,
  type Identity, type Incoming, type LiveFact, type Pair,
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

export type InboxSnapshot = { ok: boolean; msgs: Incoming[] };

/** UNA consulta al buzón hola@ por ejecución (72 h). ok=false si Graph falla o la lista puede estar truncada. */
export async function loadInboxSnapshot(now = new Date()): Promise<InboxSnapshot> {
  if (!isInboxConfigured()) return { ok: false, msgs: [] };
  try {
    const top = 100;
    const rows = await listInboxMessages({ since: new Date(now.getTime() - 72 * 3600e3), top });
    if (rows.length >= top) {
      console.error("[respuesta-guard] buzón con ≥100 mensajes en 72 h: lectura truncada, no se actúa");
      return { ok: false, msgs: [] };
    }
    return { ok: true, msgs: rows.map((m) => ({ from: m.fromEmail, at: m.receivedAt })) };
  } catch (err) {
    console.error("[respuesta-guard] Graph falló, no se cierra/recuerda en esta ejecución:", err);
    return { ok: false, msgs: [] };
  }
}

/** ¿Contestó (email en hola@ o entrante ya importado: email/WhatsApp) después de `since`? */
export async function hasReplied(seed: Pair, since: Date, snap: InboxSnapshot): Promise<boolean> {
  const id = await loadIdentity(seed);
  if (repliedSince(id, snap.msgs, since)) return true;
  const emails = [...id.emails];
  const phones = [...id.phones];
  if (!emails.length && !phones.length) return false;
  const n = await prisma.inboundEmail.count({
    where: { receivedAt: { gt: since }, OR: [...eq("fromEmail", emails), ...ends("fromPhone", phones)] },
  });
  return n > 0;
}
