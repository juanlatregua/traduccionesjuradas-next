"use client";

import { useEffect, useMemo, useState } from "react";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";

// Gestor de facturas de la zona-traductor: crear borrador (libre o desde un
// pedido), editar líneas/IVA, emitir (asigna AA_NNN) y borrar. Las líneas se
// teclean en BASE (sin IVA); el total se calcula en vivo.

type Line = { description: string; detail?: string; amount: string }; // amount en euros (texto)

export type InvoiceRow = {
  id: string;
  number: string | null;
  status: string; // DRAFT | ISSUED
  brand: string;
  orderReference: string | null;
  clientName: string | null;
  poNumber: string | null;
  fiscalName: string;
  nif: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  email: string | null;
  concept: string | null;
  langPair: string | null;
  lines: { description: string; detail?: string; amountCents: number }[];
  vatRate: number;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  issuedAt: string | null;
  createdAt: string;
};

const VAT_OPTIONS = [
  { label: "21%", value: 0.21 },
  { label: "10%", value: 0.1 },
  { label: "4%", value: 0.04 },
  { label: "0% / exento", value: 0 },
];

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function brandLabel(key: string) {
  return BRAND_OPTIONS.find((o) => o.value === key)?.label || key;
}

function emptyForm() {
  return {
    brand: "traduccionesjuradas",
    orderReference: "",
    clientName: "",
    fiscalName: "",
    nif: "",
    address: "",
    city: "",
    postalCode: "",
    country: "España",
    email: "",
    concept: "",
    poNumber: "",
    langPair: "",
    vatRate: 0.21,
    lines: [{ description: "", detail: "", amount: "" }] as Line[],
  };
}

const FIELD =
  "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

