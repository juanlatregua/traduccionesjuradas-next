// Carga de datos del Panel (solo servidor, solo lectura). Filas compactas; la agregación vive en panel-metrics.
import { prisma } from "@/lib/prisma";
import { isCasaPair } from "@/lib/lavori-bridge";
import { isTestTitle, type PanelData } from "@/lib/panel-metrics";
import { madridMidnightUtc, parseYmd, todayMadrid, type Period } from "@/lib/panel-period";

export async function loadPanelData(period: Period): Promise<{ current: PanelData; previous: PanelData }> {
  const prevStart = new Date(period.prevStart);
  const end = new Date(period.end);
  const inCurrent = (iso: string) => iso >= period.start && iso < period.end;

  const [orders, quotes, requests, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "PAID", paidAt: { gte: prevStart, lt: end } },
      select: {
        reference: true,
        paidAt: true,
        amountCents: true,
        supplierCostCents: true,
        langPair: true,
        assignedTo: true,
        clientName: true,
        clientEmail: true,
        paymentMethod: true,
        title: true,
        clientInvoice: { select: { baseCents: true, status: true, docKind: true } },
      },
    }),
    prisma.quote.findMany({
      where: { issuedAt: { gte: prevStart, lt: end }, deletedAt: null },
      select: { id: true, issuedAt: true, status: true, total: true, sourceLang: true, targetLang: true, lostReason: true },
    }),
    prisma.lavoriPriceRequest.findMany({
      where: { createdAt: { gte: prevStart, lt: end } },
      select: { ref: true, createdAt: true, status: true, par: true, priceCents: true, createdBy: true },
    }),
    prisma.expense.findMany({
      where: { isAccrual: false, date: { gte: prevStart, lt: end } },
      select: { date: true, baseCents: true, category: true, supplier: true },
    }),
  ]);

  const kept = orders.filter((o) => o.paidAt && !isTestTitle(o.title));
  // Sin supplierCostCents, el coste del traductor es su factura (o, si aún no la hay, el devengo) atada al pedido.
  const linked = await prisma.expense.findMany({
    where: { category: "colaborador", orderReference: { in: kept.filter((o) => o.supplierCostCents == null).map((o) => o.reference) } },
    select: { orderReference: true, baseCents: true, isAccrual: true },
  });
  const linkedCost = new Map<string, { invoice: number; accrual: number }>();
  for (const x of linked) {
    const c = linkedCost.get(x.orderReference!) ?? { invoice: 0, accrual: 0 };
    if (x.isAccrual) c.accrual += x.baseCents;
    else c.invoice += x.baseCents;
    linkedCost.set(x.orderReference!, c);
  }

  const orderRows = kept.map((o) => {
    const inv = o.clientInvoice;
    const lc = linkedCost.get(o.reference);
    return {
      paidAt: o.paidAt!.toISOString(),
      amountCents: o.amountCents,
      invoiceBaseCents: inv && inv.status === "ISSUED" && inv.docKind === "invoice" ? inv.baseCents : null,
      supplierCostCents: o.supplierCostCents ?? (lc ? lc.invoice || lc.accrual : null),
      langPair: o.langPair,
      assignedTo: o.assignedTo,
      client: o.clientName?.trim() || o.clientEmail,
      paymentMethod: o.paymentMethod,
    };
  });
  const quoteRows = quotes.map((q) => ({
    id: q.id,
    issuedAt: q.issuedAt.toISOString(),
    status: q.status,
    total: Number(q.total),
    sourceLang: q.sourceLang,
    targetLang: q.targetLang,
    lostReason: q.lostReason,
  }));
  const requestRows = requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  const expenseRows = expenses.map((e) => ({ ...e, date: e.date.toISOString() }));

  const split = <T,>(rows: T[], iso: (r: T) => string) => ({
    current: rows.filter((r) => inCurrent(iso(r))),
    previous: rows.filter((r) => !inCurrent(iso(r))),
  });
  const o = split(orderRows, (r) => r.paidAt);
  const q = split(quoteRows, (r) => r.issuedAt);
  const r = split(requestRows, (x) => x.createdAt);
  const e = split(expenseRows, (x) => x.date);
  return {
    current: { orders: o.current, quotes: q.current, requests: r.current, expenses: e.current },
    previous: { orders: o.previous, quotes: q.previous, requests: r.previous, expenses: e.previous },
  };
}

