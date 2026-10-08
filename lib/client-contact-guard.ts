// lib/client-contact-guard.ts — guarda común de los crons que escriben al cliente.
// Núcleo PURO (testeable sin BD) + cargador Prisma que se llama UNA vez por ejecución.
// Solo cuentan PAGOS REALES (pedido PAID con paidAt, presupuesto PAID). ACCEPTED no es pago
// (lo pone el checkout al abrir el pago) y un pedido sin pagar tampoco.
//  · mode "persona" (leads de la puerta, sin presupuesto propio): misma persona + 14 días,
//    o misma huella sin límite. Los intermediarios no se excluyen por email.
//  · mode "encargo" (recordatorio/caducidad de PRESUPUESTO, recordatorio de pago de PEDIDO):
//    salta solo si ESE MISMO encargo ya se pagó por otra vía (misma huella o mismo expediente).
//    Haber pagado otra cosa no basta (2026-00199 vs 26_DCBAE3). Los hechos del propio
//    pedido/presupuesto se excluyen siempre (TJ-20261006-IPCM se saltaba a sí mismo).
import { intermediaryEmails, normEmail, PersonIndex, personKeys } from "./vigia-persona.ts";

export const GUARD_LOOKBACK_DAYS = 14;
const DAY = 864e5;

export type SkipReason = "pedido_pagado" | "presupuesto_pagado" | "analisis_con_pedido" | "mismo_documento" | "mismo_expediente";

export type ClientFact = {
  kind: "pedido_pagado" | "presupuesto_pagado" | "analisis_con_pedido";
  at: Date;
  ref: string;
  name?: string | null;
  emails?: (string | null | undefined)[];
  phones?: (string | null | undefined)[];
  sessions?: (string | null | undefined)[];
  refs?: (string | null | undefined)[]; // expedientes
  hashes?: (string | null | undefined)[];
  quoteId?: string | null;
  orderRef?: string | null;
};

export type QuoteFactMeta = { email: string; expRef?: string | null; holder?: string | null };

export type GuardInput = {
  mode?: "persona" | "encargo";
  email?: string | null;
  phone?: string | null;
  sessionToken?: string | null;
  expedienteRef?: string | null;
  fileHash?: string | null;
  hashes?: (string | null | undefined)[];
  /** Presupuesto (propio) que se está avisando. */
  quoteId?: string | null;
  /** Pedido (propio) que se está avisando. */
  orderRef?: string | null;
  orderId?: string | null;
  at?: Date;
};

export type GuardResult = { skip: false } | { skip: true; reason: SkipReason; ref: string };

export type AnalysisLite = { orderId?: string | null; sessionToken?: string | null; fileHash?: string | null };

export class CustomerIndex {
  readonly idx: PersonIndex;
  readonly byRoot = new Map<string, ClientFact[]>();
  readonly byHash = new Map<string, ClientFact[]>();
  readonly byRef = new Map<string, ClientFact[]>();
  readonly hashesByOrderId = new Map<string, string[]>();
  readonly hashesBySession = new Map<string, string[]>();
  readonly intermediaries: Set<string>;
  constructor(facts: ClientFact[], quotes: QuoteFactMeta[] = [], extraIntermediaries: string[] = [], analyses: AnalysisLite[] = []) {
    this.intermediaries = intermediaryEmails(quotes);
    for (const e of extraIntermediaries) this.intermediaries.add(normEmail(e));
    for (const a of analyses) {
      if (!a.fileHash) continue;
      if (a.orderId) this.hashesByOrderId.set(a.orderId, [...(this.hashesByOrderId.get(a.orderId) || []), a.fileHash]);
      if (a.sessionToken) this.hashesBySession.set(a.sessionToken, [...(this.hashesBySession.get(a.sessionToken) || []), a.fileHash]);
    }
    const rows = facts.map((fact) => ({ fact, keys: this.keysFor(fact) }));
    this.idx = new PersonIndex(rows.map((r) => ({ keys: r.keys, name: r.fact.name })));
    const push = (m: Map<string, ClientFact[]>, k: string, f: ClientFact) => m.set(k, [...(m.get(k) || []), f]);
    for (const r of rows) {
      const root = this.idx.rootOf(r.keys);
      if (root) push(this.byRoot, root, r.fact);
      for (const h of r.fact.hashes || []) if (h) push(this.byHash, h, r.fact);
      for (const x of r.fact.refs || []) if (x) push(this.byRef, x, r.fact);
    }
  }
  /** Claves de persona SIN el email de un intermediario (no identifica a nadie). */
  keysFor(i: { emails?: (string | null | undefined)[]; phones?: (string | null | undefined)[]; sessions?: (string | null | undefined)[]; refs?: (string | null | undefined)[]; hashes?: (string | null | undefined)[]; quoteId?: string | null }): string[] {
    const emails = (i.emails || []).filter((e) => !this.intermediaries.has(normEmail(e)));
    return personKeys({ emails, phones: i.phones, sessions: i.sessions, refs: i.refs, hashes: i.hashes, quoteIds: i.quoteId ? [i.quoteId] : [] });
  }
}

