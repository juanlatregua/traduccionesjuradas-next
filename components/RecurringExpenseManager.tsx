"use client";

import { useState } from "react";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";
import { TAX_TREATMENT_OPTIONS } from "@/lib/expense-math";

// Plantillas de gastos recurrentes. El cron crea los Expense del mes; los variables
// (sin importe fijo) nacen "pendientes de confirmar" y no cuentan hasta confirmarlos.

// taxTreatment por línea: no se edita en el formulario, pero se conserva en los round-trips.
type LineForm = { concept: string; base: string; vatRate: number; ivaDeducible: boolean; taxTreatment?: string };

export type RecurringExpenseRow = {
  id: string;
  label: string;
  active: boolean;
  brand: string;
  supplier: string | null;
  supplierNif: string | null;
  category: string | null;
  conceptTemplate: string;
  lines: { concept: string; baseCents: number; vatRate: number; ivaDeducible?: boolean; taxTreatment?: string }[];
  vatRate: number;
  taxTreatment: string;
  irpfRetentionPct: number;
  amountCents: number | null;
  dayOfMonth: number;
  lastGeneratedPeriod: string | null;
};

const VAT_OPTIONS = [
  { label: "21%", value: 0.21 },
  { label: "10%", value: 0.1 },
  { label: "4%", value: 0.04 },
  { label: "0% / exento", value: 0 },
];
const TAX_OPTIONS = TAX_TREATMENT_OPTIONS;
const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}
function brandLabel(k: string) {
  return BRAND_OPTIONS.find((o) => o.value === k)?.label || k;
}
function toCents(s: string): number {
  return Math.max(0, Math.round((parseFloat(s.replace(",", ".")) || 0) * 100));
}

function emptyForm() {
  return {
    label: "",
    active: true,
    brand: "traduccionesjuradas",
    supplier: "",
    supplierNif: "",
    category: "",
    conceptTemplate: "",
    vatRate: 0.21,
    taxTreatment: "general",
    amount: "", // vacío = importe variable → nace pendiente de confirmar
    dayOfMonth: 1,
    lines: [] as LineForm[],
  };
}

function rowPayload(r: RecurringExpenseRow) {
  return {
    label: r.label,
    active: r.active,
    brand: r.brand,
    supplier: r.supplier,
    supplierNif: r.supplierNif,
    category: r.category,
    conceptTemplate: r.conceptTemplate,
    lines: r.lines.map((l) => ({ concept: l.concept, baseCents: l.baseCents, vatRate: l.vatRate, ivaDeducible: l.ivaDeducible ?? true, ...(l.taxTreatment ? { taxTreatment: l.taxTreatment } : {}) })),
    vatRate: r.vatRate,
    taxTreatment: r.taxTreatment,
    irpfRetentionPct: r.irpfRetentionPct,
    amountCents: r.amountCents,
    dayOfMonth: r.dayOfMonth,
  };
}

