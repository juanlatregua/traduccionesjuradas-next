"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";
import { computeExpenseTotals, clampIrpfPct, clampTaxTreatment, TAX_TREATMENT_OPTIONS } from "@/lib/expense-math"; // puro, sin Prisma
import { draftToText } from "@/lib/tax-drafts";
import { aggregateFiscal, snapVat } from "@/lib/fiscal-aggregation";
import { madridParts, quarterOf } from "@/lib/period-grouping"; // puro, mismo criterio que /periodos
import CollapsibleSection from "@/components/CollapsibleSection";

export type AcInvoice = {
  id: string;
  number: string | null;
  issuedAt: string;
  fiscalName: string;
  nif: string | null;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  orderReference: string | null; // null = factura libre (sin pedido) → sin enlace
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
  supplierNif: string | null;
  supplierInvoiceNumber: string | null;
  category: string | null;
  brand: string;
  baseCents: number;
  vatRate: number;
  vatCents: number;
  ivaDeducible: boolean;
  taxTreatment: string;
  needsReview: boolean;
  notes: string | null;
  irpfRetentionPct: number;
  irpfCents: number;
  totalCents: number;
  payableCents: number;
  attachmentUrl: string | null;
  attachmentName: string | null;
};

// Ingreso cobrado aún sin factura emitida (pedido pagado). Cuenta como ingreso real
// para la salud del negocio, no para el 303 (que va por factura emitida).
export type AcUnbilled = { date: string; baseCents: number };

// Trimestre de IVA cerrado (303 presentado). period = "YYYY-TN".
export type AcTaxClose = { period: string; closedAt: string };

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const Q_MONTHS: Record<string, number[]> = { q1: [0, 1, 2], q2: [3, 4, 5], q3: [6, 7, 8], q4: [9, 10, 11] };

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

// Un gasto es de "proveedor" (coste variable de ventas: traducciones de colaboradores)
// frente a "estructural" (coste fijo de la actividad: nómina, SS, seguros, software…).
function isProveedor(e: AcExpense) {
  if (e.category === "colaborador") return true;
  const s = `${e.concept} ${e.category ?? ""}`.toLowerCase();
  return /traducc|translation|honorarios profesionales/.test(s);
}

const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

const SECTIONS = [
  { id: "balance", label: "Balance" },
  { id: "ingresos", label: "Ingresos" },
  { id: "estructurales", label: "Gastos estructurales" },
  { id: "proveedores", label: "Proveedores" },
  { id: "impuestos", label: "Impuestos" },
  { id: "sin-factura", label: "Sin factura" },
  { id: "banco", label: "Banco" },
];

