// Agregación pura del Panel analítico (server + client safe, sin Prisma).
import { isCasaPair } from "./lavori-bridge.ts";
import { bucketKey, type Period } from "./panel-period.ts";

export const VAT_DIVISOR = 1.21;
export const OWN_LABEL = "Juan (propio)";

export type OrderRow = {
  paidAt: string;
  amountCents: number;
  invoiceBaseCents: number | null;
  supplierCostCents: number | null;
  langPair: string | null;
  assignedTo: string | null;
  client: string;
  paymentMethod: string | null;
  /** Canal de entrada: "WHATSAPP" | "WEB" (opcional: sin dato cuenta como Web). */
  channel?: string;
};
export type QuoteRow = {
  id: string;
  issuedAt: string;
  status: string;
  total: number;
  sourceLang: string;
  targetLang: string;
  lostReason: string | null;
};
export type RequestRow = { ref: string; createdAt: string; status: string; par: string; priceCents: number | null; createdBy: string | null };
export type ExpenseRow = { date: string; baseCents: number; category: string | null; supplier: string | null };

export type PanelData = { orders: OrderRow[]; quotes: QuoteRow[]; requests: RequestRow[]; expenses: ExpenseRow[] };
export const EMPTY_DATA: PanelData = { orders: [], quotes: [], requests: [], expenses: [] };

export type Metric =
  | "ingresos_brutos"
  | "ingresos_netos"
  | "coste_traductores"
  | "margen_eur"
  | "margen_pct"
  | "pedidos"
  | "ticket_medio"
  | "bizum_eur"
  | "presupuestos_enviados"
  | "presupuestos_pagados"
  | "presupuestos_perdidos"
  | "conversion_pct"
  | "solicitudes_lavori"
  | "gastos"
  | "resultado";

export type Dimension = "total" | "tiempo" | "lengua_origen" | "par" | "traductor" | "cliente" | "canal" | "via_pago" | "categoria_gasto";

type Source = "orders" | "quotes" | "requests" | "expenses";
type Unit = "eur" | "pct" | "count";

export const METRICS: Record<Metric, { label: string; unit: Unit; sources: Source[]; costLike?: boolean }> = {
  ingresos_brutos: { label: "Ingresos brutos (con IVA)", unit: "eur", sources: ["orders"] },
  ingresos_netos: { label: "Ingresos netos", unit: "eur", sources: ["orders"] },
  coste_traductores: { label: "Coste traductores", unit: "eur", sources: ["orders"], costLike: true },
  margen_eur: { label: "Margen (€)", unit: "eur", sources: ["orders"] },
  margen_pct: { label: "Margen (%)", unit: "pct", sources: ["orders"] },
  pedidos: { label: "Pedidos", unit: "count", sources: ["orders"] },
  ticket_medio: { label: "Ticket medio (neto)", unit: "eur", sources: ["orders"] },
  bizum_eur: { label: "De ellos, Bizum (neto)", unit: "eur", sources: ["orders"] },
  presupuestos_enviados: { label: "Presupuestos enviados", unit: "count", sources: ["quotes"] },
  presupuestos_pagados: { label: "Presupuestos pagados", unit: "count", sources: ["quotes"] },
  presupuestos_perdidos: { label: "Presupuestos perdidos", unit: "count", sources: ["quotes"], costLike: true },
  conversion_pct: { label: "Conversión (%)", unit: "pct", sources: ["quotes"] },
  solicitudes_lavori: { label: "Solicitudes a Lavori", unit: "count", sources: ["requests"] },
  gastos: { label: "Gastos", unit: "eur", sources: ["expenses"], costLike: true },
  resultado: { label: "Resultado", unit: "eur", sources: ["orders", "expenses"] },
};
export const METRIC_KEYS = Object.keys(METRICS) as Metric[];

const DIMENSION_SOURCES: Record<Dimension, Source[]> = {
  total: ["orders", "quotes", "requests", "expenses"],
  tiempo: ["orders", "quotes", "requests", "expenses"],
  lengua_origen: ["orders", "quotes"],
  par: ["orders", "quotes", "requests"],
  traductor: ["orders"],
  cliente: ["orders"],
  canal: ["orders"],
  via_pago: ["orders"],
  categoria_gasto: ["expenses"],
};
export const DIMENSION_LABELS: Record<Dimension, string> = {
  total: "Total",
  tiempo: "Tiempo",
  lengua_origen: "Lengua de origen",
  par: "Par de idiomas",
  traductor: "Traductor",
  cliente: "Cliente",
  canal: "Canal de entrada",
  via_pago: "Vía de pago",
  categoria_gasto: "Categoría de gasto",
};
export const DIMENSION_KEYS = Object.keys(DIMENSION_LABELS) as Dimension[];

