import Link from "next/link";
import { formatDelta, formatValue, type Metric } from "@/lib/panel-metrics";
import { compareLabel, PEDIDOS_PERIODS, shiftAnchor, todayMadrid, type Granularity, type Period, type PedidosP } from "@/lib/panel-period";
import { pedidosHref, type PedidosKpis } from "@/lib/pedidos-kpis";
import type { SeriesData } from "@/lib/panel-layout";
import { MiniBars } from "@/components/panel/PanelCharts";
import { SLICERS, type SlicerKey, type SlicerOption, type Slicers } from "@/lib/panel-slicers";
import { BREAKDOWN_METRICS, type BreakdownMetricKey, type BreakdownRow } from "@/lib/pedidos-breakdown";
import BreakdownTable, { type BreakdownView } from "./BreakdownTable";
import PedidosSlicers from "./PedidosSlicers";

export type PedidosMoney = {
  cobrado: { value: number; prev: number | undefined };
  margenEur: { value: number; prev: number | undefined };
  margenPct: number;
  chart: SeriesData | null;
};

export type PedidosBreakdown = {
  slicer: SlicerKey;
  metric: BreakdownMetricKey;
  /** Métricas que puede elegir quien mira (un PM solo recuentos). */
  allowed: BreakdownMetricKey[];
  rows: BreakdownRow[];
  hasCompare: boolean;
};

export type PedidosAlerts = { pagosProveedor: number; lotes: number; margen: number; riesgo: number };