export default function InvoiceManager({ invoices, suggested }: { invoices: InvoiceRow[]; suggested: string }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [issueNumber, setIssueNumber] = useState(suggested);

  const totals = useMemo(() => {
    const base = form.lines.reduce((s, l) => {
      const n = Math.round((parseFloat(l.amount.replace(",", ".")) || 0) * 100);
      return s + Math.max(0, n);
    }, 0);
    const vat = Math.round(base * form.vatRate);
    return { base, vat, total: base + vat };
  }, [form.lines, form.vatRate]);

  function set<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setLine(i: number, patch: Partial<Line>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }
  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, { description: "", detail: "", amount: "" }] }));
  }
  function removeLine(i: number) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  function startCreate(brand?: string) {
    setEditingId(null);
    const f = emptyForm();
    if (brand && BRAND_OPTIONS.some((o) => o.value === brand)) f.brand = brand;
    setForm(f);
    setMsg(null);
    setOpen(true);
  }

  // Deep-link desde Contabilidad: ?nueva=holabonjour abre el creador en esa marca.
  useEffect(() => {
    const nueva = new URLSearchParams(window.location.search).get("nueva");
    if (nueva) startCreate(nueva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(row: InvoiceRow) {
    setEditingId(row.id);
    setForm({
      brand: row.brand || "traduccionesjuradas",
      orderReference: row.orderReference || "",
      clientName: row.clientName || "",
      fiscalName: row.fiscalName || "",
      nif: row.nif || "",
      address: row.address || "",
      city: row.city || "",
      postalCode: row.postalCode || "",
      country: row.country || "España",
      email: row.email || "",
      concept: row.concept || "",
      poNumber: row.poNumber || "",
      langPair: row.langPair || "",
      vatRate: row.vatRate,
      lines:
        row.lines.length > 0
          ? row.lines.map((l) => ({ description: l.description, detail: l.detail || "", amount: (l.amountCents / 100).toFixed(2) }))
          : [{ description: "", detail: "", amount: "" }],
    });
    setMsg(null);
    setOpen(true);
  }

  async function prefillFromOrder() {
    const ref = form.orderReference.trim();
    if (!ref) {
      setMsg("Escribe una referencia de pedido para traer sus datos.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices?reference=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar el pedido.");
      if (data.alreadyInvoiced) {
        setMsg(`Aviso: ese pedido ya tiene una factura (${data.alreadyInvoiced.number || "borrador"}).`);
      }
      const p = data.prefill;
      setForm((f) => ({
        ...f,
        orderReference: p.orderReference,
        clientName: p.clientName,
        fiscalName: p.fiscalName,
        nif: p.nif,
        address: p.address,
        city: p.city,
        postalCode: p.postalCode,
        country: p.country,
        email: p.email,
        concept: p.concept,
        langPair: p.langPair,
        vatRate: p.vatRate,
        lines: (p.lines || []).map((l: { description: string; amountCents: number }) => ({
          description: l.description,
          detail: "",
          amount: (l.amountCents / 100).toFixed(2),
        })),
      }));
    } catch (e: any) {
      setMsg(e?.message || "Error al traer el pedido.");
    } finally {
      setBusy(false);
    }
  }

  function payload() {
    return {
      brand: form.brand,
      orderReference: form.orderReference.trim() || null,
      clientName: form.clientName.trim() || null,
      fiscalName: form.fiscalName.trim(),
      nif: form.nif.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim() || "España",
      email: form.email.trim() || null,
      concept: form.concept.trim() || null,
      poNumber: form.poNumber.trim() || null,
      langPair: form.langPair.trim() || null,
      vatRate: form.vatRate,
      lines: form.lines
        .map((l) => ({
          description: l.description.trim(),
          detail: l.detail?.trim() || undefined,
          amountCents: Math.round((parseFloat(l.amount.replace(",", ".")) || 0) * 100),
        }))
        .filter((l) => l.description.length > 0 || l.amountCents > 0),
    };
  }

  async function save() {
    if (!form.fiscalName.trim()) {
      setMsg("Falta el nombre fiscal del cliente.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const url = editingId ? `/api/invoices/${editingId}` : "/api/invoices";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo guardar.");
      setMsg("Borrador guardado.");
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setMsg(e?.message || "Error al guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function issue(id: string, num?: string) {
    let number = num;
    if (number === undefined) {
      // Emitir desde la fila de la tabla (sin el formulario abierto): pide el número.
      const p = window.prompt(`Número fiscal a asignar (formato AA_NNN):`, suggested);
      if (p === null) return;
      number = p;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: number.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo emitir.");
      setMsg(`Factura ${data.invoice.number} emitida.`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      setMsg(e?.message || "Error al emitir.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: InvoiceRow) {
    const isIssued = row.status === "ISSUED";
    const label = row.number || "borrador";
    const warn = isIssued
      ? `Vas a BORRAR la factura emitida ${label}. En una factura real se anula con rectificativa, no se borra. ¿Seguro? (solo para limpieza/pruebas)`
      : `Borrar el borrador de ${row.fiscalName}?`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo borrar.");
      setMsg(`Factura ${label} borrada.`);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setMsg(e?.message || "Error al borrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Crea facturas libres (cliente de WhatsApp, sin pedido) o desde un pedido. Edita el borrador y emítelo cuando esté listo.
        </p>
        <button
          type="button"
          onClick={() => startCreate()}
          className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          + Nueva factura
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{editingId ? "Editar borrador" : "Nueva factura (borrador)"}</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">
              Cerrar
            </button>
          </div>

          {/* Marca / actividad emisora (numeración compartida) */}
          <div className="mt-3">
            <label className="text-xs text-slate-400">
              Marca / actividad
              <select className={`mt-1 block w-64 ${FIELD}`} value={form.brand} onChange={(e) => set("brand", e.target.value)}>
                {BRAND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Vínculo opcional con un pedido */}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">
              Referencia de pedido (opcional)
              <input
                className={`mt-1 block w-48 ${FIELD} font-mono`}
                value={form.orderReference}
                onChange={(e) => set("orderReference", e.target.value)}
                placeholder="TJ-2026-…"
              />
            </label>
            <button
              type="button"
              onClick={prefillFromOrder}
              disabled={busy}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Traer datos del pedido
            </button>
          </div>

          {/* Datos fiscales */}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={FIELD} placeholder="Nombre fiscal *" value={form.fiscalName} onChange={(e) => set("fiscalName", e.target.value)} />
            <input className={FIELD} placeholder="NIF/CIF" value={form.nif} onChange={(e) => set("nif", e.target.value)} />
            <input className={FIELD} placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <input className={FIELD} placeholder="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} />
            <input className={FIELD} placeholder="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <input className={FIELD} placeholder="C.P." value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
            <input className={FIELD} placeholder="País" value={form.country} onChange={(e) => set("country", e.target.value)} />
            <input className={FIELD} placeholder="Concepto / título (opcional)" value={form.concept} onChange={(e) => set("concept", e.target.value)} />
            <input className={FIELD} placeholder="Purchase Order / Nº pedido cliente" value={form.poNumber} onChange={(e) => set("poNumber", e.target.value)} />
            <input className={FIELD} placeholder="Par idiomas (p.ej. fr-es)" value={form.langPair} onChange={(e) => set("langPair", e.target.value)} />
          </div>

          {/* Líneas */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Líneas (importe = base, sin IVA)</p>
              <button type="button" onClick={addLine} className="text-xs text-cyan-300 hover:text-cyan-200">
                + Añadir línea
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {form.lines.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${FIELD} min-w-[200px] flex-1`}
                    placeholder="Descripción"
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                  />
                  <input
                    className={`${FIELD} min-w-[160px] flex-1`}
                    placeholder="Detalle (palabras · idiomas)"
                    value={l.detail}
                    onChange={(e) => setLine(i, { detail: e.target.value })}
                  />
                  <input
                    className={`${FIELD} w-28 text-right`}
                    placeholder="€ base"
                    inputMode="decimal"
                    value={l.amount}
                    onChange={(e) => setLine(i, { amount: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={form.lines.length === 1}
                    className="rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40"
                    aria-label="Quitar línea"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* IVA + totales en vivo */}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <label className="text-xs text-slate-400">
              IVA
              <select
                className={`mt-1 block w-40 ${FIELD}`}
                value={form.vatRate}
                onChange={(e) => set("vatRate", Number(e.target.value))}
              >
                {VAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-right text-sm text-slate-300">
              <div>Base: <span className="tabular-nums">{eur(totals.base)}</span></div>
              <div>IVA: <span className="tabular-nums">{eur(totals.vat)}</span></div>
              <div className="text-base font-semibold text-white">Total: <span className="tabular-nums">{eur(totals.total)}</span></div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {busy ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar borrador"}
            </button>
            {editingId && (
              <>
                <a
                  href={`/api/invoices/${editingId}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Vista previa proforma
                </a>
                <label className="text-xs text-slate-400">
                  Nº factura
                  <input
                    className={`mt-1 block w-28 ${FIELD} font-mono`}
                    value={issueNumber}
                    onChange={(e) => setIssueNumber(e.target.value)}
                    placeholder={suggested}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => issue(editingId, issueNumber)}
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Emitir factura
                </button>
              </>
            )}
          </div>
          {!editingId && (
            <p className="mt-2 text-xs text-slate-500">Guarda el borrador para poder previsualizarlo y emitirlo.</p>
          )}
          {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
        </div>
      )}

      {!open && msg && <p className="mt-3 text-xs text-cyan-300">{msg}</p>}

      {/* Tabla de facturas */}
      {invoices.length === 0 ? (
        <p className="mt-8 text-slate-500">No hay facturas todavía.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Número</th>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Pedido</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {invoices.map((inv) => {
                const isDraft = inv.status !== "ISSUED";
                const date = inv.issuedAt || inv.createdAt;
                return (
                  <tr key={inv.id} className={isDraft ? "bg-amber-500/5" : undefined}>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isDraft ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                        }`}
                      >
                        {isDraft ? "Borrador" : "Emitida"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-300">{inv.number || "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{inv.orderReference || "—"}</td>
                    <td className="px-4 py-3">
                      {inv.fiscalName}
                      {inv.brand !== "traduccionesjuradas" && (
                        <span className="ml-2 rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-200">
                          {brandLabel(inv.brand)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(inv.baseCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{eur(inv.vatCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(inv.totalCents)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => startEdit(inv)}
                            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                          >
                            Editar
                          </button>
                        )}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => issue(inv.id)}
                            disabled={busy}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Emitir
                          </button>
                        )}
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-slate-600 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-800"
                        >
                          PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => remove(inv)}
                          disabled={busy}
                          className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