/** Dimensiones que sirven a TODAS las métricas dadas (las fuentes de cada métrica deben soportarlas). */
export function dimensionsFor(metrics: Metric[]): Dimension[] {
  return DIMENSION_KEYS.filter((dim) =>
    metrics.every((m) => METRICS[m].sources.every((s) => DIMENSION_SOURCES[dim].includes(s)))
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  BIZUM: "Bizum",
  STRIPE: "Tarjeta (Stripe)",
  REDSYS: "Tarjeta (Redsys)",
  PAYPAL: "PayPal",
  TRANSFER: "Transferencia",
};

export function paymentLabel(method: string | null | undefined): string {
  return method ? PAYMENT_LABELS[method] ?? method : "Sin método";
}
export function channelLabel(channel: string | null | undefined): string {
  return channel === "WHATSAPP" ? "WhatsApp" : "Web";
}

export function isTestTitle(title: string | null | undefined): boolean {
  return /\b(prueba|test)\b/i.test(title || "");
}

export function netCents(o: OrderRow): number {
  return o.invoiceBaseCents != null && o.invoiceBaseCents > 0 ? o.invoiceBaseCents : Math.round(o.amountCents / VAT_DIVISOR);
}
export function costCents(o: OrderRow): number {
  return o.supplierCostCents ?? 0;
}

function splitPair(pair: string | null | undefined): [string, string] | null {
  const [from, to] = String(pair || "").trim().toUpperCase().split(/\s*(?:->|→|>|-)\s*/);
  return from && to ? [from, to] : null;
}
export function pairLabel(pair: string | null | undefined): string {
  const p = splitPair(pair);
  return p ? `${p[0]}→${p[1]}` : "Sin par";
}
export function originLabel(pair: string | null | undefined): string {
  return splitPair(pair)?.[0] ?? "Sin par";
}

export function translatorLabel(o: Pick<OrderRow, "assignedTo" | "langPair">): string {
  const who = o.assignedTo?.trim();
  if (who) return who;
  return isCasaPair(o.langPair) ? OWN_LABEL : "Sin asignar";
}

const SENT_STATUSES = ["SENT", "OPENED", "ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED"];
const PAID_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED"];
const isPaidQuote = (q: QuoteRow) => PAID_STATUSES.includes(q.status);
const isLostQuote = (q: QuoteRow) => SENT_STATUSES.includes(q.status) && !isPaidQuote(q) && (q.status === "EXPIRED" || !!q.lostReason);

// «colaborador» ya está en el coste del traductor (supplierCostCents): restarlo otra vez en resultado lo contaría dos veces.
const isCollaboratorExpense = (e: ExpenseRow) => (e.category || "").trim().toLowerCase() === "colaborador";

type Group = PanelData;
const eur = (cents: number) => Math.round(cents) / 100;
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

function computeMetric(metric: Metric, g: Group): number {
  const net = () => sum(g.orders, netCents);
  const cost = () => sum(g.orders, costCents);
  switch (metric) {
    case "ingresos_brutos":
      return eur(sum(g.orders, (o) => o.amountCents));
    case "ingresos_netos":
      return eur(net());
    case "coste_traductores":
      return eur(cost());
    case "margen_eur":
      return eur(net() - cost());
    case "margen_pct": {
      const n = net();
      return n === 0 ? 0 : Math.round(((n - cost()) / n) * 1000) / 10;
    }
    case "pedidos":
      return g.orders.length;
    case "ticket_medio":
      return g.orders.length === 0 ? 0 : eur(net() / g.orders.length);
    case "bizum_eur":
      return eur(sum(g.orders.filter((o) => o.paymentMethod === "BIZUM"), netCents));
    case "presupuestos_enviados":
      return g.quotes.filter((q) => SENT_STATUSES.includes(q.status)).length;
    case "presupuestos_pagados":
      return g.quotes.filter(isPaidQuote).length;
    case "presupuestos_perdidos":
      return g.quotes.filter(isLostQuote).length;
    case "conversion_pct": {
      const won = g.quotes.filter(isPaidQuote).length;
      const lost = g.quotes.filter(isLostQuote).length;
      return won + lost === 0 ? 0 : Math.round((won / (won + lost)) * 1000) / 10;
    }
    case "solicitudes_lavori":
      return g.requests.length;
    case "gastos":
      return eur(sum(g.expenses, (e) => e.baseCents));
    case "resultado":
      return eur(net() - cost() - sum(g.expenses.filter((e) => !isCollaboratorExpense(e)), (e) => e.baseCents));
  }
}

export function computeTotals(data: PanelData, metric: Metric): number {
  return computeMetric(metric, data);
}

type KeyFn<T> = (row: T) => string;

function keyFns(dimension: Dimension, period: Period) {
  const p = period.p;
  switch (dimension) {
    case "total":
      return { orders: () => "Total", quotes: () => "Total", requests: () => "Total", expenses: () => "Total" };
    case "tiempo":
      return {
        orders: (o: OrderRow) => bucketKey(p, o.paidAt),
        quotes: (q: QuoteRow) => bucketKey(p, q.issuedAt),
        requests: (r: RequestRow) => bucketKey(p, r.createdAt),
        expenses: (e: ExpenseRow) => bucketKey(p, e.date),
      };
    case "lengua_origen":
      return { orders: (o: OrderRow) => originLabel(o.langPair), quotes: (q: QuoteRow) => q.sourceLang.toUpperCase() };
    case "par":
      return {
        orders: (o: OrderRow) => pairLabel(o.langPair),
        quotes: (q: QuoteRow) => pairLabel(`${q.sourceLang}>${q.targetLang}`),
        requests: (r: RequestRow) => pairLabel(r.par),
      };
    case "traductor":
      return { orders: translatorLabel };
    case "cliente":
      return { orders: (o: OrderRow) => o.client };
    case "canal":
      return { orders: (o: OrderRow) => channelLabel(o.channel) };
    case "via_pago":
      return { orders: (o: OrderRow) => paymentLabel(o.paymentMethod) };
    case "categoria_gasto":
      return { expenses: (e: ExpenseRow) => e.category?.trim() || "Sin categoría" };
  }
}

function groupData(data: PanelData, dimension: Dimension, period: Period, metrics: Metric[]): Map<string, Group> {
  const fns = keyFns(dimension, period) as { [K in Source]?: KeyFn<any> };
  const needed = new Set<Source>(metrics.flatMap((m) => METRICS[m].sources));
  const groups = new Map<string, Group>();
  for (const src of ["orders", "quotes", "requests", "expenses"] as Source[]) {
    const fn = fns[src];
    if (!fn || !needed.has(src)) continue;
    for (const row of data[src] as unknown[]) {
      const key = fn(row);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { orders: [], quotes: [], requests: [], expenses: [] }));
      (g[src] as unknown[]).push(row);
    }
  }
  return groups;
}