type Props = {
  p: PedidosP;
  period: Period | null;
  /** `p` viene de la URL: la tabla filtra por periodo. Si no, el periodo solo rige las cifras de la cabecera. */
  explicit: boolean;
  dateBase: "created" | "paid";
  filtro: string;
  q: string;
  vista?: string;
  kpis: PedidosKpis;
  alerts: PedidosAlerts;
  /** null = quien mira no es ADMIN: no hay cifras de dinero. */
  money: PedidosMoney | null;
  slicers: Slicers;
  slicerOpts: Record<SlicerKey, SlicerOption[]>;
  breakdown: PedidosBreakdown;
};

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400";
const CTRL = `rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-400 ${FOCUS}`;
const eur = (cents: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

function Delta({ label, metric, value, prev }: { label: string; metric: Metric; value: number; prev: number | undefined }) {
  const d = formatDelta(metric, value, prev);
  if (!d) return <p className="mt-1 text-xs text-slate-500">Sin base de comparación</p>;
  const tone = d.sign > 0 ? "text-emerald-400" : d.sign < 0 ? "text-red-400" : "text-slate-400";
  return (
    <p className={`mt-1 text-xs tabular-nums ${tone}`}>
      {d.sign > 0 ? "▲" : d.sign < 0 ? "▼" : "■"} {d.text} <span className="text-slate-500">{label}</span>
    </p>
  );
}

function Kpi({
  href,
  active,
  label,
  value,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`min-w-0 rounded-2xl border p-4 transition-colors ${FOCUS} ${
        active ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tabular-nums text-white">{value}</p>
      {children}
    </Link>
  );
}

export default function PedidosHeader({ p, explicit, period, dateBase, filtro, q, vista, kpis, alerts, money, slicers, slicerOpts, breakdown }: Props) {
  const cmp = compareLabel(period);
  const anchor = period?.anchor ?? todayMadrid();
  const link = (o: Parameters<typeof pedidosHref>[0]) => pedidosHref({ ...(explicit ? { p, d: anchor } : {}), base: dateBase, vista, filtro, q, f: slicers, ver: breakdown.slicer, met: breakdown.metric, ...o });
  // Los KPIs de «ahora» (por entregar, por cobrar) y las alertas ignoran el periodo: llevan a «Todo» para que la tabla cuadre.
  const stock = (f: string) => link({ p: "todo", base: "created", filtro: f, q: "" });
  const cobradoHref = link({ p, d: anchor, filtro: "cobrados", base: "paid", q: "" });
  const chips = [
    { n: alerts.pagosProveedor, text: `${alerts.pagosProveedor} pago${alerts.pagosProveedor === 1 ? "" : "s"} a traductores pendiente${alerts.pagosProveedor === 1 ? "" : "s"}`, f: "pago-proveedor-pendiente", tone: "rose" },
    { n: alerts.lotes, text: `${alerts.lotes} lote${alerts.lotes === 1 ? "" : "s"} vencido${alerts.lotes === 1 ? "" : "s"}`, f: "lote-pendiente", tone: "amber" },
    { n: alerts.margen, text: `${alerts.margen} pendiente${alerts.margen === 1 ? "" : "s"} de aprobar margen`, f: "margen-aprobacion", tone: "amber" },
    { n: alerts.riesgo, text: `Riesgo financiero ${alerts.riesgo}`, f: "riesgo-financiero", tone: "red" },
  ].filter((c) => c.n > 0);
  const tones: Record<string, string> = {
    rose: "border-rose-500/50 bg-rose-500/10 text-rose-300",
    amber: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    red: "border-red-500/50 bg-red-500/10 text-red-300",
  };

  const bmetric = BREAKDOWN_METRICS.find((m) => m.key === breakdown.metric)!;
  const bslicer = SLICERS.find((x) => x.key === breakdown.slicer)!;
  const fmt = (v: number) => formatValue(bmetric.metric, v);
  const rowViews: BreakdownView[] = breakdown.rows.map((r) => ({
    label: r.label,
    value: r.value,
    prev: r.prev ?? null,
    valueText: fmt(r.value),
    prevText: r.prev === undefined ? "—" : fmt(r.prev),
    deltaText: r.delta?.text ?? "",
    deltaSign: r.delta?.sign ?? 0,
    deltaNum: r.prev === undefined || r.prev === 0 ? null : (r.value - r.prev) / Math.abs(r.prev),
    share: r.share,
    href: link({ f: { ...slicers, [breakdown.slicer]: [r.label] }, q: "" }),
  }));

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Periodo" className="flex flex-wrap gap-1">
          {PEDIDOS_PERIODS.map((g) => (
            <Link
              key={g.value}
              href={link({ p: g.value, d: g.value === "dia" ? todayMadrid() : anchor })}
              aria-current={g.value === p ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${FOCUS} ${
                g.value === p ? "bg-cyan-600 text-white" : "border border-slate-600 bg-slate-900 text-slate-100 hover:border-slate-400"
              }`}
            >
              {g.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {period ? (
            <>
              <Link href={link({ p, d: shiftAnchor(p as Granularity, anchor, -1) })} aria-label="Periodo anterior" className={CTRL}>
                ←
              </Link>
              <span className="min-w-[8rem] text-center text-sm font-medium capitalize tabular-nums text-white" aria-live="polite">
                {period.label}
              </span>
              <Link href={link({ p, d: shiftAnchor(p as Granularity, anchor, 1) })} aria-label="Periodo siguiente" className={CTRL}>
                →
              </Link>
            </>
          ) : (
            <span className="px-2 text-sm font-medium text-white">Todo el histórico</span>
          )}
        </div>
        <Link
          href={link({ base: dateBase === "paid" ? "created" : "paid" })}
          className={`ml-auto rounded-lg border px-3 py-1.5 text-xs font-semibold ${FOCUS} ${
            dateBase === "paid" ? "border-cyan-400 bg-cyan-500/10 text-cyan-300" : "border-slate-600 text-slate-300 hover:border-slate-400"
          }`}
          title="La tabla filtra por la fecha del pedido; con esto, por la fecha de cobro"
        >
          {dateBase === "paid" ? "✓ Por fecha de cobro" : "Por fecha de cobro"}
        </Link>
      </div>

      <PedidosSlicers options={slicerOpts} selected={slicers} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {money && (
          <>
            <Kpi href={cobradoHref} active={filtro === "cobrados" && dateBase === "paid"} label="Cobrado sin IVA" value={formatValue("ingresos_netos", money.cobrado.value)}>
              <Delta label={cmp} metric="ingresos_netos" value={money.cobrado.value} prev={money.cobrado.prev} />
            </Kpi>
            <Kpi href={cobradoHref} active={false} label="Margen" value={formatValue("margen_eur", money.margenEur.value)}>
              <p className="mt-1 text-xs tabular-nums text-slate-300">{formatValue("margen_pct", money.margenPct)}</p>
              <Delta label={cmp} metric="margen_eur" value={money.margenEur.value} prev={money.margenEur.prev} />
            </Kpi>
          </>
        )}
        <Kpi href={link({ p, d: anchor, filtro: "todos", base: "created", q: "" })} active={filtro === "todos" && dateBase === "created"} label="Pedidos nuevos" value={formatValue("pedidos", kpis.nuevos.value)}>
          <Delta label={cmp} metric="pedidos" value={kpis.nuevos.value} prev={kpis.nuevos.prev} />
        </Kpi>
        <Kpi href={stock("por-entregar")} active={filtro === "por-entregar"} label="Por entregar" value={String(kpis.porEntregar.count)}>
          <p className="mt-1 text-xs text-slate-300">
            {kpis.porEntregar.vencenPronto} vence{kpis.porEntregar.vencenPronto === 1 ? "" : "n"} hoy o mañana
            {kpis.porEntregar.vencidos > 0 && <span className="text-red-400"> · {kpis.porEntregar.vencidos} vencido{kpis.porEntregar.vencidos === 1 ? "" : "s"}</span>}
          </p>
        </Kpi>
        <Kpi href={stock("por-cobrar")} active={filtro === "por-cobrar"} label="Por cobrar" value={String(kpis.porCobrar.count)}>
          <p className="mt-1 text-xs tabular-nums text-slate-300">{eur(kpis.porCobrar.cents)} con IVA, pendientes y crédito</p>
        </Kpi>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Alertas">
          {chips.map((c) => (
            <Link key={c.f} href={stock(c.f)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${FOCUS} ${tones[c.tone]} ${filtro === c.f ? "ring-2 ring-current" : ""}`}>
              {c.text}
            </Link>
          ))}
        </div>
      )}

      {money && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cobrado sin IVA {period ? `por ${p === "dia" ? "hora" : p === "semana" || p === "mes" ? "día" : "mes"}` : ""}</p>
          <div className="mt-2">
            {money.chart ? <MiniBars data={money.chart} title="Cobrado sin IVA" /> : <p className="py-6 text-center text-xs text-slate-500">Elige un periodo para ver la gráfica.</p>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ver por</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Ver por">
            {SLICERS.map((s) => (
              <Link key={s.key} href={link({ ver: s.key })} aria-current={s.key === breakdown.slicer ? "true" : undefined} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${FOCUS} ${s.key === breakdown.slicer ? "bg-cyan-600 text-white" : "border border-slate-600 text-slate-200 hover:border-slate-400"}`}>
                {s.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 sm:ml-auto" role="group" aria-label="Métrica">
            {BREAKDOWN_METRICS.filter((m) => breakdown.allowed.includes(m.key)).map((m) => (
              <Link key={m.key} href={link({ met: m.key })} aria-current={m.key === breakdown.metric ? "true" : undefined} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${FOCUS} ${m.key === breakdown.metric ? "bg-emerald-600 text-white" : "border border-slate-600 text-slate-200 hover:border-slate-400"}`}>
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <BreakdownTable
            caption={`${bmetric.label} por ${bslicer.label.toLowerCase()}`}
            valueHeader={bmetric.label}
            compareHeader={breakdown.hasCompare ? (period?.partial ? `Mismo tramo de ${period.prevLabel}` : "Anterior") : ""}
            rows={rowViews}
          />
        </div>
        <Link href="/zona-traductor/panel" className={`mt-3 inline-block text-xs font-semibold text-cyan-300 underline ${FOCUS}`}>
          Ver todo en el Panel
        </Link>
      </div>
    </div>
  );
}
