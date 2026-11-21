"use client";

import { useState } from "react";
import { uploadStaffFile } from "@/lib/staff-upload-client";

// Acción de staff en la carpeta del cliente: subir las traducciones (PDF) y crear
// una ENTREGA para un cliente sin pedido (presupuesto/WhatsApp). Compone los
// chokepoints canónicos (no clona): /api/customers/deliver crea el pedido, lo sella
// como entregado, y —si "ya ha pagado"— lo marca cobrado y dispara el aviso normal.
const FIELD = "rounded-lg border border-[#D5DAE1] bg-white px-3 py-2 text-sm text-[#1F2933] placeholder:text-[#8A96A3]";

async function uploadFile(file: File): Promise<{ url: string; key: string; name: string }> {
  const up = await uploadStaffFile(file, "deliveries");
  return { url: up.url, key: up.pathname, name: up.name };
}

export default function ClientDeliverForm({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Traducción jurada");
  const [langPair, setLangPair] = useState("fr-es");
  const [amount, setAmount] = useState("");
  const [translations, setTranslations] = useState<File[]>([]);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [notifyClient, setNotifyClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isWhatsapp = email.endsWith("@whatsapp.local");

  async function submit() {
    if (translations.length === 0) {
      setMsg("Adjunta al menos un PDF traducido.");
      return;
    }
    if (alreadyPaid && !amount.trim()) {
      setMsg("Indica el importe cobrado para marcarlo como pagado.");
      return;
    }
    setBusy(true);
    setMsg("Subiendo ficheros…");
    try {
      const tr = [];
      for (const f of translations) tr.push(await uploadFile(f));
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
          alreadyPaid,
          notifyClient,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `No se pudo crear la entrega (error ${res.status}).`);
      setMsg(`Entrega creada (pedido ${data.reference}). El cliente ya puede descargarla.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      setMsg(e?.message || "Error al crear la entrega.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#D5DAE1] bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#52606D]">Entregar traducción</h2>
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
            <input className={FIELD} placeholder="Importe € (cobrado)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <label className="block text-xs text-[#52606D]">
            Traducciones (PDF, una o varias) *
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="mt-1 block w-full text-sm text-[#1F2933] file:mr-3 file:rounded-md file:border-0 file:bg-[#F6F7F9] file:px-3 file:py-1.5 file:text-[#1A2E4A]"
              onChange={(e) => setTranslations(Array.from(e.target.files || []))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#1F2933]">
            <input type="checkbox" className="h-4 w-4" checked={alreadyPaid} onChange={(e) => setAlreadyPaid(e.target.checked)} />
            El cliente ya ha pagado (transferencia) — lo marca cobrado y dispara el aviso de traducción lista
          </label>
          {!isWhatsapp && alreadyPaid && (
            <label className="flex items-center gap-2 text-sm text-[#1F2933]">
              <input type="checkbox" className="h-4 w-4" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
              Enviar email al cliente con la traducción adjunta
            </label>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Procesando…" : "Crear entrega"}
            </button>
            {msg && <span className="text-xs text-[#1A2E4A]">{msg}</span>}
          </div>
          <p className="text-xs text-[#52606D]">
            Crea un pedido entregado con los PDFs adjuntos; el cliente los descarga desde su zona (enlace de acceso).
            {isWhatsapp ? " Cliente de WhatsApp: mándale tú el enlace de acceso por WhatsApp." : ""}
          </p>
        </div>
      )}
      {!open && msg && <p className="mt-2 text-xs text-[#1A2E4A]">{msg}</p>}
    </div>
  );
}
