"use client";

import { useMemo, useState } from "react";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";

// Plantillas de facturas recurrentes. Genera BORRADORES (no emite).

type Line = { description: string; detail?: string; amount: string };

export type RecurringRow = {
  id: string;
  label: string;
  active: boolean;
  brand: string;
  clientName: string | null;
  fiscalName: string;
  nif: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  email: string | null;
  conceptTemplate: string | null;
  poNumber: string | null;
  langPair: string | null;
  lines: { description: string; detail?: string; amountCents: number }[];
  vatRate: number;
  dayOfMonth: number;
  lastGeneratedPeriod: string | null;
  notes: string | null;
};

const VAT_OPTIONS = [
  { label: "21%", value: 0.21 },
  { label: "10%", value: 0.1 },
  { label: "4%", value: 0.04 },
  { label: "0% / exento", value: 0 },
];
const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}
function brandLabel(k: string) {
  return BRAND_OPTIONS.find((o) => o.value === k)?.label || k;
}

function emptyForm() {
  return {
    label: "",
    active: true,
    brand: "traduccionesjuradas",
    clientName: "",
    fiscalName: "",
    nif: "",
    address: "",
    city: "",
    postalCode: "",
    country: "España",
    email: "",
    conceptTemplate: "",
    poNumber: "",
    langPair: "",
    vatRate: 0.21,
    dayOfMonth: 1,
    notes: "",
    lines: [{ description: "", detail: "", amount: "" }] as Line[],
  };
}