export default function RecurringExpenseManager({ templates }: { templates: RecurringExpenseRow[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setLine(i: number, patch: Partial<LineForm>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setMsg(null);
    setOpen(true);
  }
  function startEdit(r: RecurringExpenseRow) {
    setEditingId(r.id);
    setForm({
      label: r.label,
      active: r.active,
      brand: r.brand || "traduccionesjuradas",
      supplier: r.supplier || "",
      supplierNif: r.supplierNif || "",
      category: r.category || "",
      conceptTemplate: r.conceptTemplate || "",
      vatRate: r.vatRate,
      taxTreatment: r.taxTreatment || "general",
      amount: r.amountCents == null ? "" : (r.amountCents / 100).toFixed(2),
      dayOfMonth: r.dayOfMonth,
      lines: r.lines.map((l) => ({ concept: l.concept, base: (l.baseCents / 100).toFixed(2), vatRate: l.vatRate, ivaDeducible: l.ivaDeducible ?? true, ...(l.taxTreatment ? { taxTreatment: l.taxTreatment } : {}) })),
    });
    setMsg(null);
    setOpen(true);
  }

  function payload() {
    return {
      label: form.label.trim(),
      active: form.active,
      brand: form.brand,
      supplier: form.supplier.trim() || null,
      supplierNif: form.supplierNif.trim() || null,
      category: form.category.trim() || null,
      conceptTemplate: form.conceptTemplate.trim() || null,
      vatRate: form.vatRate,
      taxTreatment: form.taxTreatment,
      amountCents: form.amount.trim() === "" ? null : toCents(form.amount),
      dayOfMonth: form.dayOfMonth,
      lines: form.lines
        .map((l) => ({ concept: l.concept.trim(), baseCents: toCents(l.base), vatRate: l.vatRate, ivaDeducible: l.ivaDeducible, ...(l.taxTreatment ? { taxTreatment: l.taxTreatment } : {}) }))
        .filter((l) => l.concept.length > 0),
    };
  }

  async function save() {
    if (!form.label.trim()) return setMsg("Ponle un nombre a la plantilla.");
    setBusy(true);
    setMsg(null);
    try {
      const url = editingId ? `/api/recurring-expenses/${editingId}` : "/api/recurring-expenses";
      const res = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
      setBusy(false);
    }
  }

  async function toggleActive(r: RecurringExpenseRow) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/recurring-expenses/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rowPayload(r), active: !r.active }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cambiar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error.");
      setBusy(false);
    }
  }

  async function remove(r: RecurringExpenseRow) {
    if (!window.confirm(`¿Borrar la plantilla "${r.label}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recurring-expenses/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo borrar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error al borrar.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {templates.length} plantilla(s). El cron crea el gasto el día indicado; los de importe variable quedan «pendientes de confirmar» en Contabilidad.
        </p>
        <button type="button" onClick={startCreate} className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
          + Nueva plantilla
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{editingId ? "Editar plantilla" : "Nueva plantilla de gasto recurrente"}</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">Cerrar</button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={FIELD} placeholder="Nombre de la plantilla *" value={form.label} onChange={(e) => set("label", e.target.value)} />
            <select className={FIELD} value={form.brand} onChange={(e) => set("brand", e.target.value)}>
              {BRAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activa (el cron la genera)
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={FIELD} placeholder="Proveedor" value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
            <input className={FIELD} placeholder="NIF proveedor" value={form.supplierNif} onChange={(e) => set("supplierNif", e.target.value)} />
            <input className={FIELD} placeholder="Categoría (software, nómina…)" value={form.category} onChange={(e) => set("category", e.target.value)} />
            <input className={`${FIELD} sm:col-span-3`} placeholder="Concepto (admite {MES} {AÑO})" value={form.conceptTemplate} onChange={(e) => set("conceptTemplate", e.target.value)} />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-400">
              Importe fijo € base (vacío = variable)
              <input className={`mt-1 block w-44 ${FIELD}`} placeholder="p.ej. 90,82" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              IVA
              <select className={`mt-1 block w-32 ${FIELD}`} value={form.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))}>
                {VAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Tratamiento IVA
              <select className={`mt-1 block w-48 ${FIELD}`} value={form.taxTreatment} onChange={(e) => set("taxTreatment", e.target.value)}>
                {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Día del mes (1–28)
              <input type="number" min={1} max={28} className={`mt-1 block w-24 ${FIELD}`} value={form.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value))} />
            </label>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Líneas (opcional, multi-apunte: un gasto por línea)</p>
              <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { concept: "", base: "", vatRate: 0.21, ivaDeducible: true }] }))} className="text-xs text-cyan-300 hover:text-cyan-200">+ Añadir línea</button>
            </div>
            {form.lines.length > 0 && (
              <div className="mt-2 space-y-2">
                {form.lines.map((l, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input className={`${FIELD} min-w-[220px] flex-1`} placeholder="Concepto (admite {MES} {AÑO})" value={l.concept} onChange={(e) => setLine(i, { concept: e.target.value })} />
                    <input className={`${FIELD} w-28 text-right`} placeholder="€ base" inputMode="decimal" value={l.base} onChange={(e) => setLine(i, { base: e.target.value })} />
                    <select className={FIELD} value={l.vatRate} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })}>
                      {VAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>IVA {o.label}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-slate-300">
                      <input type="checkbox" checked={l.ivaDeducible} onChange={(e) => setLine(i, { ivaDeducible: e.target.checked })} /> deducible
                    </label>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))} className="rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-400 hover:bg-slate-800">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
              {busy ? "Guardando…" : editingId ? "Guardar cambios" : "Crear plantilla"}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
        </div>
      )}

      {!open && msg && <p className="mt-3 text-xs text-cyan-300">{msg}</p>}

      {templates.length === 0 ? (
        <p className="mt-8 text-slate-500">No hay plantillas todavía.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Plantilla</th>
                <th className="px-4 py-2">Proveedor</th>
                <th className="px-4 py-2 text-right">Importe</th>
                <th className="px-4 py-2">Día</th>
                <th className="px-4 py-2">Último mes</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {templates.map((t) => (
                <tr key={t.id} className={t.active ? undefined : "opacity-60"}>
                  <td className="px-4 py-3">
                    {t.label}
                    {t.brand !== "traduccionesjuradas" && <span className="ml-2 rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-200">{brandLabel(t.brand)}</span>}
                    {t.taxTreatment !== "general" && <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">{TAX_OPTIONS.find((o) => o.value === t.taxTreatment)?.label || t.taxTreatment}</span>}
                    {!t.active && <span className="ml-2 rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] text-slate-300">inactiva</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.supplier || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.amountCents != null ? eur(t.amountCents) : <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">variable</span>}
                    {t.lines.length > 0 && <span className="ml-1 text-[10px] text-slate-500">({t.lines.length} líneas)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{t.dayOfMonth}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{t.lastGeneratedPeriod || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => toggleActive(t)} disabled={busy} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                        {t.active ? "Pausar" : "Activar"}
                      </button>
                      <button type="button" onClick={() => startEdit(t)} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">Editar</button>
                      <button type="button" onClick={() => remove(t)} disabled={busy} className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-800 px-4 py-2 text-right">
            <a href="/zona-traductor/contabilidad" className="text-xs text-cyan-300 hover:text-cyan-200">Ver gastos generados en Contabilidad →</a>
          </div>
        </div>
      )}
    </div>
  );
}
