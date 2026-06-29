"use client";

import { useState } from "react";

// Acción de staff en la carpeta del cliente: subir las traducciones (PDF) y crear
// una ENTREGA (pedido ya entregado) para un cliente sin pedido (presupuesto/WhatsApp).
// Sube cada fichero a /api/upload (prefix=deliveries) y luego llama a
// /api/customers/deliver, que crea el pedido con los adjuntos visibles en su portal.
const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500";

async function uploadFile(file: File): Promise<{ url: string; key: string; name: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("prefix", "deliveries");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `No se pudo subir ${file.name}.`);
  return { url: data.url, key: data.pathname, name: file.name };
}

export default function ClientDeliverForm({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Traducción jurada");
  const [langPair, setLangPair] = useState("fr-es");
  const [amount, setAmount] = useState("");
  const [translations, setTranslations] = useState<File[]>([]);
  const [originals, setOriginals] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (translations.length === 0) {
      setMsg("Adjunta al menos un PDF traducido.");
      return;
    }
    setBusy(true);
    setMsg("Subiendo ficheros…");
    try {
      const tr = [];
      for (const f of translations) tr.push(await uploadFile(f));
      const or = [];
      for (const f of originals) or.push(await uploadFile(f));
      setMsg("Creando la entrega…");
      const res = await fetch("/api/customers/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: email,
          title: title.trim() || undefined,
          langPair: langPair.trim() || null,
          amountCents: amount.trim() ? Math.round((parseFloat(amount.replace(",", ".")) || 0) * 100) : null,
          translations: tr,
          originals: or,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo crear la entrega.");
      setMsg(`Entrega creada (pedido ${data.reference}). El cliente ya puede descargarla.`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      setMsg(e?.message || "Error al crear la entrega.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entregar traducción</h2>
        <button
          type="button"
          onClick={() => { setMsg(null); setOpen((v) => !v); }}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          {open ? "Cerrar" : "+ Subir traducción y entregar"}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={FIELD} placeholder="Título (p. ej. Traducción jurada)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={FIELD} placeholder="Idiomas (fr-es)" value={langPair} onChange={(e) => setLangPair(e.target.value)} />
            <input className={FIELD} placeholder="Importe € (opcional)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <label className="block text-xs text-slate-400">
            Traducciones (PDF, una o varias) *
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
              onChange={(e) => setTranslations(Array.from(e.target.files || []))}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Originales (opcional)
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
              onChange={(e) => setOriginals(Array.from(e.target.files || []))}
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Procesando…" : "Crear entrega"}
            </button>
            {msg && <span className="text-xs text-cyan-300">{msg}</span>}
          </div>
          <p className="text-xs text-slate-500">
            Crea un pedido entregado con los PDFs adjuntos; el cliente los verá y descargará desde su zona (enlace de acceso).
          </p>
        </div>
      )}
      {!open && msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
    </div>
  );
}
