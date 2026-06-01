"use client";

import { useMemo, useState } from "react";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";

// Contabilidad general por periodo (año / trimestre / mes):
//  - Facturación e IVA repercutido: facturas EMITIDAS (modelo 303/390).
//  - Gastos e IVA soportado: gastos manuales (fuente principal del libro).
//  - Liquidación de IVA (repercutido − soportado) y resultado (ingresos − gastos).
//  - Costes de pedidos: informativo (no entra en el resultado).

export type AcInvoice = {
  id: string;
  number: string | null;
  issuedAt: string;
  fiscalName: string;
  nif: string | null;
  baseCents: number;
  vatCents: number;
  totalCents: number;
};

export type AcOrder = {
  reference: string;
  date: string;
  totalCostCents: number;
  costRecorded: boolean;
};

export type AcExpense = {
  id: string;
  date: string;
  concept: string;
  supplier: string | null;
  category: string | null;
  brand: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
};

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const Q_MONTHS: Record<string, number[]> = { q1: [0, 1, 2], q2: [3, 4, 5], q3: [6, 7, 8], q4: [9, 10, 11] };

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

export default function ContabilidadClient({
  invoices,
  orders,
  expenses,
}: {
  invoices: AcInvoice[];
  orders: AcOrder[];
  expenses: AcExpense[];
}) {
  const years = useMemo(() => {
    const ys = new Set<number>();
    invoices.forEach((i) => ys.add(new Date(i.issuedAt).getFullYear()));
    orders.forEach((o) => ys.add(new Date(o.date).getFullYear()));
    expenses.forEach((e) => ys.add(new Date(e.date).getFullYear()));
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices, orders, expenses]);

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
    const s = rows.reduce((a, i) => ({ base: a.base + i.baseCents, vat: a.vat + i.vatCents, total: a.total + i.totalCents }), { base: 0, vat: 0, total: 0 });
    return { rows, ...s };
  }, [invoices, inPeriod]);

  const exp = useMemo(() => {
    const rows = expenses.filter((e) => inPeriod(e.date));
    const s = rows.reduce((a, e) => ({ base: a.base + e.baseCents, vat: a.vat + e.vatCents, total: a.total + e.totalCents }), { base: 0, vat: 0, total: 0 });
    return { rows, ...s };
  }, [expenses, inPeriod]);

  const ordCost = useMemo(() => {
    const rows = orders.filter((o) => inPeriod(o.date));
    return rows.reduce((a, o) => a + o.totalCostCents, 0);
  }, [orders, inPeriod]);

  const ivaLiquidar = inv.vat - exp.vat;
  const resultado = inv.base - exp.base;

  const csvHref = useMemo(() => {
    const p = new URLSearchParams();
    if (fYear !== "all") p.set("year", fYear);
    if (fPeriod.startsWith("q")) p.set("q", fPeriod.slice(1));
    if (fPeriod.startsWith("m")) p.set("m", fPeriod.slice(1));
    const qs = p.toString();
    return `/api/admin/invoices/export${qs ? `?${qs}` : ""}`;
  }, [fYear, fPeriod]);

  // ── Alta rápida de gasto ──────────────────────────────────
  const [showExp, setShowExp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gasto, setGasto] = useState({ date: "", concept: "", supplier: "", category: "", brand: "traduccionesjuradas", base: "", vatRate: 0.21 });

  async function addExpense() {
    if (!gasto.date || !gasto.concept.trim()) {
      setMsg("Indica al menos fecha y concepto del gasto.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: gasto.date,
          concept: gasto.concept.trim(),
          supplier: gasto.supplier.trim() || null,
          category: gasto.category.trim() || null,
          brand: gasto.brand,
          baseCents: Math.round((parseFloat(gasto.base.replace(",", ".")) || 0) * 100),
          vatRate: gasto.vatRate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar el gasto.");
    } finally {
      setBusy(false);
    }
  }

  async function delExpense(id: string) {
    if (!window.confirm("¿Borrar este gasto?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo borrar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error al borrar.");
      setBusy(false);
    }
  }

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
              <option key={y} value={y}>{y}</option>
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
              <option key={m} value={`m${i + 1}`}>{m}</option>
            ))}
          </select>
        </label>
        <a href={csvHref} className="ml-auto rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
          Descargar CSV (gestoría)
        </a>
      </div>

      {/* Resumen del periodo */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className={cardLabel}>Ingresos (base)</p>
          <p className={`${cardValue} text-white`}>{eur(inv.base)}</p>
          <p className="mt-1 text-[11px] text-slate-500">{inv.rows.length} factura(s) · IVA repercutido {eur(inv.vat)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Gastos (base)</p>
          <p className={`${cardValue} text-rose-300`}>{eur(exp.base)}</p>
          <p className="mt-1 text-[11px] text-slate-500">{exp.rows.length} gasto(s) · IVA soportado {eur(exp.vat)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>IVA a liquidar (303)</p>
          <p className={`${cardValue} ${ivaLiquidar >= 0 ? "text-amber-300" : "text-emerald-300"}`}>{eur(ivaLiquidar)}</p>
          <p className="mt-1 text-[11px] text-slate-500">repercutido − soportado</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Resultado</p>
          <p className={`${cardValue} ${resultado >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{eur(resultado)}</p>
          <p className="mt-1 text-[11px] text-slate-500">ingresos − gastos (base)</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Facturas por fecha de emisión; gastos por su fecha. Coste de pedidos del periodo (informativo, no en el resultado): {eur(ordCost)}.
      </p>

      {/* Gastos */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Gastos del periodo</h2>
        <button type="button" onClick={() => setShowExp((v) => !v)} className="text-xs text-cyan-300 hover:text-cyan-200">
          {showExp ? "Cerrar" : "+ Añadir gasto"}
        </button>
      </div>

      {showExp && (
        <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input type="date" className={FIELD} value={gasto.date} onChange={(e) => setGasto({ ...gasto, date: e.target.value })} />
            <input className={`${FIELD} sm:col-span-2`} placeholder="Concepto *" value={gasto.concept} onChange={(e) => setGasto({ ...gasto, concept: e.target.value })} />
            <input className={FIELD} placeholder="Proveedor" value={gasto.supplier} onChange={(e) => setGasto({ ...gasto, supplier: e.target.value })} />
            <input className={FIELD} placeholder="Categoría (software, cuota…)" value={gasto.category} onChange={(e) => setGasto({ ...gasto, category: e.target.value })} />
            <select className={FIELD} value={gasto.brand} onChange={(e) => setGasto({ ...gasto, brand: e.target.value })}>
              {BRAND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input className={FIELD} placeholder="Base € (sin IVA)" inputMode="decimal" value={gasto.base} onChange={(e) => setGasto({ ...gasto, base: e.target.value })} />
            <select className={FIELD} value={gasto.vatRate} onChange={(e) => setGasto({ ...gasto, vatRate: Number(e.target.value) })}>
              <option value={0.21}>IVA 21%</option>
              <option value={0.1}>IVA 10%</option>
              <option value={0.04}>IVA 4%</option>
              <option value={0}>IVA 0% / exento</option>
            </select>
            <button type="button" onClick={addExpense} disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
              {busy ? "Guardando…" : "Guardar gasto"}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
        </div>
      )}

      {exp.rows.length === 0 ? (
        <p className="mt-2 text-slate-500">Sin gastos en este periodo.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2">Proveedor</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {exp.rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-slate-400">{new Date(e.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3">{e.concept}{e.category && <span className="ml-2 text-[10px] text-slate-500">{e.category}</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{e.supplier || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(e.baseCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{eur(e.vatCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(e.totalCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => delExpense(e.id)} disabled={busy} className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50">
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Facturas del periodo */}
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
    </div>
  );
}
