"use client";

import { useMemo, useState } from "react";

export type ClientRow = {
  email: string;
  name: string;
  isBusiness: boolean;
  orders: number;
  quotes: number;
  invoices: number;
  paidCents: number;
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

const FIELD =
  "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

function emptyForm() {
  return {
    name: "",
    email: "",
    phone: "",
    isBusiness: false,
    companyName: "",
    fiscalName: "",
    nif: "",
    address: "",
    city: "",
    postalCode: "",
    autoConfirmPayment: false,
  };
}

export default function ClientesManager({ clients }: { clients: ClientRow[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle)
    );
  }, [q, clients]);

  function set<K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function create() {
    if (!form.name.trim()) {
      setMsg("Falta el nombre.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setMsg("Email inválido.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          isBusiness: form.isBusiness,
          companyName: form.companyName.trim() || null,
          fiscalName: form.fiscalName.trim() || null,
          nif: form.nif.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          postalCode: form.postalCode.trim() || null,
          autoConfirmPayment: form.autoConfirmPayment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo crear el cliente.");
      setMsg("Cliente creado.");
      setTimeout(() => {
        window.location.href = `/zona-traductor/clientes/${encodeURIComponent(form.email.trim().toLowerCase())}`;
      }, 400);
    } catch (e: any) {
      setMsg(e?.message || "Error al crear el cliente.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          className={`flex-1 min-w-[220px] ${FIELD}`}
          placeholder="Buscar cliente por nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setMsg(null);
            setOpen((v) => !v);
          }}
          className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          {open ? "Cerrar" : "+ Nuevo cliente"}
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <h2 className="text-sm font-semibold text-white">Nuevo cliente</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={FIELD} placeholder="Nombre *" value={form.name} onChange={(e) => set("name", e.target.value)} />
            <input className={FIELD} placeholder="Email *" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <input className={FIELD} placeholder="Teléfono" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" className="h-4 w-4" checked={form.isBusiness} onChange={(e) => set("isBusiness", e.target.checked)} />
            Cliente de empresa (B2B)
          </label>
          {form.isBusiness && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input className={FIELD} placeholder="Empresa / nombre comercial" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
              <input className={FIELD} placeholder="Nombre fiscal" value={form.fiscalName} onChange={(e) => set("fiscalName", e.target.value)} />
              <input className={FIELD} placeholder="NIF/CIF" value={form.nif} onChange={(e) => set("nif", e.target.value)} />
              <input className={FIELD} placeholder="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} />
              <input className={FIELD} placeholder="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <input className={FIELD} placeholder="C.P." value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-3">
                <input type="checkbox" className="h-4 w-4" checked={form.autoConfirmPayment} onChange={(e) => set("autoConfirmPayment", e.target.checked)} />
                Cliente de confianza: al subir el justificante se da el pago por bueno automáticamente
              </label>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear cliente"}
            </button>
            {msg && <span className="text-xs text-cyan-300">{msg}</span>}
          </div>
        </div>
      )}

      {!open && msg && <p className="mt-3 text-xs text-cyan-300">{msg}</p>}

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2 text-right">Pedidos</th>
              <th className="px-4 py-2 text-right">Presup.</th>
              <th className="px-4 py-2 text-right">Facturas</th>
              <th className="px-4 py-2 text-right">Cobrado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  {q ? "Ningún cliente coincide con la búsqueda." : "No hay clientes todavía."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const isWhatsapp = c.email.endsWith("@whatsapp.local");
                return (
                  <tr key={c.email} className="hover:bg-slate-900/40">
                    <td className="px-4 py-2 font-medium text-white">
                      {c.name || "—"}
                      {c.isBusiness && (
                        <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">B2B</span>
                      )}
                      {isWhatsapp && (
                        <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">WhatsApp</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{isWhatsapp ? "sin email (WhatsApp)" : c.email}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.quotes}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.invoices}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{eur(c.paidCents)}</td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={`/zona-traductor/clientes/${encodeURIComponent(c.email)}`}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                      >
                        Abrir carpeta →
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
