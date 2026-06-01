"use client";

import { useMemo, useState } from "react";

// Contabilidad general por periodo (año / trimestre / mes):
//  - Facturación e IVA: facturas EMITIDAS, por fecha de emisión (modelo 303/390).
//  - Resultado: pedidos COBRADOS (por fecha de pago) − costes (proveedor, comisión,
//    otros) → beneficio del periodo. CSV de gestoría respeta el filtro.

export type AcInvoice = {
  id: string;
  number: string | null;
  issuedAt: string; // ISO
  fiscalName: string;
  nif: string | null;
  baseCents: number;
  vatCents: number;
  totalCents: number;
};

export type AcOrder = {
  reference: string;
  title: string;
  date: string; // ISO (fecha de pago)
  revenueBaseCents: number; // base sin IVA de lo cobrado
  supplierCostCents: number;
  gatewayFeeCents: number;
  otherCostCents: number;
  totalCostCents: number;
  costRecorded: boolean;
};

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const Q_MONTHS: Record<string, number[]> = { q1: [0, 1, 2], q2: [3, 4, 5], q3: [6, 7, 8], q4: [9, 10, 11] };

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100";

export default function ContabilidadClient({ invoices, orders }: { invoices: AcInvoice[]; orders: AcOrder[] }) {
  const years = useMemo(() => {
    const ys = new Set<number>();
    invoices.forEach((i) => ys.add(new Date(i.issuedAt).getFullYear()));
    orders.forEach((o) => ys.add(new Date(o.date).getFullYear()));
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices, orders]);

  const [fYear, setFYear] = useState<string>(years[0] ? String(years[0]) : "all");
  const [fPeriod, setFPeriod] = useState<string>("all");

  const inPeriod = useMemo(() => {
    return (iso: string) => {
      const d = new Date(iso);
      if (fYear !== "all" && d.getFullYear() !== Number(fYear)) return false;
      if (fPeriod === "all") return true;
      if (fPeriod.startsWith("q")) return Q_MONTHS[fPeriod].includes(d.getMonth());
      if (fPeriod.startsWith("m")) return d.getMonth() === Number(fPeriod.slice(1)) - 1;
      return true;
    };
  }, [fYear, fPeriod]);

  const inv = useMemo(() => {
    const rows = invoices.filter((i) => inPeriod(i.issuedAt));
    const s = rows.reduce(
      (a, i) => ({ base: a.base + i.baseCents, vat: a.vat + i.vatCents, total: a.total + i.totalCents }),
      { base: 0, vat: 0, total: 0 }
    );
    return { rows, ...s };
  }, [invoices, inPeriod]);

  const ord = useMemo(() => {
    const rows = orders.filter((o) => inPeriod(o.date));
    const s = rows.reduce(
      (a, o) => ({
        revenue: a.revenue + o.revenueBaseCents,
        cost: a.cost + o.totalCostCents,
        missing: a.missing + (o.costRecorded ? 0 : 1),
      }),
      { revenue: 0, cost: 0, missing: 0 }
    );
    return { rows, revenue: s.revenue, cost: s.cost, missing: s.missing, profit: s.revenue - s.cost };
  }, [orders, inPeriod]);

  const csvHref = useMemo(() => {
    const p = new URLSearchParams();
    if (fYear !== "all") p.set("year", fYear);
    if (fPeriod.startsWith("q")) p.set("q", fPeriod.slice(1));
    if (fPeriod.startsWith("m")) p.set("m", fPeriod.slice(1));
    const qs = p.toString();
    return `/api/admin/invoices/export${qs ? `?${qs}` : ""}`;
  }, [fYear, fPeriod]);

  const card = "rounded-xl border border-slate-700 bg-slate-900/50 p-4";
  const cardLabel = "text-xs uppercase tracking-wide text-slate-400";
  const cardValue = "mt-1 text-xl font-semibold tabular-nums";

  return (
    <div className="mt-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Año
          <select className={`mt-1 block w-32 ${FIELD}`} value={fYear} onChange={(e) => setFYear(e.target.value)}>
            <option value="all">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Periodo
          <select className={`mt-1 block w-48 ${FIELD}`} value={fPeriod} onChange={(e) => setFPeriod(e.target.value)}>
            <option value="all">Todo el año</option>
            <option value="q1">T1 (ene–mar)</option>
            <option value="q2">T2 (abr–jun)</option>
            <option value="q3">T3 (jul–sep)</option>
            <option value="q4">T4 (oct–dic)</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={`m${i + 1}`}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <a href={csvHref} className="ml-auto rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
          Descargar CSV (gestoría)
        </a>
      </div>

      {/* Facturación e IVA */}
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-300">Facturación e IVA</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        <div className={card}>
          <p className={cardLabel}>Facturas emitidas</p>
          <p className={`${cardValue} text-white`}>{inv.rows.length}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Base imponible</p>
          <p className={`${cardValue} text-white`}>{eur(inv.base)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>IVA repercutido</p>
          <p className={`${cardValue} text-amber-300`}>{eur(inv.vat)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Total facturado</p>
          <p className={`${cardValue} text-white`}>{eur(inv.total)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">IVA repercutido = IVA devengado del modelo 303 del periodo. Por fecha de emisión.</p>

      {/* Resultado */}
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-300">Resultado (pedidos cobrados)</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div className={card}>
          <p className={cardLabel}>Ingresos (base)</p>
          <p className={`${cardValue} text-white`}>{eur(ord.revenue)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Gastos (proveedor + comisiones + otros)</p>
          <p className={`${cardValue} text-rose-300`}>{eur(ord.cost)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Beneficio</p>
          <p className={`${cardValue} ${ord.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{eur(ord.profit)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Por fecha de pago. {ord.missing > 0 ? `${ord.missing} pedido(s) sin coste registrado → el beneficio es orientativo (cuenta su ingreso como margen completo).` : "Costes registrados en todos los pedidos del periodo."}
      </p>

      {/* Detalle facturas */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-300">Facturas del periodo</h2>
      {inv.rows.length === 0 ? (
        <p className="mt-2 text-slate-500">Sin facturas emitidas en este periodo.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Número</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {inv.rows.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-mono text-cyan-300">{i.number || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(i.issuedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3">{i.fiscalName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(i.baseCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(i.vatCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(i.totalCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800">
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle gastos por pedido */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-300">Pedidos y costes del periodo</h2>
      {ord.rows.length === 0 ? (
        <p className="mt-2 text-slate-500">Sin pedidos cobrados en este periodo.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Pedido</th>
                <th className="px-4 py-2">Fecha pago</th>
                <th className="px-4 py-2 text-right">Ingreso (base)</th>
                <th className="px-4 py-2 text-right">Coste</th>
                <th className="px-4 py-2 text-right">Beneficio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {ord.rows.map((o) => (
                <tr key={o.reference}>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {o.reference}
                    {!o.costRecorded && <span className="ml-2 text-[10px] text-amber-400">sin coste</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{new Date(o.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(o.revenueBaseCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-300">{eur(o.totalCostCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(o.revenueBaseCents - o.totalCostCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-700 bg-slate-800/40 font-semibold text-white">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total ({ord.rows.length})
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{eur(ord.revenue)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-300">{eur(ord.cost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{eur(ord.profit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
