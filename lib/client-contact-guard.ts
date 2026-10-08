// lib/client-contact-guard.ts — guarda común de los crons que escriben al cliente:
// no se avisa a quien ya pagó (8-oct-2026: 25 avisos en 30 días a clientes pagados;
// Carme Casasayas recibió «Tu presupuesto sigue disponible» ya pagada y entregada).
// Núcleo PURO (testeable sin BD) + cargador Prisma que se llama UNA vez por ejecución.
import { intermediaryEmails, normEmail, PersonIndex, personKeys } from "./vigia-persona.ts";

export const GUARD_LOOKBACK_DAYS = 14;
const DAY = 864e5;

export type SkipReason =
  | "pedido_pagado"
  | "presupuesto_pagado"
  | "presupuesto_aceptado"
  | "presupuesto_con_pedido"
  | "analisis_con_pedido"
  | "mismo_documento";

export type ClientFact = {
  kind: Exclude<SkipReason, "mismo_documento">;
  at: Date;
  ref: string;
  name?: string | null;
  emails?: (string | null | undefined)[];
  phones?: (string | null | undefined)[];
  sessions?: (string | null | undefined)[];
  refs?: (string | null | undefined)[];
  hashes?: (string | null | undefined)[];
  quoteId?: string | null;
};

export type QuoteFactMeta = { email: string; expRef?: string | null; holder?: string | null };

export type GuardInput = {
  email?: string | null;
  phone?: string | null;
  sessionToken?: string | null;
  expedienteRef?: string | null;
  fileHash?: string | null;
  /** Presupuesto que se está avisando: si él mismo está pagado/aceptado/con pedido, también se salta. */
  quoteId?: string | null;
  /** Fecha del evento (subida del documento, envío del presupuesto…). Por defecto, ahora. */
  at?: Date;
};

export type GuardResult = { skip: false } | { skip: true; reason: SkipReason; ref: string };

export class CustomerIndex {
  readonly idx: PersonIndex;
  readonly byRoot = new Map<string, { fact: ClientFact; keys: string[] }[]>();
  readonly byHash = new Map<string, ClientFact>();
  readonly intermediaries: Set<string>;
  constructor(facts: ClientFact[], quotes: QuoteFactMeta[] = [], extraIntermediaries: string[] = []) {
    this.intermediaries = intermediaryEmails(quotes);
    for (const e of extraIntermediaries) this.intermediaries.add(normEmail(e));
    const rows = facts.map((fact) => ({ fact, keys: this.keysFor(fact) }));
    this.idx = new PersonIndex(rows.map((r) => ({ keys: r.keys, name: r.fact.name })));
    for (const r of rows) {
      const root = this.idx.rootOf(r.keys);
      if (root) this.byRoot.set(root, [...(this.byRoot.get(root) || []), r]);
      for (const h of r.fact.hashes || []) if (h && !this.byHash.has(h)) this.byHash.set(h, r.fact);
    }
  }
  /** Claves de persona SIN el email de un intermediario (no identifica a nadie). */
  keysFor(i: { emails?: (string | null | undefined)[]; phones?: (string | null | undefined)[]; sessions?: (string | null | undefined)[]; refs?: (string | null | undefined)[]; hashes?: (string | null | undefined)[]; quoteId?: string | null }): string[] {
    const emails = (i.emails || []).filter((e) => !this.intermediaries.has(normEmail(e)));
    return personKeys({ emails, phones: i.phones, sessions: i.sessions, refs: i.refs, hashes: i.hashes, quoteIds: i.quoteId ? [i.quoteId] : [] });
  }
}

/** ¿Esta persona ya es cliente (pagó o tiene su encargo en marcha)? Pura: el índice se carga fuera. */
export function alreadyCustomerFor(input: GuardInput, opts: { index: CustomerIndex; since?: Date }): GuardResult {
  const { index } = opts;
  const cutoff = new Date((opts.since ?? input.at ?? new Date()).getTime() - GUARD_LOOKBACK_DAYS * DAY);

  // Misma huella de documento: ya es un encargo suyo, sin límite de fecha.
  if (input.fileHash) {
    const f = index.byHash.get(input.fileHash);
    if (f) return { skip: true, reason: "mismo_documento", ref: f.ref };
  }

  const keys = index.keysFor({
    emails: [input.email],
    phones: [input.phone],
    sessions: [input.sessionToken],
    refs: [input.expedienteRef],
    quoteId: input.quoteId,
  });
  const roots = new Set<string>();
  for (const k of keys) { const r = index.idx.rootOf([k]); if (r) roots.add(r); }
  for (const root of roots) {
    for (const { fact } of index.byRoot.get(root) || []) {
      if (fact.at < cutoff) continue;
      return { skip: true, reason: fact.kind, ref: fact.ref };
    }
  }
  return { skip: false };
}

