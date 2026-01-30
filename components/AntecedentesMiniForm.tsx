"use client";

import { useState, useRef } from "react";

const OPTIONS = [
  { id: "es-en", label: "Español → Inglés", price: "50 €", plazo: "2 días" },
  { id: "es-fr", label: "Español → Francés", price: "45 €", plazo: "1 día" },
  { id: "pt-es", label: "Portugués (apostillado) → Español", price: "75 €", plazo: "2 días" },
  { id: "fr-es", label: "Francés (apostillado) → Español", price: "40 €", plazo: "1 día" },
];

export function AntecedentesMiniForm() {
  const [pair, setPair] = useState(OPTIONS[0]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    if (!email || !file) {
      setToast({ type: "error", msg: "Añade tu email y el documento para calcular." });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("nombre", nombre || "");
      fd.append("email", email);
      fd.append("idiomaOrigen", pair.id === "pt-es" || pair.id === "fr-es" ? pair.label.split(" → ")[0] : "español");
      fd.append("idiomaDestino", pair.id === "es-en" ? "inglés" : pair.id === "es-fr" ? "francés" : "español");
      fd.append("tipoDocumento", `Antecedentes penales (${pair.label})`);
      fd.append("plazo", pair.plazo);
      fd.append("aceptaPrivacidad", "true");
      fd.append("files", file);

      const res = await fetch("/api/presupuesto", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al enviar");
      setToast({ type: "ok", msg: "Recibido. Te confirmamos precio y pago en unos minutos." });
      setEmail("");
      setNombre("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message || "No se pudo enviar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Precio orientativo</p>
          <p className="text-sm font-semibold text-slate-900">{pair.label}: {pair.price} · {pair.plazo}</p>
        </div>
        <select
          value={pair.id}
          onChange={(e) => setPair(OPTIONS.find((o) => o.id === e.target.value) || OPTIONS[0])}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
        >
          {OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.price})
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3 text-sm text-slate-700">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-600">Nombre (opcional)</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Email para enviarte el precio</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-600">Adjuntar certificado (PDF o foto)</label>
          <input
            ref={fileRef}
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-xs"
          />
          {file && (
            <p className="mt-1 text-xs text-slate-500">
              Archivo: {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Enviando..." : "Enviar y confirmar pago/plazo"}
        </button>

        {toast && (
          <p
            className={`text-xs font-semibold ${
              toast.type === "ok" ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {toast.msg}
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          Usamos tus archivos solo para prepararte el presupuesto y confirmarte el pago/plazo. Se borran en 30 días o antes si lo pides.
        </p>
        <p className="text-[11px] text-slate-500">
          Precio orientativo: lo confirmamos al revisar el documento. Para otros idiomas o casos especiales, usa el{" "}
          <a href="/presupuesto" className="text-emerald-700 underline">
            formulario completo
          </a>
          .
        </p>
      </form>
    </div>
  );
}
