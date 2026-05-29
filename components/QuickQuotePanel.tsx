"use client";

import { useMemo, useState } from "react";

// Presupuesto rápido (sin subir documentos): para clientes de WhatsApp/teléfono.
// Concepto + precio + plazo editables, resumen en vivo, y "Crear" → detalle del
// presupuesto donde se envía por WhatsApp/Bizum.

const LANGS = [
  ["es", "Español"], ["fr", "Francés"], ["en", "Inglés"], ["de", "Alemán"], ["it", "Italiano"],
  ["pt", "Portugués"], ["ca", "Catalán"], ["nl", "Neerlandés"], ["sv", "Sueco"], ["no", "Noruego"],
  ["ar", "Árabe"], ["ro", "Rumano"],
] as const;

export default function QuickQuotePanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [src, setSrc] = useState("fr");
  const [tgt, setTgt] = useState("es");
  const [concept, setConcept] = useState("Traducción jurada");
  const [price, setPrice] = useState<number>(50);
  const [plazo, setPlazo] = useState("48 h");
  const [discount, setDiscount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => {
    const base = Math.max(0, Number(price) || 0);
    const desc = discount > 0 ? base * (discount / 100) : 0;
    const taxable = Math.max(0, base - desc);
    const vat = taxable * 0.21;
    return { base, desc, vat, total: taxable + vat };
  }, [price, discount]);

  const canSubmit = !busy && name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && totals.base > 0;

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || undefined,
          sourceLang: src,
          targetLang: tgt,
          deliveryType: "DIGITAL_PDF",
          discountType: discount > 0 ? "PERCENT" : "NONE",
          discountValue: discount,
          vatRate: 0.21,
          notesLegal: plazo.trim() ? `Plazo de entrega: ${plazo.trim()}` : undefined,
          lines: [
            {
              description: `${concept.trim()}${plazo.trim() ? ` · entrega ${plazo.trim()}` : ""}`,
              quantity: 1,
              unitPrice: totals.base,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo crear.");
      window.location.href = `/admin/quotes/${data.quote.id}`;
    } catch (e: any) {
      setErr(e?.message || "Error al crear el presupuesto.");
      setBusy(false);
    }
  }

  const f = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100";

  return (
    <div className="mb-6 rounded-xl border border-cyan-700/50 bg-cyan-500/[0.04] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white">⚡ Presupuesto rápido (sin subir documentos)</span>
        <span className="text-xs text-cyan-300">{open ? "Ocultar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={f} placeholder="Nombre cliente" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={f} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={f} placeholder="Teléfono (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-xs text-slate-400">
              Origen
              <select className={`mt-1 block w-full ${f}`} value={src} onChange={(e) => setSrc(e.target.value)}>
                {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Destino
              <select className={`mt-1 block w-full ${f}`} value={tgt} onChange={(e) => setTgt(e.target.value)}>
                {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Precio (sin IVA) €
              <input type="number" min={0} step="0.01" className={`mt-1 block w-full ${f} tabular-nums`} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </label>
            <label className="text-xs text-slate-400">
              Plazo de entrega
              <input className={`mt-1 block w-full ${f}`} value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="48 h / jueves 30" />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <input className={f} placeholder="Concepto (descripción)" value={concept} onChange={(e) => setConcept(e.target.value)} />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Descuento %
              <input type="number" min={0} max={100} className={`${f} w-24 tabular-nums`} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </label>
          </div>

          {/* Resumen en vivo */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
              <span>Base: <span className="tabular-nums text-white">{totals.base.toFixed(2)} €</span></span>
              {discount > 0 && <span className="text-emerald-400">Dto {discount}%: -{totals.desc.toFixed(2)} €</span>}
              <span>IVA 21%: <span className="tabular-nums">{totals.vat.toFixed(2)} €</span></span>
              <span className="font-semibold text-white">Total: <span className="tabular-nums">{totals.total.toFixed(2)} €</span></span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Creando…" : "Crear y enviar →"}
            </button>
          </div>
          {err && <p className="text-sm text-amber-400">{err}</p>}
          <p className="text-xs text-slate-500">Al crear, vas al presupuesto para enviarlo por WhatsApp/Bizum o email con un toque.</p>
        </div>
      )}
    </div>
  );
}