export default function RecurringInvoiceManager({ templates }: { templates: RecurringRow[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const totals = useMemo(() => {
    const base = form.lines.reduce((s, l) => s + Math.max(0, Math.round((parseFloat(l.amount.replace(",", ".")) || 0) * 100)), 0);
    const vat = Math.round(base * form.vatRate);
    return { base, vat, total: base + vat };
  }, [form.lines, form.vatRate]);

  function set<K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function setLine(i: number, patch: Partial<Line>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setMsg(null);
    setOpen(true);
  }
  function startEdit(r: RecurringRow) {
    setEditingId(r.id);
    setForm({
      label: r.label,
      active: r.active,
      brand: r.brand || "traduccionesjuradas",
      clientName: r.clientName || "",
      fiscalName: r.fiscalName || "",
      nif: r.nif || "",
      address: r.address || "",
      city: r.city || "",
      postalCode: r.postalCode || "",
      country: r.country || "España",
      email: r.email || "",
      conceptTemplate: r.conceptTemplate || "",
      poNumber: r.poNumber || "",
      langPair: r.langPair || "",
      vatRate: r.vatRate,
      dayOfMonth: r.dayOfMonth,
      notes: r.notes || "",
      lines: r.lines.length ? r.lines.map((l) => ({ description: l.description, detail: l.detail || "", amount: (l.amountCents / 100).toFixed(2) })) : [{ description: "", detail: "", amount: "" }],
    });
    setMsg(null);
    setOpen(true);
  }

  function payload() {
    return {
      label: form.label.trim(),
      active: form.active,
      brand: form.brand,
      clientName: form.clientName.trim() || null,
      fiscalName: form.fiscalName.trim(),
      nif: form.nif.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim() || "España",
      email: form.email.trim() || null,
      conceptTemplate: form.conceptTemplate.trim() || null,
      poNumber: form.poNumber.trim() || null,
      langPair: form.langPair.trim() || null,
      vatRate: form.vatRate,
      dayOfMonth: form.dayOfMonth,
      notes: form.notes.trim() || null,
      lines: form.lines
        .map((l) => ({ description: l.description.trim(), detail: l.detail?.trim() || undefined, amountCents: Math.round((parseFloat(l.amount.replace(",", ".")) || 0) * 100) }))
        .filter((l) => l.description.length > 0 || l.amountCents > 0),
    };
  }

  async function save() {
    if (!form.label.trim()) return setMsg("Ponle un nombre a la plantilla.");
    if (!form.fiscalName.trim()) return setMsg("Falta el nombre fiscal del cliente.");
    setBusy(true);
    setMsg(null);
    try {
      const url = editingId ? `/api/recurring-invoices/${editingId}` : "/api/recurring-invoices";
      const res = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
      setBusy(false);
    }
  }

  async function generate(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/recurring-invoices/${id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo generar.");
      setMsg(data.created ? `Borrador generado. Revísalo y emítelo en Facturas.` : `Ya existía la factura de este periodo.`);
      setBusy(false);
    } catch (e: any) {
      setMsg(e?.message || "Error.");
      setBusy(false);
    }
  }

  async function remove(r: RecurringRow) {
    if (!window.confirm(`¿Borrar la plantilla "${r.label}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recurring-invoices/${r.id}`, { method: "DELETE" });
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
        <p className="text-sm text-slate-400">{templates.length} plantilla(s). El cron genera el borrador el día indicado; también puedes generarlo a mano.</p>
        <button type="button" onClick={startCreate} className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
          + Nueva plantilla
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{editingId ? "Editar plantilla" : "Nueva plantilla recurrente"}</h2>
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
            <input className={FIELD} placeholder="Nombre fiscal *" value={form.fiscalName} onChange={(e) => set("fiscalName", e.target.value)} />
            <input className={FIELD} placeholder="NIF/CIF" value={form.nif} onChange={(e) => set("nif", e.target.value)} />
            <input className={FIELD} placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <input className={FIELD} placeholder="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} />
            <input className={FIELD} placeholder="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <input className={FIELD} placeholder="C.P." value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
            <input className={FIELD} placeholder="Concepto (admite {MES} {AÑO})" value={form.conceptTemplate} onChange={(e) => set("conceptTemplate", e.target.value)} />
            <input className={FIELD} placeholder="Purchase Order / Nº pedido" value={form.poNumber} onChange={(e) => set("poNumber", e.target.value)} />
            <input className={FIELD} placeholder="Par idiomas (p.ej. fr-es)" value={form.langPair} onChange={(e) => set("langPair", e.target.value)} />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Líneas (importe = base, sin IVA)</p>
              <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { description: "", detail: "", amount: "" }] }))} className="text-xs text-cyan-300 hover:text-cyan-200">+ Añadir línea</button>
            </div>
            <div className="mt-2 space-y-2">
              {form.lines.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input className={`${FIELD} min-w-[200px] flex-1`} placeholder="Descripción" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  <input className={`${FIELD} min-w-[160px] flex-1`} placeholder="Detalle" value={l.detail} onChange={(e) => setLine(i, { detail: e.target.value })} />
                  <input className={`${FIELD} w-28 text-right`} placeholder="€ base" inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))} disabled={form.lines.length === 1} className="rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-400">
                IVA
                <select className={`mt-1 block w-32 ${FIELD}`} value={form.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))}>
                  {VAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Día del mes (1–28)
                <input type="number" min={1} max={28} className={`mt-1 block w-24 ${FIELD}`} value={form.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value))} />
              </label>
            </div>
            <div className="text-right text-sm text-slate-300">
              <div>Base: <span className="tabular-nums">{eur(totals.base)}</span></div>
              <div>IVA: <span className="tabular-nums">{eur(totals.vat)}</span></div>
              <div className="text-base font-semibold text-white">Total: <span className="tabular-nums">{eur(totals.total)}</span></div>
            </div>
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
                <th className="px-4 py-2">Cliente</th>
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
                    {!t.active && <span className="ml-2 rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] text-slate-300">inactiva</span>}
                  </td>
                  <td className="px-4 py-3">{t.fiscalName}</td>
                  <td className="px-4 py-3 text-slate-400">{t.dayOfMonth}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{t.lastGeneratedPeriod || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => generate(t.id)} disabled={busy} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Generar borrador</button>
                      <button type="button" onClick={() => startEdit(t)} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">Editar</button>
                      <button type="button" onClick={() => remove(t)} disabled={busy} className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-800 px-4 py-2 text-right">
            <a href="/zona-traductor/facturas" className="text-xs text-cyan-300 hover:text-cyan-200">Ver borradores generados en Facturas →</a>
          </div>
        </div>
      )}
    </div>
  );
}
