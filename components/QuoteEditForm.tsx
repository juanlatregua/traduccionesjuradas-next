"use client";

// Edición de un presupuesto ya creado: cliente, idiomas, líneas (añadir/quitar),
// descuento, validez y notas. Guarda con PATCH /api/quotes/[id] (que recalcula
// los totales). Editable solo en estados DRAFT/SENT/OPENED/ACCEPTED (lo valida el
// backend; si no, devuelve el error y se muestra).

import { useState } from "react";
import { useRouter } from "next/navigation";

type Line = {
  description: string;
  quantity: number;
  unitPrice: number;
  supplierUnitCost?: number | null;
  sourceFileUrl?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};

type Quote = {
  id: string;
  quoteNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  sourceLang: string;
  targetLang: string;
  deliveryType?: string;
  discountType?: string;
  discountValue?: number;
  vatRate?: number;
  validityDays?: number;
  notesLegal?: string | null;
  holderNames?: string | null;
  lines: Line[];
};

function eur(n: number) {
  return `${n.toFixed(2)} €`;
}

export default function QuoteEditForm({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState(quote.customerName || "");
  const [customerEmail, setCustomerEmail] = useState(quote.customerEmail || "");
  const [customerPhone, setCustomerPhone] = useState(quote.customerPhone || "");
  const [sourceLang, setSourceLang] = useState(quote.sourceLang || "");
  const [targetLang, setTargetLang] = useState(quote.targetLang || "");
  const [lines, setLines] = useState<Line[]>(
    (quote.lines || []).map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      // Se conservan (no editables aquí) para no perder margen ni referencias al re-guardar.
      supplierUnitCost: (l as any).supplierUnitCost ?? null,
      sourceFileUrl: (l as any).sourceFileUrl ?? null,
      pageStart: (l as any).pageStart ?? null,
      pageEnd: (l as any).pageEnd ?? null,
    }))
  );
  const [discountType, setDiscountType] = useState(quote.discountType || "NONE");
  const [discountValue, setDiscountValue] = useState(quote.discountValue ?? 0);
  const [validityDays, setValidityDays] = useState(quote.validityDays ?? 15);
  const [notesLegal, setNotesLegal] = useState(quote.notesLegal || "");
  const [holderNames, setHolderNames] = useState(quote.holderNames || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vatRate = quote.vatRate ?? 0.21;
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const discount =
    discountType === "PERCENT"
      ? (subtotal * (Number(discountValue) || 0)) / 100
      : discountType === "FIXED"
        ? Number(discountValue) || 0
        : 0;
  const base = Math.max(0, subtotal - discount);
  const total = base + base * vatRate;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    setError(null);
    if (!customerName.trim()) return setError("El nombre del cliente es obligatorio.");
    if (lines.length === 0) return setError("Añade al menos una línea.");
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          sourceLang,
          targetLang,
          deliveryType: quote.deliveryType || "DIGITAL",
          discountType,
          discountValue: Number(discountValue) || 0,
          vatRate,
          validityDays: Number(validityDays) || 15,
          notesLegal: notesLegal.trim() || null,
          holderNames: holderNames.trim() || null,
          lines: lines.map((l) => ({
            description: l.description.trim() || "Línea",
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
            ...(l.supplierUnitCost != null ? { supplierUnitCost: Number(l.supplierUnitCost) } : {}),
            ...(l.sourceFileUrl ? { sourceFileUrl: l.sourceFileUrl } : {}),
            ...(l.pageStart != null ? { pageStart: Number(l.pageStart) } : {}),
            ...(l.pageEnd != null ? { pageEnd: Number(l.pageEnd) } : {}),
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo guardar.");
      router.push(`/admin/quotes/${quote.id}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Error al guardar.");
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-xs font-semibold text-slate-500";

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cliente</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div><label className={label}>Nombre</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={input} /></div>
          <div><label className={label}>Email</label><input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={input} /></div>
          <div><label className={label}>Teléfono</label><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={input} /></div>
          <div><label className={label}>Idioma origen</label><input value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className={input} /></div>
          <div><label className={label}>Idioma destino</label><input value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className={input} /></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Líneas</h2>
          <button type="button" onClick={() => setLines((p) => [...p, { description: "", quantity: 1, unitPrice: 0 }])} className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
            + Añadir línea
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1"><label className={label}>Concepto</label><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className={input} /></div>
              <div className="w-20"><label className={label}>Cant.</label><input type="number" step="1" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} className={input} /></div>
              <div className="w-28"><label className={label}>Precio (€)</label><input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} className={input} /></div>
              <div className="w-24 text-right text-sm tabular-nums text-slate-600">{eur((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}</div>
              <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-rose-600 hover:bg-rose-50">quitar</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Descuento · validez · notas</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={label}>Descuento</label>
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className={input}>
              <option value="NONE">Sin descuento</option>
              <option value="PERCENT">% porcentaje</option>
              <option value="FIXED">€ fijo</option>
            </select>
          </div>
          <div><label className={label}>Valor descuento</label><input type="number" step="0.01" min="0" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} className={input} disabled={discountType === "NONE"} /></div>
          <div><label className={label}>Validez (días)</label><input type="number" step="1" min="1" value={validityDays} onChange={(e) => setValidityDays(Number(e.target.value))} className={input} /></div>
        </div>
        <div className="mt-3"><label className={label}>Titulares de los certificados (opcional)</label><input value={holderNames} onChange={(e) => setHolderNames(e.target.value)} placeholder="p. ej. María García, Juan Pérez" className={input} /></div>
        <div className="mt-3"><label className={label}>Notas / condiciones</label><textarea value={notesLegal} onChange={(e) => setNotesLegal(e.target.value)} rows={3} className={input} /></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm text-slate-600">
          Subtotal {eur(subtotal)}{discount > 0 ? ` · −${eur(discount)}` : ""} · IVA {Math.round(vatRate * 100)}% ·{" "}
          <strong className="text-slate-900">Total {eur(total)}</strong>
          <span className="ml-2 text-xs text-slate-400">(el total definitivo lo recalcula el servidor)</span>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
