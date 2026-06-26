"use client";

import { useState } from "react";

// Pedidos cobrados sin factura emitida → emitir en lote. La fuente de ingresos
// del libro son las facturas emitidas, así que esto cierra el hueco.

type Row = {
  reference: string;
  clientName: string | null;
  clientEmail: string;
  title: string;
  orderAmountCents: number;
  bookableAmountCents: number;
  bookableBaseCents: number;
  paidAt: string | null;
  createdAt: string;
  hasBilling: boolean;
  hasNif: boolean;
  hasFiscalName: boolean;
  draftInvoiceId: string | null;
  amountMismatch: boolean;
  sinFechaCobro: boolean;
};

type Outcome = { reference: string; ok: boolean; number?: string; error?: string; dateAdjusted?: boolean };

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

const EXCLUDE_REASONS = ["Pago no confirmado en banco", "Pedido de prueba", "Reembolsado", "Duplicado"];

export default function ReconcilePanel({ rows, totalAmountCents, canIssue }: { rows: Row[]; totalAmountCents: number; canIssue: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dateMode, setDateMode] = useState<"paid" | "today">("paid");
  // Por defecto Simplificada si TODOS son ventas a particular sin NIF y ≤400€ (el
  // caso típico web). Si hay alguno con NIF, arranca en Completa.
  const [tipo, setTipo] = useState<"completa" | "simplificada">(() =>
    rows.length > 0 && rows.every((r) => !r.hasNif && r.bookableAmountCents <= 40000) ? "simplificada" : "completa"
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ issued: Outcome[]; failed: Outcome[] } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ fiscalName: "", nif: "", address: "", city: "", postalCode: "" });
  const [savingBilling, setSavingBilling] = useState(false);
  const [excludingRef, setExcludingRef] = useState<string | null>(null);

  // Completa: exige NIF + nombre fiscal. Simplificada (≤400€, consumidor final, RD
  // 1619/2012): no exige NIF; solo importes ≤400€.
  const issuable = (r: Row) =>
    tipo === "simplificada" ? r.bookableAmountCents <= 40000 : r.hasNif && r.hasFiscalName;

  function changeTipo(t: "completa" | "simplificada") {
    setTipo(t);
    setSel(new Set()); // la elegibilidad cambia → limpiar selección
  }

  function toggle(ref: string) {
    setSel((s) => {
      const n = new Set(s);
      n.has(ref) ? n.delete(ref) : n.add(ref);
      return n;
    });
  }
  function selectAll() {
    const all = rows.filter(issuable).map((r) => r.reference);
    setSel((s) => (s.size === all.length ? new Set() : new Set(all)));
  }

  async function issue() {
    const references = Array.from(sel);
    if (references.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reconcile/orders/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references, dateMode, simplified: tipo === "simplificada" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo emitir.");
      setResult({ issued: data.issued || [], failed: data.failed || [] });
      setMsg(`Emitidas ${data.issuedCount}. Fallidas ${data.failedCount}.`);
      setSel(new Set());
    } catch (e: any) {
      setMsg(e?.message || "Error al emitir el lote.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r: Row) {
    setEditing(r.reference);
    setForm({ fiscalName: r.clientName || "", nif: "", address: "", city: "", postalCode: "" });
  }

  async function saveBilling(ref: string) {
    if (!form.fiscalName.trim() || !form.nif.trim()) {
      setMsg("El nombre fiscal y el NIF son obligatorios.");
      return;
    }
    setSavingBilling(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/orders/${ref}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo guardar.");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo guardar los datos fiscales.");
      setSavingBilling(false);
    }
  }

  async function excludeOrder(ref: string, reason: string) {
    try {
      const res = await fetch(`/api/orders/${ref}/billing-exclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded: true, reason }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Error");
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo excluir el pedido.");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-800/50 bg-emerald-900/10 p-4 text-sm text-emerald-300">
        ✓ Todos los pedidos cobrados tienen factura emitida. Nada que conciliar.
      </div>
    );
  }

  const selectableCount = rows.filter(issuable).length;
  const fieldCls = "rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500";

  return (
    <div className="mt-6 rounded-xl border border-amber-700/50 bg-amber-900/10 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Pedidos cobrados sin factura emitida</h2>
          <p className="mt-1 text-xs text-slate-400">
            {rows.length} pedido(s) · {eur(totalAmountCents)} a facturar. Emítelas para que cuenten como ingreso del libro.
            {rows.length >= 1000 && <span className="text-amber-300"> (mostrando los primeros 1000)</span>}
          </p>
        </div>
        {canIssue ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex overflow-hidden rounded-lg border border-slate-600 text-xs">
              <button type="button" onClick={() => changeTipo("completa")} className={`px-2.5 py-1 font-semibold ${tipo === "completa" ? "bg-slate-700 text-white" : "text-slate-300"}`}>Completa</button>
              <button type="button" onClick={() => changeTipo("simplificada")} className={`px-2.5 py-1 font-semibold ${tipo === "simplificada" ? "bg-slate-700 text-white" : "text-slate-300"}`}>Simplificada ≤400€</button>
            </span>
            <label className="flex items-center gap-1 text-xs text-slate-300">
              <input type="radio" checked={dateMode === "paid"} onChange={() => setDateMode("paid")} /> Fecha de cobro
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-300">
              <input type="radio" checked={dateMode === "today"} onChange={() => setDateMode("today")} /> Fecha de hoy
            </label>
            <button
              type="button"
              onClick={issue}
              disabled={busy || sel.size === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Emitiendo…" : `Emitir (${sel.size})`}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Solo ADMIN/PM puede emitir.</span>
        )}
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Fecha de cobro: factura con la fecha real del pago. Los pedidos de un trimestre ya presentado (antes de abril 2026) se
        fechan hoy automáticamente. <strong>Completa</strong>: exige NIF y nombre fiscal. <strong>Simplificada</strong> (≤400€, consumidor
        final): no exige NIF — ideal para ventas web a particulares. Si un pedido ya tiene borrador, se factura con sus líneas.
      </p>

      {canIssue && tipo === "completa" && rows.length > 0 && selectableCount === 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-700/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          <span>Ninguno tiene NIF. Para ventas web a particulares (≤400€) puedes facturar <strong>sin NIF</strong>:</span>
          <button
            type="button"
            onClick={() => changeTipo("simplificada")}
            className="rounded-md bg-cyan-600 px-2.5 py-1 font-semibold text-white hover:bg-cyan-500"
          >
            Cambiar a Simplificada ≤400€
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 rounded-lg border border-cyan-700/50 bg-cyan-900/10 p-3">
          <p className="text-xs font-semibold text-cyan-200">Datos fiscales · pedido {editing}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input value={form.fiscalName} onChange={(e) => setForm((f) => ({ ...f, fiscalName: e.target.value }))} placeholder="Nombre / razón fiscal *" className={fieldCls} />
            <input value={form.nif} onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))} placeholder="NIF / CIF *" className={fieldCls} />
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Dirección" className={fieldCls} />
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Ciudad" className={fieldCls} />
            <input value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} placeholder="Código postal" className={fieldCls} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => saveBilling(editing)} disabled={savingBilling} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
              {savingBilling ? "Guardando…" : "Guardar (permite factura Completa)"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Cancelar</button>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {canIssue && (
                  <input type="checkbox" checked={sel.size > 0 && sel.size === selectableCount} onChange={selectAll} aria-label="Seleccionar todos" />
                )}
              </th>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Cobrado</th>
              <th className="px-3 py-2 text-right">A facturar</th>
              <th className="px-3 py-2 text-right">Base</th>
              <th className="px-3 py-2">Avisos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.reference} className={!issuable(r) ? "opacity-60" : undefined}>
                <td className="px-3 py-2">
                  {canIssue && <input type="checkbox" checked={sel.has(r.reference)} disabled={!issuable(r)} onChange={() => toggle(r.reference)} />}
                </td>
                <td className="px-3 py-2 font-mono text-slate-300">{r.reference}</td>
                <td className="px-3 py-2">{r.clientName || r.clientEmail}</td>
                <td className="px-3 py-2 text-slate-400">
                  {r.paidAt ? new Date(r.paidAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {eur(r.bookableAmountCents)}
                  {r.amountMismatch && <div className="text-[10px] text-amber-300">cobrado: {eur(r.orderAmountCents)}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">{eur(r.bookableBaseCents)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {!r.hasNif && <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">sin NIF</span>}
                    {!r.hasFiscalName && <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">sin nombre fiscal</span>}
                    {r.draftInvoiceId && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">tiene borrador</span>}
                    {r.amountMismatch && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">borrador ≠ cobrado</span>}
                    {r.sinFechaCobro && <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] text-slate-300">sin fecha de cobro</span>}
                  </div>
                  {canIssue && (!r.hasNif || !r.hasFiscalName) && (
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="mt-1 rounded border border-cyan-700/50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-600/20"
                    >
                      + datos fiscales
                    </button>
                  )}
                  {canIssue &&
                    (excludingRef === r.reference ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-400">Excluir por:</span>
                        {EXCLUDE_REASONS.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => excludeOrder(r.reference, reason)}
                            className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-700"
                          >
                            {reason}
                          </button>
                        ))}
                        <button type="button" onClick={() => setExcludingRef(null)} className="text-[10px] text-slate-500 hover:text-slate-300">
                          cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExcludingRef(r.reference)}
                        className="mt-1 ml-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800"
                      >
                        Excluir de facturación
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}

      {result && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs">
          {result.issued.length > 0 && (
            <p className="text-emerald-300">
              Emitidas: {result.issued.map((o) => `${o.reference}${o.number ? ` → ${o.number}` : ""}${o.dateAdjusted ? " (fecha hoy)" : ""}`).join(", ")}
            </p>
          )}
          {result.failed.length > 0 && (
            <p className="mt-1 text-rose-300">
              Fallidas: {result.failed.map((o) => `${o.reference} (${o.error})`).join(", ")}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 rounded border border-slate-600 px-3 py-1 font-semibold text-slate-200 hover:bg-slate-800"
          >
            Actualizar lista
          </button>
        </div>
      )}
    </div>
  );
}