const isOwn = (f: ClientFact, i: GuardInput) =>
  (!!i.orderRef && f.orderRef === i.orderRef) || (!!i.quoteId && f.quoteId === i.quoteId);

export function alreadyCustomerFor(input: GuardInput, opts: { index: CustomerIndex; since?: Date }): GuardResult {
  const { index } = opts;
  const mode = input.mode ?? "persona";

  const hashes = new Set<string>([...(input.hashes || []), input.fileHash].filter((h): h is string => !!h));
  if (mode === "encargo") {
    if (input.orderId) for (const h of index.hashesByOrderId.get(input.orderId) || []) hashes.add(h);
    if (input.expedienteRef) for (const h of index.hashesBySession.get(input.expedienteRef) || []) hashes.add(h);
  }

  // Misma huella de documento ya pagada: es el mismo encargo, sin límite de fecha.
  for (const h of hashes) {
    const f = (index.byHash.get(h) || []).find((x) => !isOwn(x, input));
    if (f) return { skip: true, reason: "mismo_documento", ref: f.ref };
  }

  if (mode === "encargo") {
    if (input.expedienteRef) {
      const f = (index.byRef.get(input.expedienteRef) || []).find((x) => !isOwn(x, input));
      if (f) return { skip: true, reason: "mismo_expediente", ref: f.ref };
    }
    return { skip: false };
  }

  const cutoff = new Date((opts.since ?? input.at ?? new Date()).getTime() - GUARD_LOOKBACK_DAYS * DAY);
  const keys = index.keysFor({ emails: [input.email], phones: [input.phone], sessions: [input.sessionToken], refs: [input.expedienteRef], quoteId: input.quoteId });
  const roots = new Set<string>();
  for (const k of keys) { const r = index.idx.rootOf([k]); if (r) roots.add(r); }
  for (const root of roots) {
    for (const fact of index.byRoot.get(root) || []) {
      if (isOwn(fact, input) || fact.at < cutoff) continue;
      return { skip: true, reason: fact.kind, ref: fact.ref };
    }
  }
  return { skip: false };
}

/** Contador `skippedClients: {motivo: n}` para la respuesta del cron. */
export function countSkip(bucket: Record<string, number>, reason: string) {
  bucket[reason] = (bucket[reason] || 0) + 1;
}

/* ───────── Filas de BD → hechos (puro) ───────── */
export type PaidOrderRow = { id: string; reference: string; clientEmail: string; clientName?: string | null; clientPhone?: string | null; quoteId?: string | null; paidAt: Date | null; paymentStatus: string; status: string; quote?: { expedienteRef: string | null } | null };
export type QuoteRow = { id: string; quoteNumber: string; status: string; paidAt: Date | null; updatedAt: Date; customerEmail: string; customerName?: string | null; customerPhone?: string | null; expedienteRef: string | null; customer?: { email: string; phone: string | null } | null };
export type AnalysisRow = { id: string; orderId: string | null; clientEmail: string | null; clientName: string | null; clientPhone: string | null; sessionToken: string | null; fileHash: string | null; createdAt: Date };

