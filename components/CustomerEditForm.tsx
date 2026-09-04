"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CustomerEditable = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  fiscalName: string | null;
  nif: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  isBusiness: boolean;
  autoConfirmPayment: boolean;
  creditEnabled: boolean;
  creditDays: number;
  billingCycle: "PER_ORDER" | "MONTHLY";
  intermediaryEmail: string | null;
};

const input =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none";
const label = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

// Editar la ficha del cliente sin tocar la base de datos. Los datos fiscales
// (NIF, razón social) se imprimen en la factura → un typo aquí obligaba antes a
// un UPDATE a mano. La edición vive en la carpeta del cliente, su sitio natural.
export default function CustomerEditForm({ customer }: { customer: CustomerEditable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(customer);

  function set<K extends keyof CustomerEditable>(key: K, value: CustomerEditable[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          companyName: form.companyName,
          fiscalName: form.fiscalName,
          nif: form.nif,
          address: form.address,
          city: form.city,
          postalCode: form.postalCode,
          country: form.country,
          notes: form.notes,
          isBusiness: form.isBusiness,
          autoConfirmPayment: form.autoConfirmPayment,
          creditEnabled: form.creditEnabled,
          creditDays: form.creditDays,
          billingCycle: form.billingCycle,
          intermediaryEmail: form.intermediaryEmail ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo guardar.");
      setMsg("Ficha actualizada.");
      // Si cambió el email, la URL de la carpeta ya no vale: navega a la nueva.
      if (data.customer?.email && data.customer.email !== customer.email) {
        router.push(`/zona-traductor/clientes/${encodeURIComponent(data.customer.email)}`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message || "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          ✎ Editar datos
        </button>
        {msg && <span className="text-xs font-medium text-emerald-300">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Editar ficha del cliente</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className={label}>Nombre</p>
          <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <p className={label}>Email (clave del cliente)</p>
          <input className={input} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <p className={label}>Teléfono</p>
          <input className={input} value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <p className={label}>Empresa</p>
          <input
            className={input}
            value={form.companyName || ""}
            onChange={(e) => set("companyName", e.target.value)}
          />
        </div>
        <div>
          <p className={label}>Razón social (factura)</p>
          <input className={input} value={form.fiscalName || ""} onChange={(e) => set("fiscalName", e.target.value)} />
        </div>
        <div>
          <p className={label}>NIF / CIF (factura)</p>
          <input className={input} value={form.nif || ""} onChange={(e) => set("nif", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <p className={label}>Dirección</p>
          <input className={input} value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <p className={label}>Ciudad</p>
          <input className={input} value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <p className={label}>Código postal</p>
          <input className={input} value={form.postalCode || ""} onChange={(e) => set("postalCode", e.target.value)} />
        </div>
        <div>
          <p className={label}>País</p>
          <input className={input} value={form.country || ""} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div>
          <p className={label}>Intermediario (email, vacío = ninguno)</p>
          <input
            className={input}
            value={form.intermediaryEmail || ""}
            onChange={(e) => set("intermediaryEmail", e.target.value)}
            placeholder="sin intermediario"
          />
        </div>
        <div className="sm:col-span-2">
          <p className={label}>Notas</p>
          <textarea
            className={`${input} min-h-[64px]`}
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={form.isBusiness}
            onChange={(e) => set("isBusiness", e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Cliente de empresa (B2B)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={form.autoConfirmPayment}
            onChange={(e) => set("autoConfirmPayment", e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Cliente de confianza (justificante auto-confirma el cobro)
        </label>
        {/* Carril de crédito (Juan, 2-sep-2026): "se puede entregar y trabajar con
            determinados clientes". Exige razón social + NIF para que la factura
            con vencimiento no salga simplificada. */}
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={form.creditEnabled}
            onChange={(e) => set("creditEnabled", e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          Cliente de crédito (se trabaja y entrega antes de cobrar, contra factura)
        </label>
        {form.creditEnabled && (
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Vence a
            <input
              type="number"
              min={1}
              max={90}
              value={form.creditDays}
              onChange={(e) => set("creditDays", Math.max(1, Math.min(90, Number(e.target.value) || 30)))}
              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
            días
          </label>
        )}
        {/* Factura agrupada a fin de mes (4-sep-2026, Marbella Translators): los
            pedidos cuelgan de un borrador mensual que se emite al cerrar el mes. */}
        {form.creditEnabled && (
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Facturación
            <select
              value={form.billingCycle}
              onChange={(e) => set("billingCycle", e.target.value === "MONTHLY" ? "MONTHLY" : "PER_ORDER")}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="PER_ORDER">una factura por pedido, al autorizar</option>
              <option value="MONTHLY">factura agrupada a fin de mes</option>
            </select>
          </label>
        )}
      </div>
      {form.creditEnabled && (!form.fiscalName?.trim() || !form.nif?.trim()) && (
        <p className="mt-2 text-xs text-amber-300">
          Para autorizar crédito hacen falta razón social y NIF (arriba): sin NIF la factura sale simplificada y a una empresa no le sirve.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        {msg && <span className="text-xs font-medium text-amber-300">{msg}</span>}
      </div>
    </div>
  );
}
