// lib/bizum-ledger.ts — Apartado BIZUM, fuera de la contabilidad general.
//
// Regla de Juan (21-ago-2026 «si es por Bizum que no haya factura»; 27-ago-2026
// «todo lo que va en Bizum no debe aparecer en la contabilidad: una parte aparte
// con su relación de pedidos»). Un pedido está EN LIBROS solo si no está
// apartado (billingExcluded) y no es Bizum — o si ya tiene factura EMITIDA (una
// factura emitida no se borra: 26_F08934 / 26_023). Todo lo demás vive aquí.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Pedidos que cuentan en la contabilidad general (libro, banco, periodos). */
export function inBooksOrderWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { billingExcluded: false, NOT: { paymentMethod: "BIZUM" } },
      { clientInvoice: { is: { status: "ISSUED" } } },
    ],
  };
}

/** Misma regla que inBooksOrderWhere, sobre un pedido ya cargado (portada, estadísticas). */
export function isOrderInBooks(o: {
  paymentMethod?: string | null;
  billingExcluded?: boolean | null;
  clientInvoice?: { status?: string | null } | null;
}): boolean {
  if (o.clientInvoice?.status === "ISSUED") return true;
  return !o.billingExcluded && String(o.paymentMethod || "").toUpperCase() !== "BIZUM";
}

/** Pedidos fuera de libros: Bizum sin factura emitida + apartados a mano. */
export function outOfBooksOrderWhere(): Prisma.OrderWhereInput {
  return {
    AND: [
      { OR: [{ billingExcluded: true }, { paymentMethod: "BIZUM" }] },
      { OR: [{ clientInvoice: { is: null } }, { clientInvoice: { isNot: { status: "ISSUED" } } }] },
    ],
  };
}

export type BizumRow = {
  reference: string;
  clientName: string | null;
  clientEmail: string;
  title: string | null;
  langPair: string | null;
  amountCents: number;
  paidAt: string | null;
  paymentStatus: string;
  deliveryState: string;
  quoteNumber: string | null;
  invoiceNumber: string | null; // emitida ⇒ también está en contabilidad
  excludedReason: string | null;
  year: number;
  quarter: number;
};

export type BizumGroup = { year: number; quarter: number; label: string; rows: BizumRow[]; totalCents: number };

function madridYQ(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "numeric" }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, quarter: Math.ceil(month / 3) };
}

export async function listBizumLedger(): Promise<{
  groups: BizumGroup[];
  totalCents: number;
  count: number;
  byYear: { year: number; totalCents: number; count: number }[];
  otherExcluded: BizumRow[];
}> {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: { in: ["PAID", "REFUNDED"] },
      OR: [{ paymentMethod: "BIZUM" }, { paymentEvents: { some: { provider: "BIZUM" } } }, { billingExcluded: true }],
    },
    select: {
      reference: true,
      clientName: true,
      clientEmail: true,
      title: true,
      langPair: true,
      amountCents: true,
      paidAt: true,
      createdAt: true,
      paymentStatus: true,
      paymentMethod: true,
      deliveryState: true,
      billingExcluded: true,
      billingExcludedReason: true,
      quote: { select: { quoteNumber: true } },
      clientInvoice: { select: { status: true, number: true } },
      paymentEvents: { select: { provider: true }, take: 5 },
    },
    orderBy: { paidAt: "desc" },
    take: 2000,
  });

  const toRow = (o: (typeof orders)[number]): BizumRow => {
    const d = o.paidAt ?? o.createdAt;
    const { year, quarter } = madridYQ(d);
    return {
      reference: o.reference,
      clientName: o.clientName,
      clientEmail: o.clientEmail,
      title: o.title,
      langPair: o.langPair,
      amountCents: o.amountCents,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      paymentStatus: o.paymentStatus,
      deliveryState: o.deliveryState,
      quoteNumber: o.quote?.quoteNumber ?? null,
      invoiceNumber: o.clientInvoice?.status === "ISSUED" ? o.clientInvoice.number : null,
      excludedReason: o.billingExcluded ? o.billingExcludedReason : null,
      year,
      quarter,
    };
  };

  const isBizum = (o: (typeof orders)[number]) => o.paymentMethod === "BIZUM" || o.paymentEvents.some((e) => e.provider === "BIZUM");
  const bizum = orders.filter(isBizum).map(toRow);
  const otherExcluded = orders.filter((o) => !isBizum(o) && o.billingExcluded).map(toRow);

  const groupsMap = new Map<string, BizumGroup>();
  for (const r of bizum) {
    const key = `${r.year}-T${r.quarter}`;
    let g = groupsMap.get(key);
    if (!g) {
      g = { year: r.year, quarter: r.quarter, label: `${r.year} · T${r.quarter}`, rows: [], totalCents: 0 };
      groupsMap.set(key, g);
    }
    g.rows.push(r);
    if (r.paymentStatus === "PAID") g.totalCents += r.amountCents;
  }
  const groups = [...groupsMap.values()].sort((a, b) => b.year - a.year || b.quarter - a.quarter);
  const byYearMap = new Map<number, { year: number; totalCents: number; count: number }>();
  for (const g of groups) {
    const y = byYearMap.get(g.year) || { year: g.year, totalCents: 0, count: 0 };
    y.totalCents += g.totalCents;
    y.count += g.rows.filter((r) => r.paymentStatus === "PAID").length;
    byYearMap.set(g.year, y);
  }
  const paid = bizum.filter((r) => r.paymentStatus === "PAID");
  return {
    groups,
    totalCents: paid.reduce((a, r) => a + r.amountCents, 0),
    count: paid.length,
    byYear: [...byYearMap.values()].sort((a, b) => b.year - a.year),
    otherExcluded,
  };
}
