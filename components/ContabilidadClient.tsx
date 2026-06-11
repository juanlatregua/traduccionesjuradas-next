"use client";

import { useMemo, useState } from "react";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";
import { computeExpenseTotals, clampIrpfPct } from "@/lib/expense-math"; // puro, sin Prisma
import { build303, build111, build130, draftToText } from "@/lib/tax-drafts";

const ALLOWED_VAT = [0, 0.04, 0.1, 0.21];
function snapVat(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.21;
  const f = n > 1 ? n / 100 : n;
  return ALLOWED_VAT.reduce((best, a) => (Math.abs(a - f) < Math.abs(best - f) ? a : best), 0.21);
}

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
  supplierInvoiceNumber: string | null;
  category: string | null;
  brand: string;
  baseCents: number;
  vatCents: number;
  ivaDeducible: boolean;
  irpfCents: number;
  totalCents: number;
  payableCents: number;
  attachmentUrl: string | null;
  attachmentName: string | null;
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
    invoices.forEach((i) => ys.add(new Date(i.issuedAt).getUTCFullYear()));
    orders.forEach((o) => ys.add(new Date(o.date).getUTCFullYear()));
    expenses.forEach((e) => ys.add(new Date(e.date).getUTCFullYear()));
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices, orders, expenses]);

  const [fYear, setFYear] = useState<string>(years[0] ? String(years[0]) : "all");
  const [fPeriod, setFPeriod] = useState<string>("all");

  const inPeriod = useMemo(() => {
    return (iso: string) => {
      const d = new Date(iso);
      if (fYear !== "all" && d.getUTCFullYear() !== Number(fYear)) return false;
      if (fPeriod === "all") return true;
      if (fPeriod.startsWith("q")) return Q_MONTHS[fPeriod].includes(d.getUTCMonth());
      if (fPeriod.startsWith("m")) return d.getUTCMonth() === Number(fPeriod.slice(1)) - 1;
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
    const s = rows.reduce(
      (a, e) => ({
        base: a.base + e.baseCents,
        vat: a.vat + e.vatCents,
        deducibleVat: a.deducibleVat + (e.ivaDeducible ? e.vatCents : 0), // solo el IVA deducible va al 303
        irpf: a.irpf + e.irpfCents,
        total: a.total + e.totalCents,
      }),
      { base: 0, vat: 0, deducibleVat: 0, irpf: 0, total: 0 }
    );
    return { rows, ...s };
  }, [expenses, inPeriod]);

  const ordCost = useMemo(() => {
    const rows = orders.filter((o) => inPeriod(o.date));
    return rows.reduce((a, o) => a + o.totalCostCents, 0);
  }, [orders, inPeriod]);

  const ivaLiquidar = inv.vat - exp.deducibleVat; // soportado deducible, no todo
  const resultado = inv.base - exp.base;

  // ── Borradores de impuestos del trimestre (303/111/130) ──────────────
  // El 130 va ACUMULADO del año hasta el final del periodo seleccionado.
  const periodEndMonth = useMemo(() => {
    if (fPeriod.startsWith("q")) { const ms = Q_MONTHS[fPeriod]; return ms[ms.length - 1]; }
    if (fPeriod.startsWith("m")) return Number(fPeriod.slice(1)) - 1;
    return 11;
  }, [fPeriod]);
  const inYtd = useMemo(
    () => (iso: string) => {
      if (fYear === "all") return false;
      const d = new Date(iso);
      return d.getUTCFullYear() === Number(fYear) && d.getUTCMonth() <= periodEndMonth;
    },
    [fYear, periodEndMonth]
  );
  const drafts = useMemo(() => {
    const exp111 = exp.rows.filter((e) => e.irpfCents > 0);
    const d303 = build303(inv.vat, exp.deducibleVat);
    const d111 = build111(exp111.reduce((a, e) => a + e.baseCents, 0), exp.irpf, exp111.length);
    const ytdInvBase = invoices.filter((i) => inYtd(i.issuedAt)).reduce((a, i) => a + i.baseCents, 0);
    const ytdExpBase = expenses.filter((e) => inYtd(e.date)).reduce((a, e) => a + e.baseCents, 0);
    const d130 = build130(ytdInvBase, ytdExpBase);
    return { d303, d111, d130 };
  }, [inv.vat, exp.deducibleVat, exp.rows, exp.irpf, invoices, expenses, inYtd]);
  const periodLabel = `${fYear === "all" ? "todos los años" : fYear}${
    fPeriod === "all" ? "" : ` · ${fPeriod.startsWith("q") ? "T" + fPeriod.slice(1) : MONTHS[Number(fPeriod.slice(1)) - 1]}`
  }`;
  function downloadDraft() {
    const text = draftToText(periodLabel, drafts.d303, drafts.d111, drafts.d130);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `borrador-impuestos-${periodLabel.replace(/[^\w]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const qsPeriod = useMemo(() => {
    const p = new URLSearchParams();
    if (fYear !== "all") p.set("year", fYear);
    if (fPeriod.startsWith("q")) p.set("q", fPeriod.slice(1));
    if (fPeriod.startsWith("m")) p.set("m", fPeriod.slice(1));
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [fYear, fPeriod]);
  const csvHref = `/api/admin/invoices/export${qsPeriod}`;
  const expensesCsvHref = `/api/admin/expenses/export${qsPeriod}`;

  // ── Alta rápida de gasto ──────────────────────────────────
  const [showExp, setShowExp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gasto, setGasto] = useState({ date: "", concept: "", supplier: "", supplierNif: "", supplierInvoiceNumber: "", category: "", brand: "traduccionesjuradas", base: "", vatRate: 0.21, irpfPct: 0, ivaDeducible: true });
  const [gastoFile, setGastoFile] = useState<File | null>(null);

  const gastoCalc = useMemo(() => {
    const base = Math.round((parseFloat(gasto.base.replace(",", ".")) || 0) * 100);
    return computeExpenseTotals(base, gasto.vatRate, gasto.irpfPct);
  }, [gasto.base, gasto.vatRate, gasto.irpfPct]);

  async function addExpense() {
    if (!gasto.date || !gasto.concept.trim()) {
      setMsg("Indica al menos fecha y concepto del gasto.");
      return;
    }
    if (gasto.irpfPct > 0 && !gasto.supplierNif.trim()) {
      setMsg("La retención de IRPF exige el NIF del proveedor.");
      return;
    }
    setBusy(true);
    setMsg(null);
    // Fuera del try para poder limpiar el blob si el guardado falla después de subirlo.
    let attachmentUrl: string | null = null;
    try {
      // Subir el justificante SOLO al guardar (para no dejar blobs huérfanos).
      let attachmentKey: string | null = null;
      let attachmentName: string | null = null;
      if (gastoFile) {
        const fd = new FormData();
        fd.append("file", gastoFile);
        fd.append("prefix", "expenses");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const ud = await up.json();
        if (!up.ok || !ud.ok) throw new Error(ud.error || "No se pudo subir el justificante.");
        attachmentUrl = ud.url;
        attachmentKey = ud.pathname || null;
        attachmentName = gastoFile.name;
      }
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: gasto.date,
          concept: gasto.concept.trim(),
          supplier: gasto.supplier.trim() || null,
          supplierNif: gasto.supplierNif.trim() || null,
          supplierInvoiceNumber: gasto.supplierInvoiceNumber.trim() || null,
          category: gasto.category.trim() || null,
          brand: gasto.brand,
          baseCents: Math.round((parseFloat(gasto.base.replace(",", ".")) || 0) * 100),
          vatRate: gasto.vatRate,
          ivaDeducible: gasto.ivaDeducible,
          irpfRetentionPct: gasto.irpfPct,
          attachmentUrl,
          attachmentKey,
          attachmentName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      window.location.reload();
    } catch (e: any) {
      // Si subimos el justificante pero el gasto no se guardó, borra el blob huérfano.
      if (attachmentUrl) {
        fetch("/api/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: attachmentUrl }) }).catch(() => {});
      }
      setMsg(e?.message || "Error al guardar el gasto.");
      setBusy(false);
    }
  }

  async function extractFromFile() {
    if (!gastoFile) {
      setMsg("Selecciona primero el archivo de la factura del proveedor.");
      return;
    }
    setBusy(true);
    setMsg("Extrayendo datos de la factura con IA…");
    try {
      const fd = new FormData();
      fd.append("file", gastoFile);
      const res = await fetch("/api/expenses/extract", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo extraer.");
      const x = d.data || {};
      // Normalizar los valores de la IA a las opciones válidas + avisar de rarezas.
      const vatRate = x.vatRate != null ? snapVat(x.vatRate) : gasto.vatRate;
      const irpfPct = x.irpfRate != null ? clampIrpfPct(x.irpfRate) : gasto.irpfPct;
      const base = x.baseEur != null ? String(x.baseEur) : gasto.base;
      let warn = "";
      if (x.irpfRate && clampIrpfPct(x.irpfRate) === 0) {
        warn += " Retención no estándar (¿19% de alquiler? eso es modelo 115, aparte): revísala a mano.";
      }
      if (x.totalEur != null && base) {
        const calc = computeExpenseTotals(Math.round(parseFloat(base.replace(",", ".")) * 100) || 0, vatRate, irpfPct);
        if (Math.abs(Math.round(x.totalEur * 100) - calc.totalCents) > 2) {
          warn += ` El total de la factura (${x.totalEur} €) no cuadra con base+IVA: revisa el tipo o la base.`;
        }
      }
      setGasto((g) => ({
        ...g,
        date: x.date || g.date,
        concept: x.concept || g.concept,
        supplier: x.supplier || g.supplier,
        supplierNif: x.supplierNif || g.supplierNif,
        supplierInvoiceNumber: x.supplierInvoiceNumber || g.supplierInvoiceNumber,
        base,
        vatRate,
        irpfPct,
      }));
      setMsg("Datos extraídos. Revísalos y completa lo que falte antes de guardar." + warn);
    } catch (e: any) {
      setMsg(e?.message || "Error al extraer.");
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
        <div className="ml-auto flex gap-2">
          <a href={csvHref} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
            CSV facturas
          </a>
          <a href={expensesCsvHref} className="rounded-lg border border-cyan-600 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/30">
            CSV gastos
          </a>
        </div>
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

      {/* Borradores de impuestos del trimestre (303 / 111 / 130) */}
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-amber-200">Borradores de impuestos · {periodLabel}</h3>
          <button onClick={downloadDraft} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
            Descargar borrador (TXT)
          </button>
        </div>
        <p className="mt-1 text-[11px] text-amber-200/70">Uso interno (la gestoría presenta). El 130 va acumulado del año.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo 303 (IVA)</p>
            <p className="mt-1 text-slate-300">Repercutido: <span className="tabular-nums text-slate-100">{eur(drafts.d303.ivaRepercutidoCents)}</span></p>
            <p className="text-slate-300">Soportado ded.: <span className="tabular-nums text-slate-100">{eur(drafts.d303.ivaSoportadoDeducibleCents)}</span></p>
            <p className="mt-1 font-semibold text-white">Resultado: <span className="tabular-nums">{eur(drafts.d303.resultadoCents)}</span> {drafts.d303.resultadoCents >= 0 ? "(a ingresar)" : "(a compensar)"}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo 111 (retenciones)</p>
            <p className="mt-1 text-slate-300">Base: <span className="tabular-nums text-slate-100">{eur(drafts.d111.baseRetencionesCents)}</span></p>
            <p className="text-slate-300">Retenciones: <span className="tabular-nums text-slate-100">{eur(drafts.d111.retencionesCents)}</span></p>
            <p className="text-slate-300">Perceptores: <span className="tabular-nums text-slate-100">{drafts.d111.numPerceptores}</span></p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo 130 (IRPF, año)</p>
            <p className="mt-1 text-slate-300">Rendimiento: <span className="tabular-nums text-slate-100">{eur(drafts.d130.rendimientoNetoCents)}</span></p>
            <p className="text-slate-300">Pago 20%: <span className="tabular-nums text-slate-100">{eur(drafts.d130.pagoFraccionado20Cents)}</span></p>
            <p className="mt-1 font-semibold text-white">A ingresar: <span className="tabular-nums">{eur(drafts.d130.aIngresarCents)}</span></p>
            <p className="text-[10px] text-slate-500">menos pagos previos del año (a completar)</p>
          </div>
        </div>
      </div>

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
            <input className={FIELD} placeholder="NIF proveedor" value={gasto.supplierNif} onChange={(e) => setGasto({ ...gasto, supplierNif: e.target.value })} />
            <input className={FIELD} placeholder="Nº factura proveedor" value={gasto.supplierInvoiceNumber} onChange={(e) => setGasto({ ...gasto, supplierInvoiceNumber: e.target.value })} />
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
            <select className={FIELD} value={gasto.irpfPct} onChange={(e) => setGasto({ ...gasto, irpfPct: Number(e.target.value) })}>
              <option value={0}>Sin IRPF</option>
              <option value={0.15}>IRPF 15%</option>
              <option value={0.07}>IRPF 7% (nuevo autónomo)</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={gasto.ivaDeducible} onChange={(e) => setGasto({ ...gasto, ivaDeducible: e.target.checked })} /> IVA deducible
            </label>
            <label className="text-xs text-slate-400">
              Factura del proveedor (PDF/imagen)
              <input type="file" accept=".pdf,image/*" className="mt-1 block w-full text-xs text-slate-300" onChange={(e) => setGastoFile(e.target.files?.[0] || null)} />
            </label>
            <button
              type="button"
              onClick={extractFromFile}
              disabled={busy || !gastoFile}
              className="self-end rounded-lg border border-fuchsia-600 px-3 py-2 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-900/30 disabled:opacity-50"
            >
              ✨ Extraer datos (IA)
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Base <b className="tabular-nums text-slate-200">{eur(gastoCalc.baseCents)}</b> · IVA <b className="tabular-nums text-slate-200">{eur(gastoCalc.vatCents)}</b>
              {gastoCalc.irpfCents > 0 && <> · IRPF −<b className="tabular-nums text-amber-300">{eur(gastoCalc.irpfCents)}</b></>}
              {" · "}Factura <b className="tabular-nums text-slate-200">{eur(gastoCalc.totalCents)}</b> · A pagar <b className="tabular-nums text-white">{eur(gastoCalc.payableCents)}</b>
            </div>
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
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2">Nº fact.</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-right">IVA</th>
                <th className="px-3 py-2 text-right">IRPF</th>
                <th className="px-3 py-2 text-right">A pagar</th>
                <th className="px-3 py-2">Justif.</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {exp.rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-3 text-slate-400">{new Date(e.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-3 py-3">
                    {e.concept}
                    {e.category && <span className="ml-2 text-[10px] text-slate-500">{e.category}</span>}
                    {!e.ivaDeducible && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">IVA no deducible</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-400">{e.supplier || "—"}</td>
                  <td className="px-3 py-3 font-mono text-slate-400">{e.supplierInvoiceNumber || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{eur(e.baseCents)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{eur(e.vatCents)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{e.irpfCents ? `−${eur(e.irpfCents)}` : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{eur(e.payableCents)}</td>
                  <td className="px-3 py-3">
                    {e.attachmentUrl ? (
                      <a href={e.attachmentUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">ver</a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => delExpense(e.id)} disabled={busy} className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50">
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-700 bg-slate-800/40 text-xs font-semibold text-white">
              <tr>
                <td className="px-3 py-2" colSpan={6}>IRPF retenido del periodo (→ modelo 111): {eur(exp.irpf)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{eur(exp.irpf)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2" colSpan={2}></td>
              </tr>
            </tfoot>
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
