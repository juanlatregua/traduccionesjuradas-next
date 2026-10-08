// «Ver por»: desglose de una métrica del Panel por una dimensión, con el mismo tramo del periodo anterior. Puro.
import { aggregate, formatDelta, type Metric, type PanelData } from "./panel-metrics.ts";
import type { Period } from "./panel-period.ts";
import { SLICERS, type SlicerKey } from "./panel-slicers.ts";

export type BreakdownMetricKey = "cobrado" | "margen" | "pedidos" | "ticket";

export const BREAKDOWN_METRICS: { key: BreakdownMetricKey; metric: Metric; label: string; money: boolean }[] = [
  { key: "cobrado", metric: "ingresos_netos", label: "Cobrado", money: true },
  { key: "margen", metric: "margen_eur", label: "Margen", money: true },
  { key: "pedidos", metric: "pedidos", label: "Pedidos cobrados", money: false },
  { key: "ticket", metric: "ticket_medio", label: "Ticket medio", money: true },
];

/** Quien no es ADMIN solo puede ver recuentos. */
export function parseBreakdown(ver: string | null | undefined, met: string | null | undefined, isAdmin: boolean) {
  const slicer = SLICERS.find((s) => s.key === ver) ?? SLICERS.find((s) => s.key === "par")!;
  const allowed = BREAKDOWN_METRICS.filter((m) => isAdmin || !m.money);
  const metric = allowed.find((m) => m.key === met) ?? allowed[0];
  return { slicer: slicer.key as SlicerKey, dimension: slicer.dimension, metric, allowed };
}

export type BreakdownRow = {
  label: string;
  value: number;
  prev: number | undefined;
  delta: { text: string; sign: -1 | 0 | 1 } | null;
  /** Peso de la fila sobre el máximo (0 a 100), para la barra. */
  share: number;
};

export function buildBreakdown(
  current: PanelData,
  previous: PanelData | undefined,
  opts: { dimension: ReturnType<typeof parseBreakdown>["dimension"]; metric: Metric; period: Period }
): BreakdownRow[] {
  const rows = aggregate(current, { metric: opts.metric, dimension: opts.dimension, period: opts.period, compare: previous });
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  return rows.map((r) => ({
    label: r.label,
    value: r.value,
    prev: previous ? r.compareValue : undefined,
    delta: previous ? formatDelta(opts.metric, r.value, r.compareValue) : null,
    share: (Math.abs(r.value) / max) * 100,
  }));
}