/** Solo pagos reales: pedido PAID/DELIVERED con paidAt y paymentStatus PAID, o presupuesto PAID. */
export function buildFacts(rows: { orders: PaidOrderRow[]; quotes: QuoteRow[]; analyses: AnalysisRow[] }): ClientFact[] {
  const hashesBySession = new Map<string, string[]>();
  const hashesByOrder = new Map<string, string[]>();
  for (const a of rows.analyses) {
    if (!a.fileHash) continue;
    if (a.sessionToken) hashesBySession.set(a.sessionToken, [...(hashesBySession.get(a.sessionToken) || []), a.fileHash]);
    if (a.orderId) hashesByOrder.set(a.orderId, [...(hashesByOrder.get(a.orderId) || []), a.fileHash]);
  }
  const facts: ClientFact[] = [];
  const paidOrders = new Map<string, PaidOrderRow>();
  for (const o of rows.orders) {
    if (!o.paidAt || o.paymentStatus !== "PAID" || !(o.status === "PAID" || o.status === "DELIVERED" || o.status === "IN_PROGRESS")) continue;
    paidOrders.set(o.id, o);
    const exp = o.quote?.expedienteRef || null;
    facts.push({
      kind: "pedido_pagado", at: o.paidAt, ref: o.reference, name: o.clientName, emails: [o.clientEmail], phones: [o.clientPhone],
      quoteId: o.quoteId, orderRef: o.reference, refs: [exp], hashes: [...(hashesByOrder.get(o.id) || []), ...(exp ? hashesBySession.get(exp) || [] : [])],
    });
  }
  for (const q of rows.quotes) {
    if (!(q.status === "PAID" || q.paidAt)) continue;
    facts.push({
      kind: "presupuesto_pagado", at: q.paidAt ?? q.updatedAt, ref: q.quoteNumber, name: q.customerName,
      emails: [q.customerEmail, q.customer?.email], phones: [q.customerPhone, q.customer?.phone],
      quoteId: q.id, refs: [q.expedienteRef], hashes: q.expedienteRef ? hashesBySession.get(q.expedienteRef) || [] : [],
    });
  }
  // Un análisis enlazado a un pedido solo cuenta si ESE pedido está pagado.
  for (const a of rows.analyses) {
    const o = a.orderId ? paidOrders.get(a.orderId) : undefined;
    if (!o || !o.paidAt) continue;
    facts.push({ kind: "analisis_con_pedido", at: o.paidAt, ref: o.reference, name: a.clientName, emails: [a.clientEmail], phones: [a.clientPhone], sessions: [a.sessionToken], hashes: [a.fileHash], quoteId: o.quoteId, orderRef: o.reference });
  }
  return facts;
}

/**
 * Carga el índice UNA vez por ejecución. `since` = evento más antiguo (se resta la ventana).
 * `emails` = candidatos (detección de intermediarios); `orderIds`/`expedienteRefs` = encargos
 * que se van a avisar (para conocer sus huellas); `hashes` = huellas de leads.
 */
export async function loadCustomerIndex(opts: { since: Date; emails?: string[]; hashes?: string[]; orderIds?: string[]; expedienteRefs?: string[] }): Promise<CustomerIndex> {
  const { prisma } = await import("@/lib/prisma");
  const from = new Date(opts.since.getTime() - GUARD_LOOKBACK_DAYS * DAY);
  const emails = [...new Set((opts.emails || []).map(normEmail).filter(Boolean))];
  const hashes = [...new Set((opts.hashes || []).filter(Boolean))];
  const orderIds = [...new Set((opts.orderIds || []).filter(Boolean))];
  const refs = [...new Set((opts.expedienteRefs || []).filter(Boolean))];

  const [orders, quotes, emailQuotes, referrers] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "PAID", paidAt: { gte: from } },
      select: { id: true, reference: true, clientEmail: true, clientName: true, clientPhone: true, quoteId: true, paidAt: true, paymentStatus: true, status: true, quote: { select: { expedienteRef: true } } },
      take: 5000,
    }),
    prisma.quote.findMany({
      where: { deletedAt: null, OR: [{ paidAt: { gte: from } }, { status: "PAID", updatedAt: { gte: from } }] },
      select: { id: true, quoteNumber: true, status: true, paidAt: true, updatedAt: true, customerEmail: true, customerName: true, customerPhone: true, expedienteRef: true, customer: { select: { email: true, phone: true } } },
      take: 5000,
    }),
    emails.length
      ? prisma.quote.findMany({ where: { customerEmail: { in: emails, mode: "insensitive" } }, select: { customerEmail: true, expedienteRef: true, holderNames: true }, take: 5000 })
      : Promise.resolve([]),
    emails.length
      ? prisma.customer.findMany({ where: { email: { in: emails, mode: "insensitive" }, referrals: { some: {} } }, select: { email: true } })
      : Promise.resolve([]),
  ]);

  const paidOrderIds = orders.map((o) => o.id);
  const sessionRefs = [...new Set([...refs, ...quotes.map((q) => q.expedienteRef || ""), ...orders.map((o) => o.quote?.expedienteRef || "")].filter(Boolean))];
  const analyses = await prisma.documentAnalysis.findMany({
    where: { OR: [{ orderId: { in: [...paidOrderIds, ...orderIds] } }, ...(sessionRefs.length ? [{ sessionToken: { in: sessionRefs } }] : []), ...(hashes.length ? [{ fileHash: { in: hashes }, orderId: { in: paidOrderIds } }] : [])] },
    select: { id: true, orderId: true, clientEmail: true, clientName: true, clientPhone: true, sessionToken: true, fileHash: true, createdAt: true },
    take: 10000,
  });

  const facts = buildFacts({ orders, quotes, analyses });
  const meta: QuoteFactMeta[] = emailQuotes.map((q) => ({ email: q.customerEmail, expRef: q.expedienteRef, holder: q.holderNames }));
  return new CustomerIndex(facts, meta, referrers.map((r) => r.email), analyses);
}