export default function ContabilidadClient({
  invoices,
  orders,
  expenses: allExpenses,
  unbilled = [],
  taxCloses = [],
  sinFacturaSlot,
  bancoSlot,
  importSlot,
}: {
  invoices: AcInvoice[];
  orders: AcOrder[];
  expenses: AcExpense[];
  unbilled?: AcUnbilled[];
  taxCloses?: AcTaxClose[];
  sinFacturaSlot?: ReactNode;
  bancoSlot?: ReactNode;
  importSlot?: ReactNode;
}) {
  const router = useRouter();
  // needsReview=true = gasto recurrente pendiente de confirmar → fuera de TODOS los
  // números (totales, balance, 303/130). Solo aparece en el banner de pendientes.
  const expenses = useMemo(() => allExpenses.filter((e) => !e.needsReview), [allExpenses]);
  const pendingExpenses = useMemo(() => allExpenses.filter((e) => e.needsReview), [allExpenses]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    invoices.forEach((i) => ys.add(madridParts(new Date(i.issuedAt)).year));
    orders.forEach((o) => ys.add(madridParts(new Date(o.date)).year));
    expenses.forEach((e) => ys.add(madridParts(new Date(e.date)).year));
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices, orders, expenses]);

  const [fYear, setFYear] = useState<string>(years[0] ? String(years[0]) : "all");
  const [fPeriod, setFPeriod] = useState<string>("all");

  // El trimestre se calcula en Europe/Madrid, NO en UTC: el devengo fiscal es
  // hora local española. En UTC, una factura emitida el 1-jul 00:30 Madrid
  // (= 30-jun 22:30 UTC) caía en T2 aquí y en T3 en /periodos → dos cifras del
  // mismo trimestre, y el borrador del 303 salía de esta pantalla (la del
  // criterio incorrecto). madridParts es la misma función que usa /periodos.
  const inPeriod = useMemo(() => {
    return (iso: string) => {
      const { year, month } = madridParts(new Date(iso));
      if (fYear !== "all" && year !== Number(fYear)) return false;
      if (fPeriod === "all") return true;
      if (fPeriod.startsWith("q")) return quarterOf(month) === Number(fPeriod.slice(1));
      if (fPeriod.startsWith("m")) return month === Number(fPeriod.slice(1));
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
        deducibleVat: a.deducibleVat + (e.ivaDeducible ? e.vatCents : 0),
        irpf: a.irpf + e.irpfCents,
        total: a.total + e.totalCents,
      }),
      { base: 0, vat: 0, deducibleVat: 0, irpf: 0, total: 0 }
    );
    return { rows, ...s };
  }, [expenses, inPeriod]);

  const estructRows = useMemo(() => exp.rows.filter((e) => !isProveedor(e)), [exp.rows]);
  const provRows = useMemo(() => exp.rows.filter((e) => isProveedor(e)), [exp.rows]);
  const estructBase = estructRows.reduce((a, e) => a + e.baseCents, 0);
  const provBase = provRows.reduce((a, e) => a + e.baseCents, 0);

  const sinFacturaBase = useMemo(() => unbilled.filter((u) => inPeriod(u.date)).reduce((a, u) => a + u.baseCents, 0), [unbilled, inPeriod]);

  // ── Salud del periodo (ingresos COBRADOS = factura emitida + pedido pagado sin factura) ──
  const ingresosCobrado = inv.base + sinFacturaBase;
  const resultado = ingresosCobrado - exp.base;
  const margen = ingresosCobrado > 0 ? resultado / ingresosCobrado : 0;
  // Los impuestos se derivan de la fuente única (build303/111) más abajo, tras `drafts`.

  // ── Balance por mes/trimestre/año (ingreso cobrado vs gasto) ──
  const balance = useMemo(() => {
    const yearNum = fYear === "all" ? null : Number(fYear);
    if (yearNum === null) {
      const map = new Map<number, { inc: number; exp: number }>();
      const add = (y: number, f: "inc" | "exp", v: number) => {
        const b = map.get(y) || { inc: 0, exp: 0 };
        b[f] += v;
        map.set(y, b);
      };
      invoices.forEach((i) => add(madridParts(new Date(i.issuedAt)).year, "inc", i.baseCents));
      unbilled.forEach((u) => add(madridParts(new Date(u.date)).year, "inc", u.baseCents));
      expenses.forEach((e) => add(madridParts(new Date(e.date)).year, "exp", e.baseCents));
      const rows = [...map.entries()].sort((a, b) => b[0] - a[0]).map(([y, v]) => ({ label: String(y), inc: v.inc, exp: v.exp }));
      const maxBar = Math.max(1, ...rows.flatMap((r) => [r.inc, r.exp]));
      return { mode: "year" as const, rows, maxBar };
    }
    // madridParts.month es 1-12; el array de meses es 0-11.
    const months = Array.from({ length: 12 }, () => ({ inc: 0, exp: 0 }));
    invoices.forEach((i) => { const p = madridParts(new Date(i.issuedAt)); if (p.year === yearNum) months[p.month - 1].inc += i.baseCents; });
    unbilled.forEach((u) => { const p = madridParts(new Date(u.date)); if (p.year === yearNum) months[p.month - 1].inc += u.baseCents; });
    expenses.forEach((e) => { const p = madridParts(new Date(e.date)); if (p.year === yearNum) months[p.month - 1].exp += e.baseCents; });
    const maxBar = Math.max(1, ...months.flatMap((m) => [m.inc, m.exp]));
    return { mode: "month" as const, months, maxBar, year: yearNum };
  }, [invoices, unbilled, expenses, fYear]);

  const yearKpis = useMemo(() => {
    if (balance.mode !== "month") return null;
    const active = balance.months.map((m, i) => ({ i, ...m, res: m.inc - m.exp })).filter((m) => m.inc || m.exp);
    const inc = balance.months.reduce((a, m) => a + m.inc, 0);
    const gto = balance.months.reduce((a, m) => a + m.exp, 0);
    const res = inc - gto;
    const best = active.length ? active.reduce((a, b) => (b.res > a.res ? b : a)) : null;
    const worst = active.length ? active.reduce((a, b) => (b.res < a.res ? b : a)) : null;
    let trend = 0;
    if (active.length >= 2) trend = active[active.length - 1].res - active[active.length - 2].res;
    return { inc, gto, res, margen: inc > 0 ? res / inc : 0, best, worst, trend };
  }, [balance]);

  // ── Borradores de impuestos del periodo (303/111) ──
  // Fuente única en lib/fiscal-aggregation. Se le pasa el array SIN filtrar
  // por needsReview (la exclusión vive dentro de aggregateFiscal).
  const drafts = useMemo(
    () => aggregateFiscal(inv.rows, allExpenses.filter((e) => inPeriod(e.date))),
    [inv.rows, allExpenses, inPeriod]
  );

  // Impuestos estimados atados a la fuente única (build303/111), del periodo.
  // El IS (pagos fraccionados, modelo 202) lo lleva la gestoría — fuera de aquí.
  const iva303 = drafts.d303.resultadoCents;
  const irpf111 = drafts.d111.retencionesCents;
  const impuestosEstim = Math.max(0, iva303) + Math.max(0, irpf111);

  const periodLabel = `${fYear === "all" ? "todos los años" : fYear}${
    fPeriod === "all" ? "" : ` · ${fPeriod.startsWith("q") ? "T" + fPeriod.slice(1) : MONTHS[Number(fPeriod.slice(1)) - 1]}`
  }`;

  function downloadDraft() {
    const text = draftToText(periodLabel, drafts.d303, drafts.d111);
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

  // ── Paquete gestoría + cierre de trimestre (solo con un trimestre elegido) ──
  const selectedQuarter = fYear !== "all" && fPeriod.startsWith("q") ? { year: Number(fYear), q: Number(fPeriod.slice(1)) } : null;
  const selectedTaxPeriod = selectedQuarter ? `${selectedQuarter.year}-T${selectedQuarter.q}` : null;
  const selectedClose = selectedTaxPeriod ? taxCloses.find((c) => c.period === selectedTaxPeriod) ?? null : null;
  const [taxBusy, setTaxBusy] = useState(false);

  async function downloadGestoriaPackage() {
    if (!selectedQuarter) return;
    setTaxBusy(true);
    try {
      const qs = `?year=${selectedQuarter.year}&q=${selectedQuarter.q}`;
      const res = await fetch(`/api/admin/gestoria-package${qs}&check=1`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo comprobar el periodo.");
      const lines = [
        `${d.invoices} facturas · ${d.expenses} gastos`,
        ...(d.paidUnbilled?.length ? [`⚠ ${d.paidUnbilled.length} pedidos cobrados sin factura`] : []),
        ...(d.needsReview ? [`⚠ ${d.needsReview} gastos pendientes de confirmar`] : []),
        ...(d.sinJustificante ? [`⚠ ${d.sinJustificante} sin justificante`] : []),
      ];
      if (!window.confirm(`Paquete gestoría T${selectedQuarter.q} ${selectedQuarter.year}:\n\n${lines.join("\n")}\n\n¿Generar el zip?`)) return;
      // Descarga vía blob: si el servidor devuelve error, se muestra un aviso en
      // vez de navegar la app a una página de JSON crudo.
      const zipRes = await fetch(`/api/admin/gestoria-package${qs}`);
      if (!zipRes.ok) {
        const err = await zipRes.json().catch(() => null);
        throw new Error(err?.error || `Error al generar el paquete (HTTP ${zipRes.status}).`);
      }
      const blob = await zipRes.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gestoria-${selectedQuarter.year}-T${selectedQuarter.q}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      window.alert(e?.message || "Error al preparar el paquete.");
    } finally {
      setTaxBusy(false);
    }
  }

  async function closeQuarter() {
    if (!selectedQuarter || !selectedTaxPeriod) return;
    const ok = window.confirm(
      `Cerrar el trimestre T${selectedQuarter.q} ${selectedQuarter.year} (303 presentado):\n\nLas emisiones en lote ya no fecharán cobros dentro del trimestre — se facturarán con fecha de hoy.\n\n¿Cerrar?`
    );
    if (!ok) return;
    setTaxBusy(true);
    try {
      const res = await fetch("/api/admin/tax-close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: selectedTaxPeriod }) });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo cerrar el trimestre.");
      router.refresh(); // refresca taxCloses sin perder los filtros elegidos
      setTaxBusy(false);
    } catch (e: any) {
      window.alert(e?.message || "Error al cerrar el trimestre.");
      setTaxBusy(false);
    }
  }

  async function reopenQuarter() {
    if (!selectedQuarter || !selectedTaxPeriod) return;
    if (!window.confirm(`¿Reabrir el trimestre T${selectedQuarter.q} ${selectedQuarter.year}? Las emisiones en lote volverán a poder fechar cobros dentro de él.`)) return;
    setTaxBusy(true);
    try {
      const res = await fetch("/api/admin/tax-close", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: selectedTaxPeriod }) });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo reabrir el trimestre.");
      router.refresh();
      setTaxBusy(false);
    } catch (e: any) {
      window.alert(e?.message || "Error al reabrir el trimestre.");
      setTaxBusy(false);
    }
  }

  // ── Alta rápida de gasto ──────────────────────────────────
  const [showExp, setShowExp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gasto, setGasto] = useState({ date: "", concept: "", supplier: "", supplierNif: "", supplierInvoiceNumber: "", category: "", brand: "traduccionesjuradas", base: "", vatRate: 0.21, irpfPct: 0, ivaDeducible: true, taxTreatment: "general" });
  const [gastoFile, setGastoFile] = useState<File | null>(null);
  // Gasto recurrente pendiente que se está confirmando (el guardado hace PATCH needsReview:false).
  const [confirming, setConfirming] = useState<AcExpense | null>(null);

  function startConfirm(e: AcExpense) {
    setConfirming(e);
    setGasto({
      date: e.date.slice(0, 10),
      concept: e.concept,
      supplier: e.supplier || "",
      supplierNif: e.supplierNif || "",
      supplierInvoiceNumber: e.supplierInvoiceNumber || "",
      category: e.category || "",
      brand: e.brand,
      base: e.baseCents ? (e.baseCents / 100).toFixed(2) : "",
      vatRate: snapVat(e.vatRate),
      irpfPct: clampIrpfPct(e.irpfRetentionPct),
      ivaDeducible: e.ivaDeducible,
      taxTreatment: e.taxTreatment,
    });
    setGastoFile(null);
    setMsg(null);
    setShowExp(true);
    document.getElementById("estructurales")?.scrollIntoView({ behavior: "smooth" });
  }

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
    if (confirming && !(parseFloat(gasto.base.replace(",", ".")) > 0)) {
      setMsg("Indica el importe real (base) para confirmar el gasto recurrente.");
      return;
    }
    setBusy(true);
    setMsg(null);
    let attachmentUrl: string | null = null;
    try {
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
      const url = confirming ? `/api/expenses/${confirming.id}` : "/api/expenses";
      const method = confirming ? "PATCH" : "POST";
      const payload = {
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
        taxTreatment: gasto.taxTreatment,
        irpfRetentionPct: gasto.irpfPct,
        attachmentUrl,
        attachmentKey,
        attachmentName,
        ...(confirming ? { needsReview: false, notes: confirming.notes } : {}),
      };
      let res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let data = await res.json();
      // 409 = posible duplicado (mismo nº de factura, o mismo proveedor+importe±3d): confirmar antes de forzar.
      if (res.status === 409 && data.duplicate) {
        const d = data.duplicate;
        const detail = `${new Date(d.date).toLocaleDateString("es-ES")} · ${d.concept}${d.supplier ? ` · ${d.supplier}` : ""} · ${((d.totalCents || 0) / 100).toFixed(2)} €`;
        if (!window.confirm(`Ya existe un gasto que parece el mismo:\n\n${detail}\n\n¿Guardar de todas formas?`)) {
          throw new Error("No guardado: posible duplicado.");
        }
        res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, force: true }) });
        data = await res.json();
      }
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      window.location.reload();
    } catch (e: any) {
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
      const suggestedTreatment = x.taxTreatment ? clampTaxTreatment(x.taxTreatment) : null;
      const vatRate = suggestedTreatment?.startsWith("isp_") ? 0 : x.vatRate != null ? snapVat(x.vatRate) : gasto.vatRate;
      const irpfPct = x.irpfRate != null ? clampIrpfPct(x.irpfRate) : gasto.irpfPct;
      const base = x.baseEur != null ? String(x.baseEur) : gasto.base;
      let warn = "";
      if (d.duplicateOf) {
        const dup = d.duplicateOf;
        warn += ` ⚠ Esta factura (nº ${x.supplierInvoiceNumber}) YA está registrada: ${dup.supplier || dup.concept} el ${String(dup.date).slice(0, 10)} por ${(dup.totalCents / 100).toFixed(2).replace(".", ",")} €. Si guardas, crearás un duplicado.`;
      }
      if (suggestedTreatment?.startsWith("isp_")) {
        warn += " Proveedor extranjero: se sugiere ISP (IVA autorrepercutido en el 303) — revisa el tratamiento de IVA.";
      }
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
        taxTreatment: suggestedTreatment || g.taxTreatment,
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

  // ── Scrollspy de los chips ──
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]?.target?.id) setActive(vis[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sinFacturaSlot, bancoSlot]);

  const card = "rounded-xl border border-slate-700 bg-slate-900/50 p-4";
  const cardLabel = "text-xs uppercase tracking-wide text-slate-400";
  const cardValue = "mt-1 text-xl font-semibold tabular-nums";
  const barMax = balance.maxBar;

  function ExpenseTable({ rows, empty }: { rows: AcExpense[]; empty: string }) {
    if (rows.length === 0) return <p className="mt-2 text-slate-500">{empty}</p>;
    return (
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2 text-right">Base</th>
              <th className="px-3 py-2 text-right">IVA</th>
              <th className="px-3 py-2 text-right">IRPF</th>
              <th className="px-3 py-2 text-right">A pagar</th>
              <th className="px-3 py-2">Justif.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-3 text-slate-400">{new Date(e.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-3 py-3">
                  {e.concept}
                  {e.category && <span className="ml-2 text-[10px] text-slate-500">{e.category}</span>}
                  {!e.ivaDeducible && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">IVA no deducible</span>}
                </td>
                <td className="px-3 py-3 text-slate-400">{e.supplier || "—"}</td>
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
              <td className="px-3 py-2" colSpan={3}>Total base del bloque</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(rows.reduce((a, e) => a + e.baseCents, 0))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(rows.reduce((a, e) => a + e.vatCents, 0))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(rows.reduce((a, e) => a + e.irpfCents, 0))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(rows.reduce((a, e) => a + e.payableCents, 0))}</td>
              <td className="px-3 py-2" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

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
          <a href={csvHref} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">CSV facturas</a>
          <a href={expensesCsvHref} className="rounded-lg border border-cyan-600 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/30">CSV gastos</a>
        </div>
      </div>

      {/* Salud del periodo (siempre visible) */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className={cardLabel}>Ingresos cobrados</p>
          <p className={`${cardValue} text-white`}>{eur(ingresosCobrado)}</p>
          <p className="mt-1 text-[11px] text-slate-500">facturado {eur(inv.base)}{sinFacturaBase > 0 ? ` · sin factura ${eur(sinFacturaBase)}` : ""}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Gastos (base)</p>
          <p className={`${cardValue} text-rose-300`}>{eur(exp.base)}</p>
          <p className="mt-1 text-[11px] text-slate-500">estructural {eur(estructBase)} · proveedores {eur(provBase)}</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Resultado</p>
          <p className={`${cardValue} ${resultado >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{eur(resultado)}</p>
          <p className="mt-1 text-[11px] text-slate-500">margen {(margen * 100).toFixed(0)}% · ingresos − gastos</p>
        </div>
        <div className={card}>
          <p className={cardLabel}>Impuestos estim. a pagar</p>
          <p className={`${cardValue} text-amber-300`}>{eur(impuestosEstim)}</p>
          <p className="mt-1 text-[11px] text-slate-500">IVA {eur(Math.max(0, iva303))} · 111 {eur(Math.max(0, irpf111))} · IS por 202 (gestoría)</p>
        </div>
      </div>

      {/* Gastos recurrentes pendientes de confirmar (fuera de todos los números) */}
      {pendingExpenses.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-700/60 bg-amber-900/20 p-4">
          <p className="text-sm font-semibold text-amber-200">Gastos recurrentes pendientes de confirmar ({pendingExpenses.length})</p>
          <p className="mt-1 text-[11px] text-amber-200/70">
            No cuentan en totales, 303 ni CSV de gestoría hasta que los confirmes con el importe real de la factura.
          </p>
          <ul className="mt-2 divide-y divide-amber-800/40">
            {pendingExpenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm text-slate-200">
                <span className="w-24 shrink-0 text-xs text-slate-400">{new Date(e.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="min-w-[180px] flex-1">
                  {e.concept}
                  {e.supplier && <span className="ml-2 text-xs text-slate-500">{e.supplier}</span>}
                </span>
                <span className="tabular-nums text-xs text-slate-400">{e.baseCents > 0 ? eur(e.baseCents) : "importe pendiente"}</span>
                <button type="button" onClick={() => startConfirm(e)} disabled={busy} className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
                  Confirmar
                </button>
                <button type="button" onClick={() => delExpense(e.id)} disabled={busy} className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50">
                  Descartar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chips de navegación (sticky) */}
      <nav className="sticky top-0 z-20 -mx-4 mt-4 overflow-x-auto border-b border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active === s.id ? "border-cyan-500 bg-cyan-500/15 text-cyan-200" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {s.label}
            </a>
          ))}
          <span className="ml-auto whitespace-nowrap pl-2 text-[11px] text-slate-500">{periodLabel}</span>
        </div>
      </nav>

      {/* BALANCE */}
      <CollapsibleSection id="balance" title="Balance y salud del negocio" subtitle={`Ingresos cobrados vs gastos · ${fYear === "all" ? "por año" : fYear}`}>
        {yearKpis && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}>
              <p className={cardLabel}>Resultado del año</p>
              <p className={`${cardValue} ${yearKpis.res >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{eur(yearKpis.res)}</p>
              <p className="mt-1 text-[11px] text-slate-500">margen {(yearKpis.margen * 100).toFixed(0)}%</p>
            </div>
            <div className={card}>
              <p className={cardLabel}>Ingresos / Gastos año</p>
              <p className={`${cardValue} text-white`}>{eur(yearKpis.inc)}</p>
              <p className="mt-1 text-[11px] text-rose-300/80">gastos {eur(yearKpis.gto)}</p>
            </div>
            <div className={card}>
              <p className={cardLabel}>Mejor / peor mes</p>
              <p className="mt-1 text-sm font-semibold text-emerald-300">{yearKpis.best ? `${MONTHS_SHORT[yearKpis.best.i]} ${eur(yearKpis.best.res)}` : "—"}</p>
              <p className="text-sm font-semibold text-rose-300">{yearKpis.worst ? `${MONTHS_SHORT[yearKpis.worst.i]} ${eur(yearKpis.worst.res)}` : "—"}</p>
            </div>
            <div className={card}>
              <p className={cardLabel}>Tendencia</p>
              <p className={`${cardValue} ${yearKpis.trend >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {yearKpis.trend >= 0 ? "▲" : "▼"} {eur(Math.abs(yearKpis.trend))}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">último mes vs anterior</p>
            </div>
          </div>
        )}

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">{balance.mode === "month" ? "Mes" : "Año"}</th>
                <th className="px-3 py-2 text-right">Ingresos</th>
                <th className="px-3 py-2 text-right">Gastos</th>
                <th className="px-3 py-2 text-right">Resultado</th>
                <th className="px-3 py-2 text-right">Margen</th>
                <th className="hidden px-3 py-2 sm:table-cell">Ingresos / Gastos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {balance.mode === "year"
                ? balance.rows.map((r) => <BalanceRow key={r.label} label={r.label} inc={r.inc} exp={r.exp} barMax={barMax} bold />)
                : (["q1", "q2", "q3", "q4"] as const).flatMap((q) => {
                    const ms = Q_MONTHS[q];
                    const monthRows = ms.map((mi) => (
                      <BalanceRow key={`m${mi}`} label={MONTHS_SHORT[mi]} inc={balance.months[mi].inc} exp={balance.months[mi].exp} barMax={barMax} />
                    ));
                    const qi = ms.reduce((a, mi) => a + balance.months[mi].inc, 0);
                    const qe = ms.reduce((a, mi) => a + balance.months[mi].exp, 0);
                    if (qi === 0 && qe === 0) return monthRows;
                    return [
                      ...monthRows,
                      <BalanceRow key={q} label={`Total ${q.toUpperCase()}`} inc={qi} exp={qe} barMax={barMax} sub />,
                    ];
                  })}
            </tbody>
            {balance.mode === "month" && (
              <tfoot className="border-t-2 border-slate-700 bg-slate-800/40 font-semibold text-white">
                <BalanceRow
                  label={`AÑO ${balance.year}`}
                  inc={balance.months.reduce((a, m) => a + m.inc, 0)}
                  exp={balance.months.reduce((a, m) => a + m.exp, 0)}
                  barMax={barMax}
                  foot
                />
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Ingresos = facturas emitidas + pedidos pagados aún sin factura (dinero cobrado real, no el 303). Coste de pedidos del periodo (informativo):{" "}
          {eur(orders.filter((o) => inPeriod(o.date)).reduce((a, o) => a + o.totalCostCents, 0))}.
        </p>
      </CollapsibleSection>

      {/* INGRESOS */}
      <CollapsibleSection id="ingresos" title="Ingresos — facturas emitidas" subtitle={`${inv.rows.length} factura(s) · base ${eur(inv.base)} · IVA repercutido ${eur(inv.vat)}`}>
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
                    <td className="px-4 py-3 font-mono">
                      {i.orderReference ? (
                        <a href={`/zona-traductor/pedido/${i.orderReference}`} className="text-cyan-300 hover:text-cyan-200 hover:underline">{i.number || "—"}</a>
                      ) : (
                        <span className="text-cyan-300">{i.number || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{new Date(i.issuedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3">{i.fiscalName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(i.baseCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(i.vatCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(i.totalCents)}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/api/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800">PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {importSlot && <div className="mt-4">{importSlot}</div>}
      </CollapsibleSection>

      {/* GASTOS ESTRUCTURALES */}
      <CollapsibleSection
        id="estructurales"
        title="Gastos estructurales"
        subtitle={`Costes fijos (nómina, SS, seguros, software, telefonía, gestoría…) · base ${eur(estructBase)}`}
        right={
          <button
            type="button"
            onClick={() => {
              setShowExp((v) => !v);
              setConfirming(null);
            }}
            className="rounded-lg border border-cyan-700 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/30"
          >
            {showExp ? "Cerrar" : "+ Añadir gasto"}
          </button>
        }
      >
        {showExp && (
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            {confirming && (
              <p className="mb-3 rounded-lg border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                Confirmando gasto recurrente «{confirming.concept}»: pon el importe real y guarda. Se contabilizará al confirmar.
              </p>
            )}
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
              {/* ISP/exento: la factura llega sin IVA → tipo fijado a 0 (el servidor lo fuerza igual) */}
              <select className={FIELD} value={gasto.vatRate} disabled={gasto.taxTreatment !== "general"} onChange={(e) => setGasto({ ...gasto, vatRate: Number(e.target.value) })}>
                <option value={0.21}>IVA 21%</option>
                <option value={0.1}>IVA 10%</option>
                <option value={0.04}>IVA 4%</option>
                <option value={0}>IVA 0% / exento</option>
              </select>
              <label className="text-xs text-slate-400">
                Tratamiento IVA
                <select
                  className={`mt-1 block w-full ${FIELD}`}
                  value={gasto.taxTreatment}
                  onChange={(e) => setGasto({ ...gasto, taxTreatment: e.target.value, ...(e.target.value !== "general" ? { vatRate: 0 } : {}) })}
                >
                  {TAX_TREATMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <select className={FIELD} value={gasto.irpfPct} onChange={(e) => setGasto({ ...gasto, irpfPct: Number(e.target.value) })}>
                <option value={0}>Sin IRPF</option>
                <option value={0.15}>IRPF 15%</option>
                <option value={0.07}>IRPF 7% (nuevo autónomo)</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={gasto.ivaDeducible} onChange={(e) => setGasto({ ...gasto, ivaDeducible: e.target.checked })} /> IVA deducible
              </label>
              <label className="text-xs text-slate-400">
                Factura del proveedor (PDF/imagen/Word)
                <input type="file" accept=".pdf,image/*,.docx" className="mt-1 block w-full text-xs text-slate-300" onChange={(e) => setGastoFile(e.target.files?.[0] || null)} />
              </label>
              <button type="button" onClick={extractFromFile} disabled={busy || !gastoFile} className="self-end rounded-lg border border-fuchsia-600 px-3 py-2 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-900/30 disabled:opacity-50">
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
                {busy ? "Guardando…" : confirming ? "Confirmar gasto" : "Guardar gasto"}
              </button>
            </div>
            {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
          </div>
        )}
        <ExpenseTable rows={estructRows} empty="Sin gastos estructurales en este periodo." />
      </CollapsibleSection>

      {/* PROVEEDORES */}
      <CollapsibleSection id="proveedores" title="Proveedores" subtitle={`Coste de traducciones de colaboradores · base ${eur(provBase)}`}>
        <ExpenseTable rows={provRows} empty="Sin gastos de proveedores en este periodo." />
      </CollapsibleSection>

      {/* IMPUESTOS */}
      <CollapsibleSection
        id="impuestos"
        title="Impuestos — estimación y borradores"
        subtitle={`Estimación a pagar: ${eur(impuestosEstim)} (IVA+111 del periodo; IS por 202 lo lleva la gestoría)`}
        right={
          <button onClick={downloadDraft} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">Descargar borrador (TXT)</button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
          <button
            type="button"
            onClick={downloadGestoriaPackage}
            disabled={taxBusy || !selectedQuarter}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            📦 Paquete gestoría{selectedQuarter ? ` (T${selectedQuarter.q} ${selectedQuarter.year})` : ""}
          </button>
          {selectedQuarter ? (
            selectedClose ? (
              <>
                <span className="rounded-full border border-emerald-700 bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                  T{selectedQuarter.q} cerrado el {new Date(selectedClose.closedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <button type="button" onClick={reopenQuarter} disabled={taxBusy} className="text-xs text-slate-500 underline hover:text-slate-300 disabled:opacity-50">
                  Reabrir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={closeQuarter}
                disabled={taxBusy}
                className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/30 disabled:opacity-50"
              >
                Cerrar trimestre T{selectedQuarter.q}
              </button>
            )
          ) : (
            <span className="text-xs text-slate-500">elige un trimestre en los filtros</span>
          )}
          <span className="w-full text-[11px] text-slate-500 sm:ml-auto sm:w-auto">
            El zip lleva PDFs de facturas, justificantes de gastos, CSVs y resumen 303. Añade el extracto bancario del trimestre.
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo 303 (IVA)</p>
            {drafts.d303.devengado.length === 0 ? (
              <p className="mt-1 text-slate-500">—</p>
            ) : (
              drafts.d303.devengado.map((r) => (
                <p key={r.ratePct} className="text-slate-300">{r.ratePct}%: base <span className="tabular-nums text-slate-100">{eur(r.baseCents)}</span> · cuota <span className="tabular-nums text-slate-100">{eur(r.cuotaCents)}</span></p>
              ))
            )}
            {drafts.d303.ispIntracomBaseCents > 0 && (
              <p className="text-slate-300">ISP intracom. (autorrep.): base <span className="tabular-nums text-slate-100">{eur(drafts.d303.ispIntracomBaseCents)}</span> · cuota <span className="tabular-nums text-slate-100">{eur(drafts.d303.ispIntracomCuotaCents)}</span></p>
            )}
            {drafts.d303.ispImportBaseCents > 0 && (
              <p className="text-slate-300">ISP importación (autorrep.): base <span className="tabular-nums text-slate-100">{eur(drafts.d303.ispImportBaseCents)}</span> · cuota <span className="tabular-nums text-slate-100">{eur(drafts.d303.ispImportCuotaCents)}</span></p>
            )}
            <p className="text-slate-300">Devengado: <span className="tabular-nums text-slate-100">{eur(drafts.d303.ivaRepercutidoCents)}</span></p>
            <p className="text-slate-300">Soportado deducible: <span className="tabular-nums text-slate-100">{eur(drafts.d303.ivaSoportadoDeducibleCents)}</span></p>
            {(drafts.d303.ispIntracomBaseCents > 0 || drafts.d303.ispImportBaseCents > 0) && (
              <p className="text-[11px] text-slate-500">ISP: cuota en devengado y deducible (casillas exactas: validar con gestoría).</p>
            )}
            <p className="mt-1 font-semibold text-white">Resultado: <span className="tabular-nums">{eur(drafts.d303.resultadoCents)}</span> {drafts.d303.resultadoCents >= 0 ? "(a ingresar)" : "(a compensar)"}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modelo 111 (retenciones)</p>
            <p className="mt-1 text-slate-300">Base: <span className="tabular-nums text-slate-100">{eur(drafts.d111.baseRetencionesCents)}</span></p>
            <p className="text-slate-300">Retenciones: <span className="tabular-nums text-slate-100">{eur(drafts.d111.retencionesCents)}</span></p>
            <p className="text-slate-300">Perceptores: <span className="tabular-nums text-slate-100">{drafts.d111.numPerceptores}</span></p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Impuesto de Sociedades</p>
            <p className="mt-1 text-slate-300">S.L.: pagos fraccionados del IS por modelo 202 (lo presenta la gestoría).</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-amber-200/70">Uso interno (la gestoría presenta). La «estimación a pagar» suma el 303 y el 111 del periodo. El IS (modelo 202) lo lleva la gestoría.</p>
      </CollapsibleSection>

      {/* SIN FACTURA */}
      {sinFacturaSlot && (
        <CollapsibleSection id="sin-factura" title="Sin factura — pedidos cobrados pendientes" subtitle="Pedidos pagados que aún no tienen factura emitida" defaultOpen={false}>
          {sinFacturaSlot}
        </CollapsibleSection>
      )}

      {/* BANCO */}
      {bancoSlot && (
        <CollapsibleSection id="banco" title="Banco — conciliación bancaria" subtitle="Sube el CSV del banco y cuadra ingresos y cargos" defaultOpen={false}>
          {bancoSlot}
        </CollapsibleSection>
      )}
    </div>
  );
}

function BalanceRow({
  label,
  inc,
  exp,
  barMax,
  bold,
  sub,
  foot,
}: {
  label: string;
  inc: number;
  exp: number;
  barMax: number;
  bold?: boolean;
  sub?: boolean;
  foot?: boolean;
}) {
  const res = inc - exp;
  const margen = inc > 0 ? Math.round((res / inc) * 100) : 0;
  const rowCls = foot ? "" : sub ? "bg-slate-800/30 font-semibold text-slate-200" : bold ? "font-semibold" : "";
  return (
    <tr className={rowCls}>
      <td className="px-3 py-2 text-slate-300">{label}</td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-200">{(inc / 100).toFixed(2)} €</td>
      <td className="px-3 py-2 text-right tabular-nums text-rose-300/90">{(exp / 100).toFixed(2)} €</td>
      <td className={`px-3 py-2 text-right tabular-nums ${res >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{(res / 100).toFixed(2)} €</td>
      <td className={`px-3 py-2 text-right tabular-nums ${res >= 0 ? "text-emerald-300/80" : "text-rose-300/80"}`}>{inc > 0 ? `${margen}%` : "—"}</td>
      <td className="hidden px-3 py-2 sm:table-cell">
        <div className="flex h-4 items-center gap-1">
          <div className="h-2 rounded-sm bg-emerald-500/70" style={{ width: `${Math.round((inc / barMax) * 100)}%` }} />
          <div className="h-2 rounded-sm bg-rose-500/60" style={{ width: `${Math.round((exp / barMax) * 100)}%` }} />
        </div>
      </td>
    </tr>
  );
}
