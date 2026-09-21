"use client";

import { useState } from "react";
import { validateShippingInput, type ShippingField, type ShippingInput } from "@/lib/shipping-validation";

type Props = {
  reference: string;
  token?: string;
  initial?: Partial<ShippingInput> | null;
  onSaved?: () => void;
};

const FIELDS: { key: ShippingField; label: string; placeholder: string; wide?: boolean; type?: string }[] = [
  { key: "name", label: "Nombre y apellidos", placeholder: "Nombre y apellidos de quien recibe", wide: true },
  { key: "phone", label: "Teléfono", placeholder: "+34 600 000 000", type: "tel" },
  { key: "address", label: "Dirección", placeholder: "Calle, número, piso y puerta", wide: true },
  { key: "postalCode", label: "Código postal", placeholder: "29001" },
  { key: "city", label: "Ciudad", placeholder: "Málaga" },
  { key: "province", label: "Provincia", placeholder: "Málaga" },
  { key: "country", label: "País", placeholder: "España" },
];

export default function ShippingDataForm({ reference, token, initial, onSaved }: Props) {
  const [form, setForm] = useState<ShippingInput>({
    name: initial?.name || "",
    phone: initial?.phone || "",
    address: initial?.address || "",
    postalCode: initial?.postalCode || "",
    city: initial?.city || "",
    province: initial?.province || "",
    country: initial?.country || "España",
  });
  const [errors, setErrors] = useState<Partial<Record<ShippingField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const v = validateShippingInput(form);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v.data, token }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error || "No se pudo guardar la dirección.");
      }
      setSaved(true);
      onSaved?.();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo guardar la dirección.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-cream bg-cream p-5">
        <p className="text-sm font-semibold text-bleu">Dirección de envío guardada. ¡Gracias!</p>
        <p className="mt-1 text-xs text-sepia">Te enviaremos la traducción jurada en papel a esa dirección en cuanto esté lista.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-amber-200 bg-amber-50 p-5" noValidate>
      <h3 className="text-sm font-semibold text-amber-900">Dirección de envío (traducción en papel)</h3>
      <p className="mt-1 text-xs text-amber-800">
        Tu pedido va en papel por mensajería. Todos los campos son obligatorios.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className={`block ${f.wide ? "sm:col-span-2" : ""}`}>
            <span className="mb-1 block text-xs font-semibold text-encre">{f.label}</span>
            <input
              type={f.type || "text"}
              value={form[f.key]}
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              aria-invalid={!!errors[f.key]}
              className={`block w-full rounded-xl border bg-card px-3 py-2 text-sm text-sepia ${errors[f.key] ? "border-red-400" : "border-cream"}`}
            />
            {errors[f.key] && <span className="mt-1 block text-[11px] text-red-600">{errors[f.key]}</span>}
          </label>
        ))}
      </div>
      {message && <p className="mt-3 text-xs font-semibold text-red-700">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-2xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu-dark disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar dirección de envío"}
      </button>
    </form>
  );
}
