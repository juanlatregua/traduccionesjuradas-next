// Widgets del Panel: forma, valores por defecto, validación del layout guardado y series para pintar. Puro.
import { aggregate, dimensionsFor, METRICS, METRIC_KEYS, DIMENSION_KEYS, type Dimension, type Metric, type PanelData } from "./panel-metrics.ts";
import type { Period } from "./panel-period.ts";

export type ChartType = "kpi" | "barras" | "linea" | "tabla" | "donut";
export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "kpi", label: "Cifra (KPI)" },
  { value: "barras", label: "Barras" },
  { value: "linea", label: "Línea" },
  { value: "tabla", label: "Tabla" },
  { value: "donut", label: "Donut" },
];

export type Widget = {
  id: string;
  title: string;
  metrics: Metric[];
  dimension: Dimension;
  chart: ChartType;
  top?: number;
  wide?: boolean;
};

export const LAYOUT_STORAGE_KEY = "tj-panel-layout-v1";

const kpi = (id: string, title: string, metric: Metric): Widget => ({ id, title, metrics: [metric], dimension: "total", chart: "kpi" });

export const DEFAULT_LAYOUT: Widget[] = [
  kpi("kpi-netos", "Ingresos netos", "ingresos_netos"),
  kpi("kpi-coste", "Coste traductores", "coste_traductores"),
  kpi("kpi-margen", "Margen", "margen_pct"),
  kpi("kpi-pedidos", "Pedidos", "pedidos"),
  kpi("kpi-conversion", "Conversión de presupuestos", "conversion_pct"),
  kpi("kpi-bizum", "De ellos, Bizum", "bizum_eur"),
  { id: "linea-tiempo", title: "Ingresos netos y coste en el tiempo", metrics: ["ingresos_netos", "coste_traductores"], dimension: "tiempo", chart: "linea", wide: true },
  { id: "barras-margen-lengua", title: "Margen por lengua de origen", metrics: ["margen_eur"], dimension: "lengua_origen", chart: "barras" },
  { id: "donut-via-pago", title: "Ingresos por vía de pago", metrics: ["ingresos_netos"], dimension: "via_pago", chart: "donut" },
  { id: "tabla-traductor", title: "Por traductor", metrics: ["pedidos", "coste_traductores", "margen_eur"], dimension: "traductor", chart: "tabla", wide: true },
  { id: "barras-embudo", title: "Embudo de presupuestos", metrics: ["presupuestos_enviados", "presupuestos_pagados", "presupuestos_perdidos"], dimension: "total", chart: "barras" },
  { id: "barras-gastos", title: "Gastos por categoría", metrics: ["gastos"], dimension: "categoria_gasto", chart: "barras" },
];

export function newWidget(): Widget {
  return { id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: "Nuevo widget", metrics: ["ingresos_netos"], dimension: "tiempo", chart: "barras" };
}

/** Ajusta la dimensión si la combinación métrica/dimensión no existe, y el gráfico si no cuadra. */
export function normalizeWidget(w: Widget): Widget {
  const metrics: Metric[] = w.metrics.length ? w.metrics : ["ingresos_netos"];
  const dimension = w.chart !== "kpi" && dimensionsFor(metrics).includes(w.dimension) ? w.dimension : "total";
  return { ...w, metrics, dimension };
}

export function parseLayout(raw: string | null): Widget[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const out: Widget[] = [];
    for (const w of arr) {
      if (!w || typeof w.id !== "string" || typeof w.title !== "string") return null;
      if (!Array.isArray(w.metrics) || !w.metrics.length || !w.metrics.every((m: string) => (METRIC_KEYS as string[]).includes(m))) return null;
      if (!(DIMENSION_KEYS as string[]).includes(w.dimension)) return null;
      if (!CHART_TYPES.some((c) => c.value === w.chart)) return null;
      out.push(
        normalizeWidget({
          id: w.id,
          title: w.title.slice(0, 80),
          metrics: w.metrics,
          dimension: w.dimension,
          chart: w.chart,
          ...(typeof w.top === "number" && w.top > 0 ? { top: Math.min(50, Math.floor(w.top)) } : {}),
          ...(w.wide ? { wide: true } : {}),
        })
      );
    }
    return out;
  } catch {
    return null;
  }
}

export type SeriesData = { labels: string[]; series: { metric: Metric; name: string; values: number[]; compare?: number[] }[] };

/** Etiquetas + una serie por métrica. Con dimensión «total» y varias métricas, cada métrica es una barra (embudo). */
export function buildSeries(w: Widget, current: PanelData, previous: PanelData, period: Period): SeriesData {
  const base = (metric: Metric, top?: number) => aggregate(current, { metric, dimension: w.dimension, period, compare: previous, top });
  if (w.dimension === "total" && w.metrics.length > 1) {
    const rows = w.metrics.map((m) => base(m)[0]);
    return {
      labels: w.metrics.map((m) => METRICS[m].label),
      series: [{ metric: w.metrics[0], name: "Valor", values: rows.map((r) => r?.value ?? 0), compare: rows.map((r) => r?.compareValue ?? 0) }],
    };
  }
  const first = base(w.metrics[0], w.chart === "linea" ? undefined : w.top);
  const labels = first.map((r) => r.label);
  return {
    labels,
    series: w.metrics.map((m, i) => {
      const rows = i === 0 ? first : base(m);
      const byLabel = new Map(rows.map((r) => [r.label, r]));
      return {
        metric: m,
        name: METRICS[m].label,
        values: labels.map((l) => byLabel.get(l)?.value ?? 0),
        compare: labels.map((l) => byLabel.get(l)?.compareValue ?? 0),
      };
    }),
  };
}
