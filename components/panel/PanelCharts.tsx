"use client";

import { formatDelta, formatValue, METRICS, type Metric } from "@/lib/panel-metrics";
import type { SeriesData } from "@/lib/panel-layout";

export const SERIES_COLORS = ["#3ecf8e", "#2dd4bf", "#60a5fa", "#a78bfa", "#fbbf24"];
const NEGATIVE = "#f87171";
const MUTED = "#93a0b4";
const GRID = "#232a35";

const color = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length];
const fmtAt = (data: SeriesData, si: number, v: number) => formatValue(data.series[si].metric, v);

export function summaryText(title: string, data: SeriesData): string {
  const parts = data.labels.slice(0, 12).map((l, i) => `${l}: ${data.series.map((s, si) => `${fmtAt(data, si, s.values[i])}`).join(" / ")}`);
  const more = data.labels.length > 12 ? ` y ${data.labels.length - 12} más` : "";
  return `${title}. ${data.series.map((s) => s.name).join(", ")}. ${parts.join("; ")}${more}.`;
}

export function Legend({ data }: { data: SeriesData }) {
  if (data.series.length < 2) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#93a0b4]">
      {data.series.map((s, i) => (
        <li key={s.metric} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color(i) }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

export function KpiCard({ metric, value, compare }: { metric: Metric; value: number; compare?: number }) {
  const delta = formatDelta(metric, value, compare);
  const neutral = METRICS[metric].costLike;
  const deltaColor = !delta || delta.sign === 0 || neutral ? MUTED : delta.sign > 0 ? "#3ecf8e" : NEGATIVE;
  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums" style={value < 0 ? { color: NEGATIVE } : undefined}>
        {formatValue(metric, value)}
      </p>
      <p className="mt-1 text-xs tabular-nums" style={{ color: deltaColor }}>
        {delta ? `${delta.sign > 0 ? "▲" : delta.sign < 0 ? "▼" : "■"} ${delta.text} vs periodo anterior` : <span className="text-[#93a0b4]">Sin base de comparación</span>}
      </p>
    </div>
  );
}

export function BarsChart({ data }: { data: SeriesData }) {
  if (data.labels.length === 0) return <Empty />;
  const max = Math.max(1e-9, ...data.series.flatMap((s) => s.values.map((v) => Math.abs(v))));
  return (
    <div>
      <ul className="space-y-2" aria-hidden>
        {data.labels.map((label, i) => (
          <li key={label} className="grid grid-cols-[minmax(5rem,9rem)_1fr] items-center gap-3 text-xs">
            <span className="truncate text-[#93a0b4]" title={label}>
              {label}
            </span>
            <div className="space-y-1">
              {data.series.map((s, si) => {
                const v = s.values[i];
                return (
                  <div key={s.metric} className="flex items-center gap-2">
                    <div className="h-3 flex-1 rounded-sm bg-[#0b0d10]">
                      <div className="h-3 rounded-sm" style={{ width: `${(Math.abs(v) / max) * 100}%`, background: v < 0 ? NEGATIVE : color(si) }} />
                    </div>
                    <span className="w-24 shrink-0 text-right tabular-nums" style={v < 0 ? { color: NEGATIVE } : undefined}>
                      {fmtAt(data, si, v)}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <Legend data={data} />
    </div>
  );
}

export function LineChart({ data }: { data: SeriesData }) {
  const n = data.labels.length;
  if (n === 0) return <Empty />;
  const W = 640;
  const H = 240;
  const L = 64;
  const R = 12;
  const T = 12;
  const B = 28;
  const all = data.series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all);
  const hi = Math.max(1e-9, ...all);
  const x = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo || 1);
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);
  const step = Math.ceil(n / 8);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED} className="tabular-nums">
              {formatValue(data.series[0].metric, t)}
            </text>
          </g>
        ))}
        {data.labels.map((l, i) =>
          i % step === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={MUTED}>
              {l}
            </text>
          ) : null
        )}
        {data.series.map((s, si) => (
          <g key={s.metric}>
            {n > 1 && <polyline fill="none" stroke={color(si)} strokeWidth="2" strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />}
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={n > 40 ? 1.5 : 3} fill={v < 0 ? NEGATIVE : color(si)}>
                <title>{`${s.name} · ${data.labels[i]}: ${fmtAt(data, si, v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <Legend data={data} />
    </div>
  );
}

export function DonutChart({ data }: { data: SeriesData }) {
  const items = data.labels.map((label, i) => ({ label, value: data.series[0].values[i] })).filter((d) => d.value > 0);
  const total = items.reduce((a, d) => a + d.value, 0);
  if (total === 0) return <Empty />;
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" aria-hidden>
        {items.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={color(i)} strokeWidth="22" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc}>
              <title>{`${d.label}: ${fmtAt(data, 0, d.value)}`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs" aria-hidden>
        {items.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(i) }} />
            <span className="min-w-0 flex-1 truncate text-[#93a0b4]">{d.label}</span>
            <span className="tabular-nums">{fmtAt(data, 0, d.value)}</span>
            <span className="w-12 text-right tabular-nums text-[#93a0b4]">{Math.round((d.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DataTable({ data, caption }: { data: SeriesData; caption: string }) {
  if (data.labels.length === 0) return <Empty />;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-[#14181f] text-[#93a0b4]">
          <tr>
            <th scope="col" className="py-1.5 pr-3 font-medium" />
            {data.series.map((s) => (
              <th key={s.metric} scope="col" className="px-2 py-1.5 text-right font-medium">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.labels.map((l, i) => (
            <tr key={l} className="border-t border-[#232a35]">
              <th scope="row" className="max-w-[12rem] truncate py-1.5 pr-3 font-normal">
                {l}
              </th>
              {data.series.map((s, si) => (
                <td key={s.metric} className="px-2 py-1.5 text-right tabular-nums" style={s.values[i] < 0 ? { color: NEGATIVE } : undefined}>
                  {fmtAt(data, si, s.values[i])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-xs text-[#93a0b4]">Sin datos en este periodo.</p>;
}
