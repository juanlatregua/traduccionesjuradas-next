"use client";

import { useState } from "react";

// Acción de staff en la carpeta del cliente: genera el magic-link de su zona
// para copiarlo (WhatsApp) o enviárselo por email. El enlace se firma en el
// servidor con el secreto del entorno; úsalo en PRODUCCIÓN para que el token
// valga en la web real.
export default function ClientAccessLink({ email }: { email: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchUrl(send: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/customers/portal-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, send }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo generar el enlace.");
      setUrl(data.url);
      if (send) {
        setMsg(`Enlace enviado a ${email}.`);
      } else {
        try {
          await navigator.clipboard.writeText(data.url);
          setMsg("Enlace copiado al portapapeles.");
        } catch {
          setMsg("Enlace generado (cópialo abajo).");
        }
      }
    } catch (e: any) {
      setMsg(e?.message || "Error al generar el enlace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#D5DAE1] bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#52606D]">Acceso del cliente</h2>
      <p className="mt-1 text-sm text-[#52606D]">
        Enlace personal a su zona (presupuestos, pedidos, facturas y descargas). Cópialo para WhatsApp o envíalo por email.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fetchUrl(false)}
          disabled={busy}
          className="rounded-lg bg-[#1A2E4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#243F66] disabled:opacity-50"
        >
          {busy ? "…" : "Copiar enlace de acceso"}
        </button>
        {!email.endsWith("@whatsapp.local") && (
          <button
            type="button"
            onClick={() => fetchUrl(true)}
            disabled={busy}
            className="rounded-lg border border-[#D5DAE1] px-4 py-2 text-sm font-semibold text-[#1F2933] hover:bg-[#F6F7F9] disabled:opacity-50"
          >
            Enviar por email
          </button>
        )}
      </div>
      {url && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full rounded-lg border border-[#D5DAE1] bg-white px-3 py-2 text-xs text-[#1F2933]"
        />
      )}
      {msg && <p className="mt-2 text-xs text-[#1A2E4A]">{msg}</p>}
    </div>
  );
}
