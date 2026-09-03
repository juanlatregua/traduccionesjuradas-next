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
  docKind: string; // invoice | quote
  brand: string;
  orderReference: string | null;
  clientName: string | null;
  holderNames: string | null;
  poNumber: string | null;
  paidAt: string | null;
  paymentProofUrl: string | null;
  paymentProofName: string | null;
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
  invoiceType: string; // F1 | F2 | R1… (VeriFactu)
  rectifiesNumber: string | null;
  annulledAt: string | null;
  issuedAt: string | null;
  createdAt: string;
};

type SavedCustomer = {
  key: string;
  clientName: string | null;
  fiscalName: string;
  nif: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  email: string | null;
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
    docKind: "invoice",
    brand: "traduccionesjuradas",
    orderReference: "",
    clientName: "",
    holderNames: "",
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

export default function InvoiceManager({
  invoices,
  suggested,
  suggestedQuote,
}: {
  invoices: InvoiceRow[];
  suggested: string;
  suggestedQuote: string;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [issueNumber, setIssueNumber] = useState(suggested);
  const [customers, setCustomers] = useState<SavedCustomer[]>([]);

  // Sugerencia por serie: facturas AA_NNN, presupuestos P·AA_NNN.
  const suggestionFor = (docKind: string) => (docKind === "quote" ? suggestedQuote : suggested);

  // Libro de clientes recurrentes: se carga al abrir el formulario.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/invoices/customers")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setCustomers(d.customers as SavedCustomer[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  function applyCustomer(key: string) {
    const c = customers.find((x) => x.key === key);
    if (!c) return;
    setForm((f) => ({
      ...f,
      clientName: c.clientName || f.clientName,
      fiscalName: c.fiscalName,
      nif: c.nif || "",
      address: c.address || "",
      city: c.city || "",
      postalCode: c.postalCode || "",
      country: c.country || "España",
      email: c.email || "",
    }));
    setMsg(`Datos de ${c.fiscalName} cargados.`);
  }

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
    // Al cambiar el tipo de documento, la sugerencia de número cambia de serie.
    if (key === "docKind") setIssueNumber(suggestionFor(String(value)));
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
    setIssueNumber(suggestionFor(row.docKind));
    setForm({
      docKind: row.docKind || "invoice",
      brand: row.brand || "traduccionesjuradas",
      orderReference: row.orderReference || "",
      clientName: row.clientName || "",
      holderNames: row.holderNames || "",
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
      docKind: form.docKind,
      brand: form.brand,
      orderReference: form.orderReference.trim() || null,
      clientName: form.clientName.trim() || null,
      holderNames: form.holderNames.trim() || null,
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

  async function issue(id: string, num?: string, docKind?: string) {
    let number = num;
    if (number === undefined) {
      // Emitir desde la fila de la tabla (sin el formulario abierto): pide el número.
      const isQuote = docKind === "quote";
      const p = window.prompt(
        `Número a asignar (formato ${isQuote ? "P·AA_NNN" : "AA_NNN"}, sugerido por el sistema — la BD es el contador):`,
        suggestionFor(docKind || "invoice")
      );
      if (p === null) return;
      number = p;
    }
    // La sugerencia se calculó al cargar la página y puede estar caducada (otra
    // emisión o un lazy_pdf pudo consumirla). Si no se ha editado, se manda vacío
    // y el servidor asigna el siguiente libre con reintento anti-colisión.
    const trimmed = number.trim();
    const untouchedSuggestion = trimmed === suggestionFor(docKind || form.docKind || "invoice");
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: untouchedSuggestion ? undefined : trimmed || undefined }),
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

  // Adjuntar el justificante bancario de una factura emitida → la marca cobrada.
  async function attachProof(row: InvoiceRow, file: File, dateISO?: string) {
    // Fecha del COBRO (no la de hoy): el justificante puede subirse días después.
    // Importa para el trimestre fiscal. Si se cancela el prompt, no se adjunta.
    let when = dateISO;
    if (when === undefined) {
      const today = new Date().toISOString().slice(0, 10);
      const picked = window.prompt("Fecha del cobro (AAAA-MM-DD):", today);
      if (picked === null) return;
      when = picked.trim() || today;
    }
    setBusy(true);
    setMsg(null);
    let uploadedUrl = "";
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("prefix", "invoices");
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const ud = await up.json();
      if (!up.ok || !ud.ok) throw new Error(ud.error || "No se pudo subir el justificante.");
      uploadedUrl = ud.url;
      const res = await fetch(`/api/invoices/${row.id}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true, date: when, proof: { url: ud.url, key: ud.pathname, name: file.name } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo marcar la factura como cobrada.");
      setMsg("Justificante adjuntado · factura cobrada.");
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      // Si el blob se subió pero falló el sellado, bórralo para no dejar huérfanos.
      if (uploadedUrl) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: uploadedUrl }),
        }).catch(() => {});
      }
      setMsg(e?.message || "Error al adjuntar el justificante.");
      setBusy(false);
    }
  }

  // Quitar el justificante y volver la factura a pendiente.
  async function removeProof(row: InvoiceRow) {
    if (!window.confirm("¿Quitar el justificante y marcar la factura como pendiente de cobro?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${row.id}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar.");
      setMsg("Factura marcada como pendiente de cobro.");
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      setMsg(e?.message || "Error al actualizar.");
      setBusy(false);
    }
  }

  // VeriFactu (3-sep-2026): una factura emitida no se borra. Se corrige con
  // rectificativa (borrador R1 con las líneas negadas, listo para ajustar y
  // emitir) o se anula con registro de anulación (ADMIN/PM, motivo).
  async function rectify(row: InvoiceRow) {
    const reason = window.prompt(`Rectificar la factura ${row.number}. Motivo (opcional, va al concepto):`, "") ?? null;
    if (reason === null) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${row.id}/rectify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo crear la rectificativa.");
      setMsg(`Borrador de rectificativa de ${row.number} creado: ajusta las líneas y emítelo.`);
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      setMsg(err?.message || "No se pudo crear la rectificativa.");
    } finally {
      setBusy(false);
    }
  }

  async function annul(row: InvoiceRow) {
    const reason = window.prompt(`ANULAR la factura ${row.number} (registro de anulación; la factura no se borra). Motivo, mínimo 10 caracteres:`, "");
    if (!reason) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/invoices/${row.id}/annul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo anular.");
      setMsg(`Factura ${row.number} anulada.`);
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      setMsg(err?.message || "No se pudo anular.");
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
          <div className="mt-3 flex flex-wrap gap-4">
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
            <label className="text-xs text-slate-400">
              Tipo de documento
              <select className={`mt-1 block w-64 ${FIELD}`} value={form.docKind} onChange={(e) => set("docKind", e.target.value)}>
                <option value="invoice">Factura</option>
                <option value="quote">Presupuesto (fuera de contabilidad)</option>
              </select>
              {form.docKind === "quote" && (
                <span className="mt-1 block text-[11px] text-violet-300">
                  Serie propia P·AA_NNN (p.ej. P26_001). NO cuenta en contabilidad, 303 ni gestoría.
                </span>
              )}
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

          {/* Cargar un cliente ya facturado (recurrente, sin pedido) */}
          {customers.length > 0 && (
            <div className="mt-3">
              <label className="text-xs text-slate-400">
                Cliente recurrente
                <select
                  className={`mt-1 block w-full sm:w-96 ${FIELD}`}
                  value=""
                  onChange={(e) => applyCustomer(e.target.value)}
                >
                  <option value="">— Cargar un cliente ya facturado —</option>
                  {customers.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.fiscalName}
                      {c.nif ? ` · ${c.nif}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

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

          {/* Titulares de los certificados (informativo, para no perder la cuenta) */}
          <div className="mt-2">
            <input
              className={`w-full ${FIELD}`}
              placeholder="Titulares de los certificados (opcional, p. ej. María García, Juan Pérez)"
              value={form.holderNames}
              onChange={(e) => set("holderNames", e.target.value)}
            />
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
                  {form.docKind === "quote" ? "Nº presupuesto" : "Nº factura"}
                  <input
                    className={`mt-1 block w-28 ${FIELD} font-mono`}
                    value={issueNumber}
                    onChange={(e) => setIssueNumber(e.target.value)}
                    placeholder={suggestionFor(form.docKind)}
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">
                    sugerido por el sistema — la BD es el contador
                  </span>
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
                <th className="px-4 py-2">Cobro</th>
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
                      {inv.docKind === "quote" && (
                        <span className="ml-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
                          Presupuesto
                        </span>
                      )}
                      {inv.invoiceType?.startsWith("R") && (
                        <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200" title={`Rectifica ${inv.rectifiesNumber || ""}`}>
                          Rectificativa{inv.rectifiesNumber ? ` de ${inv.rectifiesNumber}` : ""}
                        </span>
                      )}
                      {inv.annulledAt && (
                        <span className="ml-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                          Anulada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isDraft ? (
                        <span className="text-slate-600">—</span>
                      ) : inv.paidAt ? (
                        <div className="space-y-1">
                          <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                            Cobrada
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {new Date(inv.paidAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          {inv.paymentProofUrl ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={inv.paymentProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-cyan-300 hover:underline"
                                title={inv.paymentProofName || "Justificante"}
                              >
                                📎 justificante
                              </a>
                              <button
                                type="button"
                                onClick={() => removeProof(inv)}
                                disabled={busy}
                                className="text-[11px] text-rose-300 hover:underline disabled:opacity-50"
                              >
                                quitar
                              </button>
                            </div>
                          ) : (
                            // Cobrada sin justificante (p. ej. sellada por conciliación): permite adjuntarlo.
                            <label className="block cursor-pointer text-[11px] text-cyan-300 hover:underline">
                              + Adjuntar justificante
                              <input
                                type="file"
                                className="hidden"
                                accept="application/pdf,image/*"
                                disabled={busy}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) attachProof(inv, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-block rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                            Pendiente
                          </span>
                          <label
                            className={`block text-[11px] ${busy ? "pointer-events-none opacity-50" : "cursor-pointer text-cyan-300 hover:underline"}`}
                            aria-disabled={busy}
                          >
                            + Adjuntar justificante
                            <input
                              type="file"
                              className="hidden"
                              accept="application/pdf,image/*"
                              disabled={busy}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) attachProof(inv, f);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                      )}
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
                            onClick={() => issue(inv.id, undefined, inv.docKind)}
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
                        {!isDraft && inv.docKind === "invoice" && !inv.annulledAt && (
                          <button
                            type="button"
                            onClick={() => rectify(inv)}
                            disabled={busy}
                            title="Crea un borrador de factura rectificativa (R1) con las líneas negadas"
                            className="rounded border border-amber-600 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-900/30 disabled:opacity-50"
                          >
                            Rectificar
                          </button>
                        )}
                        {!isDraft && inv.docKind === "invoice" && !inv.annulledAt && !inv.paidAt && (
                          <button
                            type="button"
                            onClick={() => annul(inv)}
                            disabled={busy}
                            title="Registro de anulación (ADMIN/PM). La factura se conserva."
                            className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50"
                          >
                            Anular
                          </button>
                        )}
                        {(isDraft || inv.docKind === "quote") && (
                          <button
                            type="button"
                            onClick={() => remove(inv)}
                            disabled={busy}
                            className="rounded border border-rose-700 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 disabled:opacity-50"
                          >
                            Borrar
                          </button>
                        )}
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
