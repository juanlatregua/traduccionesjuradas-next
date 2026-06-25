"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeQuoteTotals,
  PAPER_SHIPPING_BASE_EUR,
  type QuoteDeliveryType,
  type QuoteDiscountType,
} from "@/lib/quote-math";

// Builder de presupuesto MANUAL unificado (sin subir documentos): fusiona el
// antiguo "presupuesto rápido" de la zona traductor y el "nuevo presupuesto" de
// admin en un solo formulario coherente. El camino CON documentos sigue en el
// intake de expediente (abajo en la misma página). Los totales en vivo usan la
// MISMA función que el servidor (computeQuoteTotals) → la UI nunca miente.

const LANGS = [
  ["es", "Español"], ["fr", "Francés"], ["en", "Inglés"], ["de", "Alemán"], ["it", "Italiano"],
  ["pt", "Portugués"], ["ca", "Catalán"], ["nl", "Neerlandés"], ["sv", "Sueco"], ["no", "Noruego"],
  ["ar", "Árabe"], ["ro", "Rumano"],
] as const;

type Line = { description: string; quantity: string; unitPrice: string };

export type QuoteBuilderInitialData = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  sourceLang?: string;
  targetLang?: string;
  deliveryType?: QuoteDeliveryType;
  lineDescription?: string;
  lineAmount?: string;
};

