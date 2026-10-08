"use client";

import { useEffect, useMemo, useState } from "react";
import { DIMENSION_LABELS, dimensionsFor, METRIC_KEYS, METRICS, type Metric, type PanelData } from "@/lib/panel-metrics";
import { compareLabel, type Period } from "@/lib/panel-period";
import {
  buildSeries,
  CHART_TYPES,
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  newWidget,
  normalizeWidget,
  parseLayout,
  type Widget,
} from "@/lib/panel-layout";
import { BarsChart, DataTable, DonutChart, KpiCard, LineChart, summaryText } from "./PanelCharts";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60a5fa]";
const BTN = `rounded-lg border border-[#232a35] bg-[#14181f] px-3 py-1.5 text-xs font-semibold text-[#e8ecf2] hover:border-[#93a0b4] disabled:opacity-40 ${FOCUS}`;
const FIELD = `w-full rounded-md border border-[#232a35] bg-[#0b0d10] px-2 py-1.5 text-xs text-[#e8ecf2] ${FOCUS}`;

type Props = { period: Period; current: PanelData; previous: PanelData };

export default function PanelBoard({ period, current, previous }: Props) {
  const [layout, setLayout] = useState<Widget[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = parseLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
      if (saved) setLayout(saved);
    } catch {
      // localStorage no disponible: se queda el layout por defecto
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // sin persistencia: el panel sigue funcionando
    }
  }, [layout, loaded]);

  const update = (id: string, patch: Partial<Widget>) =>
    setLayout((l) => l.map((w) => (w.id === id ? normalizeWidget({ ...w, ...patch }) : w)));
  const move = (i: number, dir: -1 | 1) =>
    setLayout((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (id: string) => setLayout((l) => l.filter((w) => w.id !== id));

  return (
    <section aria-label="Widgets del panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#93a0b4]">Análisis · {period.label}</h2>
        <div className="flex flex-wrap gap-2">
          {editing && (
            <>
              <button type="button" className={BTN} onClick={() => setLayout((l) => [...l, newWidget()])}>
                + Añadir widget
              </button>
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  if (window.confirm("¿Restaurar el panel por defecto? Se pierde tu configuración.")) setLayout(DEFAULT_LAYOUT);
                }}
              >
                Restaurar por defecto
              </button>
            </>
          )}
          <button type="button" className={BTN} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
            {editing ? "Terminar edición" : "Editar panel"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6 xl:grid-cols-12">
        {layout.map((w, i) => (
          <WidgetCard
            key={w.id}
            widget={w}
            index={i}
            count={layout.length}
            editing={editing}
            period={period}
            current={current}
            previous={previous}
            onChange={(patch) => update(w.id, patch)}
            onMove={(dir) => move(i, dir)}
            onRemove={() => remove(w.id)}
          />
        ))}
      </div>
      {layout.length === 0 && <p className="py-10 text-center text-sm text-[#93a0b4]">El panel está vacío. Pulsa «Editar panel» para añadir widgets.</p>}
    </section>
  );
}

function span(w: Widget) {
  if (w.chart === "kpi") return "md:col-span-3 xl:col-span-2";
  return w.wide ? "md:col-span-6 xl:col-span-12" : "md:col-span-3 xl:col-span-6";
}