/** Contador `skippedClients: {motivo: n}` para la respuesta del cron. */
export function countSkip(bucket: Record<string, number>, reason: string) {
  bucket[reason] = (bucket[reason] || 0) + 1;
}

/**
 * Carga el índice UNA vez por ejecución. `since` = el evento más antiguo a vigilar
 * (el cargador resta los 14 días). `emails`/`hashes` = los candidatos del cron: sirven
 * para detectar intermediarios (todos los presupuestos de esos emails, sin límite de
 * fecha) y para cruzar huellas de documentos ya con pedido.
 */
export async function loadCustomerIndex(opts: { since: Date; emails?: string[]; hashes?: string[] }): Promise<CustomerIndex> {
  const { prisma } = await import("@/lib/prisma");
  const from = new Date(opts.since.getTime() - GUARD_LOOKBACK_DAYS * DAY);
  const emails = [...new Set((opts.emails || []).map(normEmail).filter(Boolean))];
  const hashes = [...new Set((opts.hashes || []).filter(Boolean))];

  const [orders, quotes, analyses, emailQuotes, referrers] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: ["PAID", "DELIVERED", "IN_PROGRESS"] },
        paymentStatus: "PAID",
        OR: [{ paidAt: { gte: from } }, { paidAt: null, createdAt: { gte: from } }],
      },
      select: { reference: true, clientEmail: true, clientName: true, clientPhone: true, quoteId: true, paidAt: true, createdAt: true },
      take: 5000,
    }),
    prisma.quote.findMany({
      where: {
        deletedAt: null,
        OR: [{ paidAt: { gte: from } }, { status: { in: ["ACCEPTED", "PAID"] }, updatedAt: { gte: from } }, { orders: { some: {} }, updatedAt: { gte: from } }],
      },
      select: {
        id: true, quoteNumber: true, status: true, paidAt: true, updatedAt: true, customerEmail: true, customerName: true, customerPhone: true,
        expedienteRef: true, customer: { select: { email: true, phone: true } }, orders: { select: { id: true }, take: 1 },
      },
      take: 5000,
    }),
    prisma.documentAnalysis.findMany({
      where: {
        orderId: { not: null },
        OR: [{ createdAt: { gte: from } }, ...(hashes.length ? [{ fileHash: { in: hashes } }] : [])],
      },
      select: { id: true, clientEmail: true, clientName: true, clientPhone: true, sessionToken: true, fileHash: true, createdAt: true, order: { select: { reference: true } } },
      take: 5000,
    }),
    emails.length
      ? prisma.quote.findMany({
          where: { customerEmail: { in: emails, mode: "insensitive" } },
          select: { customerEmail: true, expedienteRef: true, holderNames: true },
          take: 5000,
        })
      : Promise.resolve([]),
    emails.length
      ? prisma.customer.findMany({ where: { email: { in: emails, mode: "insensitive" }, referrals: { some: {} } }, select: { email: true } })
      : Promise.resolve([]),
  ]);

  const facts: ClientFact[] = [];
  for (const o of orders) {
    facts.push({ kind: "pedido_pagado", at: o.paidAt ?? o.createdAt, ref: o.reference, name: o.clientName, emails: [o.clientEmail], phones: [o.clientPhone], quoteId: o.quoteId, refs: [] });
  }
  for (const q of quotes) {
    const kind: ClientFact["kind"] = q.paidAt || q.status === "PAID" ? "presupuesto_pagado" : q.status === "ACCEPTED" ? "presupuesto_aceptado" : "presupuesto_con_pedido";
    facts.push({
      kind, at: q.paidAt ?? q.updatedAt, ref: q.quoteNumber, name: q.customerName,
      emails: [q.customerEmail, q.customer?.email], phones: [q.customerPhone, q.customer?.phone],
      refs: [q.expedienteRef], quoteId: q.id,
    });
  }
  for (const a of analyses) {
    facts.push({ kind: "analisis_con_pedido", at: a.createdAt, ref: a.order?.reference || a.id, name: a.clientName, emails: [a.clientEmail], phones: [a.clientPhone], sessions: [a.sessionToken], hashes: [a.fileHash] });
  }
  const meta: QuoteFactMeta[] = emailQuotes.map((q) => ({ email: q.customerEmail, expRef: q.expedienteRef, holder: q.holderNames }));
  return new CustomerIndex(facts, meta, referrers.map((r) => r.email));
}
