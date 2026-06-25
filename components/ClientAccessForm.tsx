"use client";

import { useState } from "react";

export default function ClientAccessForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/area-cliente/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 200) throw new Error(d?.error || "No se pudo enviar.");
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "No se pudo enviar el enlace.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <p className="rounded-2xl border border-cream bg-parchment px-4 py-3 text-sm text-sepia">
        Si hay pedidos o presupuestos asociados a ese email, te hemos enviado un <strong>enlace de acceso</strong>. Revisa tu correo (y la carpeta de spam).
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        className="w-full rounded-2xl border border-cream bg-white px-4 py-2 text-sm text-encre"
      />
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 rounded-2xl bg-bleu px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar enlace de acceso"}
      </button>
      {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
    </form>
  );
}
