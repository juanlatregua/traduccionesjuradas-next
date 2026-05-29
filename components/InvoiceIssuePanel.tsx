"use client";

import { useState } from "react";

// Emitir o editar la factura de un pedido desde la zona-traductor.
// El número es AA_NNN, auto-sugerido pero EDITABLE (el contador maestro lo lleva
// Juan en el Excel). Para editar una factura ya emitida: misma referencia + nuevo nº.

export default function InvoiceIssuePanel({ suggested }: { suggested: string }) {
  const [reference, setReference] = useState("");
  const [number, setNumber] = useState(suggested);
  const [showFiscal, setShowFiscal] = useState(false);
  const [fiscal, setFiscal] = useState({
    fiscalName: "",
    nif: "",
    address: "",
    city: "",
    postalCode: "",
    country: "España",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!reference.trim()) {
      setMsg("Indica la referencia del pedido.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload: any = { number: number.trim() || undefined };
      if (showFiscal) Object.assign(payload, fiscal);
      const res = await fetch(`/api/orders/${encodeURIComponent(reference.trim())}/invoice/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo emitir la factura.");
      setMsg(`Factura ${data.invoice.number} emitida para ${reference.trim()}.`);
      setTimeout(() => window.location.reload(), 700);
    } catch (e: any) {
      setMsg(e?.message || "Error al emitir.");
    } finally {
      setBusy(false);
    }
  }

  const field = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-white">Emitir / editar factura</h2>
      <p className="mt-1 text-xs text-slate-400">
        Número <strong>AA_NNN</strong> (auto-sugerido, editable). Para reeditar una factura, usa la misma
        referencia con el número nuevo.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Referencia pedido
          <input className={`mt-1 block w-40 ${field}`} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="26_AB12CD" />
        </label>
        <label className="text-xs text-slate-400">
          Nº factura
          <input className={`mt-1 block w-28 ${field} font-mono`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder={suggested} />
        </label>
        <button
          type="button"
          onClick={() => setShowFiscal((v) => !v)}
          className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          {showFiscal ? "Ocultar datos fiscales" : "Datos fiscales (opcional)"}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {busy ? "Emitiendo…" : "Emitir factura"}
        </button>
      </div>

      {showFiscal && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className={field} placeholder="Nombre fiscal" value={fiscal.fiscalName} onChange={(e) => setFiscal({ ...fiscal, fiscalName: e.target.value })} />
          <input className={field} placeholder="NIF/CIF" value={fiscal.nif} onChange={(e) => setFiscal({ ...fiscal, nif: e.target.value })} />
          <input className={field} placeholder="Dirección" value={fiscal.address} onChange={(e) => setFiscal({ ...fiscal, address: e.target.value })} />
          <input className={field} placeholder="Ciudad" value={fiscal.city} onChange={(e) => setFiscal({ ...fiscal, city: e.target.value })} />
          <input className={field} placeholder="C.P." value={fiscal.postalCode} onChange={(e) => setFiscal({ ...fiscal, postalCode: e.target.value })} />
          <input className={field} placeholder="País" value={fiscal.country} onChange={(e) => setFiscal({ ...fiscal, country: e.target.value })} />
        </div>
      )}

      {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
    </div>
  );
}