function WidgetCard(props: {
  widget: Widget;
  index: number;
  count: number;
  editing: boolean;
  period: Period;
  current: PanelData;
  previous: PanelData;
  onChange: (patch: Partial<Widget>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { widget: w, index, count, editing, period, current, previous } = props;
  const [showTable, setShowTable] = useState(false);
  const data = useMemo(() => buildSeries(w, current, previous, period), [w, current, previous, period]);
  const titleId = `w-${w.id}-title`;

  return (
    <article aria-labelledby={titleId} className={`rounded-xl border border-[#232a35] bg-[#14181f] p-4 ${span(w)}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 id={titleId} className="text-sm font-medium text-[#93a0b4]">
          {w.title}
        </h3>
        {w.chart !== "kpi" && w.chart !== "tabla" && (
          <button type="button" className={`${FOCUS} rounded px-1 text-[11px] text-[#93a0b4] underline hover:text-[#e8ecf2]`} aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
            {showTable ? "Ver gráfico" : "Ver tabla"}
          </button>
        )}
      </div>

      {w.chart === "kpi" ? (
        <KpiCard metric={w.metrics[0]} value={data.series[0]?.values[0] ?? 0} compare={data.series[0]?.compare?.[0]} compareText={compareLabel(period)} />
      ) : w.chart === "tabla" || showTable ? (
        <DataTable data={data} caption={w.title} />
      ) : (
        <div role="img" aria-label={summaryText(w.title, data)}>
          {w.chart === "barras" && <BarsChart data={data} />}
          {w.chart === "linea" && <LineChart data={data} />}
          {w.chart === "donut" && <DonutChart data={data} />}
        </div>
      )}

      {editing && <Editor {...props} />}
      {editing && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#232a35] pt-3">
          <button type="button" className={BTN} disabled={index === 0} onClick={() => props.onMove(-1)} aria-label={`Subir «${w.title}»`}>
            ↑ Subir
          </button>
          <button type="button" className={BTN} disabled={index === count - 1} onClick={() => props.onMove(1)} aria-label={`Bajar «${w.title}»`}>
            ↓ Bajar
          </button>
          <button type="button" className={BTN} onClick={props.onRemove} aria-label={`Quitar «${w.title}»`}>
            Quitar
          </button>
        </div>
      )}
    </article>
  );
}

function Editor({ widget: w, onChange }: { widget: Widget; onChange: (patch: Partial<Widget>) => void }) {
  const dims = dimensionsFor(w.metrics);
  const toggleMetric = (m: Metric) => {
    const has = w.metrics.includes(m);
    const next = has ? w.metrics.filter((x) => x !== m) : [...w.metrics, m];
    if (next.length) onChange({ metrics: METRIC_KEYS.filter((k) => next.includes(k)) });
  };
  const id = (s: string) => `${w.id}-${s}`;
  return (
    <div className="mt-3 space-y-3 border-t border-[#232a35] pt-3 text-xs">
      <div>
        <label htmlFor={id("title")} className="mb-1 block text-[#93a0b4]">
          Título
        </label>
        <input id={id("title")} className={FIELD} value={w.title} maxLength={80} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("chart")} className="mb-1 block text-[#93a0b4]">
            Gráfico
          </label>
          <select id={id("chart")} className={FIELD} value={w.chart} onChange={(e) => onChange({ chart: e.target.value as Widget["chart"] })}>
            {CHART_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("dim")} className="mb-1 block text-[#93a0b4]">
            Dimensión
          </label>
          <select id={id("dim")} className={FIELD} value={w.dimension} disabled={w.chart === "kpi"} onChange={(e) => onChange({ dimension: e.target.value as Widget["dimension"] })}>
            {dims.map((d) => (
              <option key={d} value={d}>
                {DIMENSION_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-[#93a0b4]">{w.chart === "kpi" ? "Métrica (la primera marcada)" : "Métricas"}</legend>
        <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {METRIC_KEYS.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" className={`h-3.5 w-3.5 accent-[#3ecf8e] ${FOCUS}`} checked={w.metrics.includes(m)} onChange={() => toggleMetric(m)} />
              {METRICS[m].label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        {w.chart !== "kpi" && w.chart !== "linea" && (
          <div className="w-28">
            <label htmlFor={id("top")} className="mb-1 block text-[#93a0b4]">
              Mostrar los N primeros
            </label>
            <input
              id={id("top")}
              type="number"
              min={1}
              max={50}
              className={FIELD}
              value={w.top ?? ""}
              placeholder="Todos"
              onChange={(e) => onChange({ top: e.target.value ? Math.max(1, Math.min(50, Number(e.target.value))) : undefined })}
            />
          </div>
        )}
        {w.chart !== "kpi" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" className={`h-3.5 w-3.5 accent-[#3ecf8e] ${FOCUS}`} checked={!!w.wide} onChange={(e) => onChange({ wide: e.target.checked })} />
            Ancho completo
          </label>
        )}
      </div>
    </div>
  );
}
