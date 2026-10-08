// Cabecera de Pedidos: KPIs de recuento y enlaces. Puro (sin Prisma).
import { madridMidnightUtc, parseYmd, periodBounds, todayMadrid, type Period } from "./panel-period.ts";

export type KpiOrder = {
  createdAt: Date | string;
  paymentStatus: string;
  status: string;
  dueDate?: Date | string | null;
  amountCents: number;
};

const OPEN = ["PAID", "IN_PROGRESS"];

/** Cobrado y aún sin entregar al cliente. */
export const isPorEntregar = (o: Pick<KpiOrder, "paymentStatus" | "status">) => o.paymentStatus === "PAID" && OPEN.includes(o.status);
/** Pendiente de pago (incluye el crédito aplazado: su cobro aún no ha llegado). */
export const isPorCobrar = (o: Pick<KpiOrder, "paymentStatus" | "status">) => o.paymentStatus === "PENDING" && o.status !== "CANCELLED";

export function inRange(date: Date | string | null | undefined, from: Date, to: Date): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  return t >= from.getTime() && t < to.getTime();
}

export type PedidosKpis = {
  nuevos: { value: number; prev: number | undefined };
  porEntregar: { count: number; vencenPronto: number; vencidos: number };
  porCobrar: { count: number; cents: number };
};

/** `orders` ya sin archivados. `period` null = todo el histórico (sin comparación). */
export function computePedidosKpis(orders: KpiOrder[], period: Period | null, now: Date = new Date()): PedidosKpis {
  let value = orders.length;
  let prev: number | undefined;
  if (period) {
    const b = periodBounds(period);
    value = orders.filter((o) => inRange(o.createdAt, b.from, b.to)).length;
    prev = orders.filter((o) => inRange(o.createdAt, b.prevFrom, b.prevTo)).length;
  }
  const today = parseYmd(todayMadrid(now))!;
  const startToday = madridMidnightUtc(today).getTime();
  const afterTomorrow = madridMidnightUtc(new Date(today.getTime() + 2 * 864e5)).getTime();
  const open = orders.filter(isPorEntregar);
  const due = (o: KpiOrder) => (o.dueDate ? new Date(o.dueDate).getTime() : null);
  const pending = orders.filter(isPorCobrar);
  return {
    nuevos: { value, prev },
    porEntregar: {
      count: open.length,
      vencenPronto: open.filter((o) => {
        const t = due(o);
        return t !== null && t >= startToday && t < afterTomorrow;
      }).length,
      vencidos: open.filter((o) => {
        const t = due(o);
        return t !== null && t < startToday;
      }).length,
    },
    porCobrar: { count: pending.length, cents: pending.reduce((a, o) => a + o.amountCents, 0) },
  };
}

export type PedidosLink = { p?: string; d?: string; base?: string; filtro?: string; q?: string; vista?: string };

/** URL de /zona-traductor con solo los parámetros que no son el valor por defecto. */
export function pedidosHref(l: PedidosLink): string {
  const sp = new URLSearchParams();
  if (l.p && l.p !== "mes") sp.set("p", l.p);
  if (l.d && l.p !== "todo") sp.set("d", l.d);
  if (l.base === "paid") sp.set("base", "paid");
  if (l.filtro && l.filtro !== "todos") sp.set("filtro", l.filtro);
  if (l.q) sp.set("q", l.q);
  if (l.vista) sp.set("vista", l.vista);
  const qs = sp.toString();
  return qs ? `/zona-traductor?${qs}` : "/zona-traductor";
}
