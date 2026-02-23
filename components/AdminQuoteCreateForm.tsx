"use client";

import { useState } from "react";

type QuoteLine = {
  description: string;
  quantity: string;
  unitPrice: string;
};

const defaultLine = (): QuoteLine => ({
  description: "",
  quantity: "1",
  unitPrice: "",
});

export default function AdminQuoteCreateForm() {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [sourceLang, setSourceLang] = useState("fr");
  const [targetLang, setTargetLang] = useState("es");
  const [deliveryType, setDeliveryType] = useState<"DIGITAL_PDF" | "PAPER_SHIP">("DIGITAL_PDF");
  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "FIXED">("NONE");
  const [discountValue, setDiscountValue] = useState("0");
  const [vatRate, setVatRate] = useState("0.21");
  const [validityDays, setValidityDays] = useState("15");
  const [notesLegal, setNotesLegal] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([defaultLine()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, defaultLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function submit() {
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim() || null,
        sourceLang,
        targetLang,
        deliveryType,
        discountType,
        discountValue: Number(String(discountValue || "0").replace(",", ".")),
        vatRate: Number(String(vatRate || "0.21").replace(",", ".")),
        validityDays: Number(validityDays),
        notesLegal: notesLegal.trim() || null,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          quantity: Number(String(line.quantity || "0").replace(",", ".")),
          unitPrice: Number(String(line.unitPrice || "0").replace(",", ".")),
        })),
      };

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo crear el presupuesto.");
      }
      const id = String(data.quote?.id || "");
      if (id) {
        window.location.href = `/admin/quotes/${id}`;
        return;
      }
      setMessage("Presupuesto creado.");
    } catch (err: any) {
      setMessage(err?.message || "No se pudo crear el presupuesto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Nuevo presupuesto</h1>
      <p className="mt-1 text-sm text-slate-600">
        Construye el presupuesto, revisa PDF/email y luego envía enlace de pago.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Nombre cliente"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Email cliente"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="Teléfono (opcional)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          placeholder="Idioma origen (ej. fr)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          placeholder="Idioma destino (ej. es)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value as "DIGITAL_PDF" | "PAPER_SHIP")}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="DIGITAL_PDF">Digital PDF</option>
          <option value="PAPER_SHIP">Papel (envío)</option>
        </select>
        <select
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as "NONE" | "PERCENT" | "FIXED")}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="NONE">Sin descuento</option>
          <option value="PERCENT">Descuento %</option>
          <option value="FIXED">Descuento fijo (€)</option>
        </select>
        <input
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          placeholder="Valor descuento"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          placeholder="IVA (0.21)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          placeholder="Validez en días"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <textarea
        value={notesLegal}
        onChange={(e) => setNotesLegal(e.target.value)}
        className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        rows={3}
        placeholder="Notas legales (opcional)"
      />

      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Líneas del presupuesto</p>
        <div className="mt-3 space-y-2">
          {lines.map((line, idx) => (
            <div key={`line-${idx}`} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
                placeholder="Descripción"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                placeholder="Cantidad"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unitPrice}
                onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                placeholder="Precio unitario"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-3 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Añadir línea
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear presupuesto"}
        </button>
        <a href="/admin/quotes" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Volver
        </a>
      </div>
      {message && <p className="mt-3 text-sm font-semibold text-slate-800">{message}</p>}
    </section>
  );
}
