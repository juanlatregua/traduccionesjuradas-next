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
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acceso del cliente</h2>
      <p className="mt-1 text-sm text-slate-400">
        Enlace personal a su zona (presupuestos, pedidos, facturas y descargas). Cópialo para WhatsApp o envíalo por email.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fetchUrl(false)}
          disabled={busy}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {busy ? "…" : "Copiar enlace de acceso"}
        </button>
        {!email.endsWith("@whatsapp.local") && (
          <button
            type="button"
            onClick={() => fetchUrl(true)}
            disabled={busy}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
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
          className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-300"
        />
      )}
      {msg && <p className="mt-2 text-xs text-cyan-300">{msg}</p>}
    </div>
  );
}