export type AgendaEntry = { ref: string; text: string; href: string; note?: string };
export type PanelAgenda = {
  entregas: AgendaEntry[];
  sinTraductor: AgendaEntry[];
  dirigidosSinAceptar: AgendaEntry[];
  caducan: AgendaEntry[];
  preciosSinPresupuesto: AgendaEntry[];
};

const OPEN_STATUSES = ["PAID", "IN_PROGRESS"] as const;
const pedidoHref = (ref: string) => `/zona-traductor/pedido/${ref}`;
const day = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

/** Agenda de HOY (independiente del periodo elegido). */
export async function loadPanelAgenda(now: Date = new Date()): Promise<PanelAgenda> {
  const today = parseYmd(todayMadrid(now))!;
  const from = madridMidnightUtc(today);
  const until = madridMidnightUtc(new Date(today.getTime() + 2 * 864e5));
  const soon = new Date(now.getTime() + 3 * 864e5);

  const archiveEvents = { where: { type: { in: ["order.archived", "order.unarchived"] } }, select: { type: true }, orderBy: { createdAt: "desc" as const }, take: 1 };
  const isArchived = (o: { events: { type: string }[] }) => o.events[0]?.type === "order.archived";

  const [due, unassigned, directed, quotes, requests] = await Promise.all([
    prisma.order.findMany({
      where: { dueDate: { gte: from, lt: until }, status: { in: [...OPEN_STATUSES] }, paymentStatus: "PAID" },
      select: { reference: true, title: true, clientName: true, dueDate: true, events: archiveEvents },
      orderBy: { dueDate: "asc" },
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID", status: { in: [...OPEN_STATUSES] }, assignedTo: null },
      select: { reference: true, title: true, clientName: true, langPair: true, events: archiveEvents },
      orderBy: { paidAt: "asc" },
    }),
    prisma.order.findMany({
      where: { status: { in: [...OPEN_STATUSES] }, events: { some: { type: "lavori.solicitud_enviada" } } },
      select: {
        reference: true,
        title: true,
        clientName: true,
        events: {
          where: { type: { in: ["lavori.solicitud_enviada", "lavori.encargo_aceptado", "lavori.retirado_por_motor"] } },
          select: { type: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.quote.findMany({
      where: { status: { in: ["SENT", "OPENED", "ACCEPTED"] }, deletedAt: null, validUntil: { gte: now, lte: soon } },
      select: { id: true, quoteNumber: true, customerName: true, validUntil: true },
      orderBy: { validUntil: "asc" },
    }),
    prisma.lavoriPriceRequest.findMany({
      where: { status: "PRICED", quoteId: null },
      select: { ref: true, par: true, priceCents: true, customerHint: true },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const who = (o: { clientName: string | null; title: string }) => o.clientName || o.title;
  return {
    entregas: due
      .filter((o) => !isArchived(o))
      .map((o) => ({ ref: o.reference, text: `${o.reference} · ${who(o)}`, href: pedidoHref(o.reference), note: o.dueDate ? day(o.dueDate) : undefined })),
    sinTraductor: unassigned
      .filter((o) => !isCasaPair(o.langPair))
      .map((o) => ({ ref: o.reference, text: `${o.reference} · ${who(o)}`, href: pedidoHref(o.reference), note: isArchived(o) ? "archivado" : o.langPair || undefined })),
    dirigidosSinAceptar: directed
      .filter((o) => o.events[0]?.type === "lavori.solicitud_enviada")
      .map((o) => ({ ref: o.reference, text: `${o.reference} · ${who(o)}`, href: pedidoHref(o.reference) })),
    caducan: quotes.map((q) => ({ ref: q.quoteNumber, text: `${q.quoteNumber} · ${q.customerName}`, href: `/zona-traductor/presupuestos/${q.id}`, note: day(q.validUntil) })),
    preciosSinPresupuesto: requests.map((r) => ({
      ref: r.ref,
      text: `${r.customerHint || r.ref} · ${r.par}`,
      href: `/zona-traductor/presupuesto?lead=${encodeURIComponent(r.ref)}`,
      note: r.priceCents != null ? `${(r.priceCents / 100).toLocaleString("es-ES")} €` : undefined,
    })),
  };
}