export type AggRow = { label: string; value: number; compareValue?: number };

/** Una métrica sobre una dimensión; con `compare` (datos del periodo anterior) rellena compareValue. */
export function aggregate(
  data: PanelData,
  opts: { metric: Metric; dimension: Dimension; period: Period; compare?: PanelData; top?: number }
): AggRow[] {
  const { metric, dimension, period, compare, top } = opts;
  if (!dimensionsFor([metric]).includes(dimension)) return [];
  const cur = groupData(data, dimension, period, [metric]);
  const prev = compare ? groupData(compare, dimension, period, [metric]) : null;
  const empty: Group = EMPTY_DATA;
  const value = (m: Map<string, Group>, key: string) => computeMetric(metric, m.get(key) ?? empty);

  if (dimension === "tiempo") {
    return period.buckets.map((b, i) => ({
      label: b.label,
      value: value(cur, b.key),
      ...(prev ? { compareValue: value(prev, period.prevBuckets[i]?.key ?? "") } : {}),
    }));
  }
  if (dimension === "total") {
    return [{ label: "Total", value: value(cur, "Total"), ...(prev ? { compareValue: value(prev, "Total") } : {}) }];
  }
  const rows = [...cur.keys()].map((label) => ({
    label,
    value: value(cur, label),
    ...(prev ? { compareValue: value(prev, label) } : {}),
  }));
  rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
  return top ? rows.slice(0, top) : rows;
}

export function formatValue(metric: Metric, value: number): string {
  const { unit } = METRICS[metric];
  if (unit === "eur") return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  if (unit === "pct") return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value)} %`;
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
}

/** Variación frente al periodo anterior: % para euros y recuentos, puntos para porcentajes. null si no hay base. */
export function formatDelta(metric: Metric, value: number, compare: number | undefined): { text: string; sign: -1 | 0 | 1 } | null {
  if (compare === undefined) return null;
  const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
  if (METRICS[metric].unit === "pct") {
    const d = Math.round((value - compare) * 10) / 10;
    return { text: `${nf.format(d)} pp`, sign: Math.sign(d) as -1 | 0 | 1 };
  }
  if (compare === 0) return value === 0 ? { text: "0 %", sign: 0 } : null;
  const d = Math.round(((value - compare) / Math.abs(compare)) * 1000) / 10;
  return { text: `${nf.format(d)} %`, sign: Math.sign(d) as -1 | 0 | 1 };
}