const numFrom = (s: string) => {
  const n = Number(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function QuoteBuilder({
  initialData,
}: {
  initialData?: QuoteBuilderInitialData;
}) {
  const [name, setName] = useState(initialData?.customerName || "");
  const [email, setEmail] = useState(initialData?.customerEmail || "");
  const [phone, setPhone] = useState(initialData?.customerPhone || "");
  const [src, setSrc] = useState(initialData?.sourceLang || "fr");
  const [tgt, setTgt] = useState(initialData?.targetLang || "es");
  const [deliveryType, setDeliveryType] = useState<QuoteDeliveryType>(
    initialData?.deliveryType === "PAPER_SHIP" ? "PAPER_SHIP" : "DIGITAL_PDF"
  );
  const [plazo, setPlazo] = useState("48 h");
  const [discountType, setDiscountType] = useState<QuoteDiscountType>("NONE");
  const [discountValue, setDiscountValue] = useState("0");
  const [vatRate, setVatRate] = useState("0.21");
  const [validityDays, setValidityDays] = useState("15");
  const [notesLegal, setNotesLegal] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      description: initialData?.lineDescription || "Traducción jurada",
      quantity: "1",
      unitPrice: initialData?.lineAmount || "",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Agenda de clientes (modelo Customer): elegir uno rellena los campos.
  type Agenda = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    fiscalName: string | null;
    nif: string | null;
  };
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.customers)) setAgenda(d.customers);
      })
      .catch(() => {});
  }, []);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  const addLine = () =>
    setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // Resumen en vivo: misma matemática que el servidor.
  const totals = useMemo(
    () =>
      computeQuoteTotals({
        lines: lines.map((l) => ({
          description: l.description,
          quantity: numFrom(l.quantity),
          unitPrice: numFrom(l.unitPrice),
        })),
        discountType,
        discountValue: numFrom(discountValue),
        vatRate: numFrom(vatRate),
        deliveryType,
        shippingBase: PAPER_SHIPPING_BASE_EUR,
      }),
    [lines, discountType, discountValue, vatRate, deliveryType]
  );

  const hasContact =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || phone.replace(/\D/g, "").length >= 7;
  const linesValid = lines.every(
    (l) => l.description.trim() && numFrom(l.quantity) > 0 && numFrom(l.unitPrice) >= 0
  );
  // Mismos rangos que el validador del servidor (lib/quote-validators.ts): así el
  // botón no deja enviar algo que devolvería 400 y el resumen no engaña.
  const vatOk = numFrom(vatRate) >= 0 && numFrom(vatRate) <= 1;
  const discountOk =
    discountType !== "PERCENT" || (numFrom(discountValue) >= 0 && numFrom(discountValue) <= 100);
  const canSubmit =
    !busy && name.trim() && hasContact && linesValid && totals.subtotal > 0 && vatOk && discountOk;

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const plazoNote = plazo.trim() ? `Plazo de entrega: ${plazo.trim()}` : "";
      const notes = [plazoNote, notesLegal.trim()].filter(Boolean).join("\n") || undefined;
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerEmail: email.trim().toLowerCase() || undefined,
          customerPhone: phone.trim() || undefined,
          sourceLang: src,
          targetLang: tgt,
          deliveryType,
          discountType,
          discountValue: numFrom(discountValue),
          vatRate: numFrom(vatRate),
          validityDays: Math.max(1, Math.round(numFrom(validityDays) || 15)),
          notesLegal: notes,
          lines: lines.map((l) => ({
            description: l.description.trim(),
            quantity: numFrom(l.quantity),
            unitPrice: numFrom(l.unitPrice),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo crear el presupuesto.");
      const id = String(data.quote?.id || "");
      if (id) {
        window.location.href = `/admin/quotes/${id}`;
        return;
      }
      throw new Error("Presupuesto creado pero sin id de retorno.");
    } catch (e: any) {
      setErr(e?.message || "Error al crear el presupuesto.");
      setBusy(false);
    }
  }

  const f = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

  return (
    <section className="mb-6 rounded-xl border border-cyan-700/50 bg-cyan-500/[0.04] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-white">
        ⚡ Presupuesto manual <span className="font-normal text-slate-400">(sin subir documentos)</span>
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Para leads que llegan por WhatsApp/teléfono. Al crear, vas al detalle para enviarlo por
        WhatsApp/Bizum o email.
      </p>

      <div className="mt-4 space-y-3">
        {/* Cliente: elegir de la agenda (Customer) rellena los campos, o teclear */}
        {agenda.length > 0 && (
          <select
            className={f}
            defaultValue=""
            onChange={(e) => {
              const c = agenda.find((x) => x.id === e.target.value);
              if (!c) return;
              setName(c.companyName || c.name || "");
              setEmail((c.email || "").toLowerCase());
              setPhone(c.phone || "");
            }}
          >
            <option value="">— Elegir cliente de la agenda (o teclear abajo) —</option>
            {agenda.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name}
                {c.nif ? ` · ${c.nif}` : ""}
                {c.email ? ` · ${c.email}` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={f} placeholder="Nombre cliente" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={f} type="email" placeholder="Email (o teléfono)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={f} placeholder="Teléfono (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        {/* Idiomas + entrega + plazo */}
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
            Entrega
            <select
              className={`mt-1 block w-full ${f}`}
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as QuoteDeliveryType)}
            >
              <option value="DIGITAL_PDF">Digital PDF</option>
              <option value="PAPER_SHIP">Papel (+{PAPER_SHIPPING_BASE_EUR} €)</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Plazo de entrega
            <input className={`mt-1 block w-full ${f}`} value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="48 h / jueves 30" />
          </label>
        </div>

        {/* Líneas */}
        <div className="rounded-lg border border-slate-700 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Líneas del presupuesto</p>
          <div className="mt-2 space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[2fr_70px_110px_auto]">
                <input className={f} placeholder="Descripción" value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                <input className={`${f} tabular-nums`} type="number" min={0} step="0.01" placeholder="Cant." value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                <input className={`${f} tabular-nums`} type="number" min={0} step="0.01" placeholder="€ (sin IVA)" value={line.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: e.target.value })} />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLine} className="mt-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            + Añadir línea
          </button>
        </div>

        {/* Descuento + IVA + validez */}
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="text-xs text-slate-400">
            Descuento
            <select className={`mt-1 block w-full ${f}`} value={discountType} onChange={(e) => setDiscountType(e.target.value as QuoteDiscountType)}>
              <option value="NONE">Sin descuento</option>
              <option value="PERCENT">Porcentaje %</option>
              <option value="FIXED">Fijo €</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Valor descuento
            <input className={`mt-1 block w-full ${f} tabular-nums`} type="number" min={0} max={discountType === "PERCENT" ? 100 : undefined} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} disabled={discountType === "NONE"} />
          </label>
          <label className="text-xs text-slate-400">
            IVA (0–1)
            <input className={`mt-1 block w-full ${f} tabular-nums`} type="number" min={0} max={1} step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} placeholder="0.21" />
          </label>
          <label className="text-xs text-slate-400">
            Validez (días)
            <input className={`mt-1 block w-full ${f} tabular-nums`} type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </label>
        </div>

        <textarea className={`w-full ${f}`} rows={2} placeholder="Notas legales (opcional)" value={notesLegal} onChange={(e) => setNotesLegal(e.target.value)} />

        {/* Resumen en vivo */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
            <span>Subtotal: <span className="tabular-nums text-white">{totals.subtotal.toFixed(2)} €</span></span>
            {totals.shippingAmount > 0 && <span>Envío: <span className="tabular-nums">+{totals.shippingAmount.toFixed(2)} €</span></span>}
            {totals.discountAmount > 0 && <span className="text-emerald-400">Dto: -{totals.discountAmount.toFixed(2)} €</span>}
            <span>IVA: <span className="tabular-nums">{totals.vatAmount.toFixed(2)} €</span></span>
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
      </div>
    </section>
  );
}
