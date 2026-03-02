"use client";

import { useState } from "react";
import { Loader2, Mail, Sparkles, AlertTriangle } from "lucide-react";

type Props = {
  documentId: string;
  onComplete: (data: { name: string; email: string; phone: string }) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeadGate({ documentId, onComplete }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }

    if (!EMAIL_RE.test(email.trim())) {
      setError("Email no válido.");
      return;
    }

    if (!consent) {
      setError("Debes aceptar para continuar.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/documents/${documentId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: name.trim(),
          clientEmail: email.trim(),
          clientPhone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Error al guardar los datos.");
        setLoading(false);
        return;
      }

      onComplete({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper animate-fadeIn">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-or/10">
          <Sparkles className="h-5 w-5 text-or" />
        </div>
        <div>
          <h3 className="font-baskerville text-xl text-encre">
            Tu documento está listo
          </h3>
          <p className="text-sm text-graphite">
            Analizamos tu documento con IA y te enviamos el presupuesto detallado por email.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="lead-name"
            className="block text-sm font-medium text-encre mb-1"
          >
            Nombre completo *
          </label>
          <input
            id="lead-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan García López"
            required
            className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="lead-email"
            className="block text-sm font-medium text-encre mb-1"
          >
            Email *
          </label>
          <input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="lead-phone"
            className="block text-sm font-medium text-encre mb-1"
          >
            Teléfono / WhatsApp{" "}
            <span className="text-graphite font-normal">(opcional)</span>
          </label>
          <input
            id="lead-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none transition-colors"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-graphite/40 text-bleu focus:ring-bleu"
          />
          <span className="text-xs text-graphite leading-relaxed">
            Acepto recibir el presupuesto y comunicaciones sobre mi traducción.{" "}
            <a href="/privacidad" className="text-bleu underline" target="_blank">
              Política de privacidad
            </a>
            .
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rouge/20 bg-rouge/5 px-4 py-3 text-sm text-rouge">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-or px-6 py-3.5 text-base font-semibold text-white shadow-md hover:bg-or-light transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Mail className="h-5 w-5" />
          )}
          Ver mi presupuesto
        </button>
      </form>
    </div>
  );
}
