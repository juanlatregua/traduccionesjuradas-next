"use client";

import { useState } from "react";

type Props = {
  token: string;
  defaultPrice?: string;
  defaultDeadline?: string;
  defaultNotes?: string;
};

export default function CollaboratorQuoteForm({ token, defaultPrice, defaultDeadline, defaultNotes }: Props) {
  const isRevision = !!(defaultPrice || defaultDeadline || defaultNotes);
  const [price, setPrice] = useState(defaultPrice || "");
  const [deadline, setDeadline] = useState(defaultDeadline || "");
  const [notes, setNotes] = useState(defaultNotes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Introduce un precio válido.");
      return;
    }
    if (!deadline) {
      setError("Selecciona una fecha de entrega.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/encargo/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          priceCents: Math.round(priceNum * 100),
          deadline,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al enviar presupuesto.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center">
        <p className="text-lg font-semibold text-emerald-900">
          Presupuesto enviado correctamente
        </p>
        <p className="mt-2 text-sm text-emerald-700">
          Te notificaremos cuando haya una respuesta.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-encre">
        {isRevision ? "Enviar presupuesto revisado" : "Enviar presupuesto"}
      </h2>
      <p className="mt-1 text-sm text-sepia">
        {isRevision
          ? "Ajusta el precio o plazo y envía tu presupuesto actualizado."
          : "Revisa los documentos e indica tu precio y plazo de entrega."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-encre">
            Precio (€)
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-lg border border-cream bg-white px-3 py-2 text-sm text-encre focus:border-bleu focus:outline-none focus:ring-1 focus:ring-bleu"
            required
          />
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-encre">
            Fecha de entrega prevista
          </label>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-cream bg-white px-3 py-2 text-sm text-encre focus:border-bleu focus:outline-none focus:ring-1 focus:ring-bleu"
            required
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-encre">
            Notas (opcional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Observaciones sobre el encargo..."
            className="mt-1 block w-full rounded-lg border border-cream bg-white px-3 py-2 text-sm text-encre focus:border-bleu focus:outline-none focus:ring-1 focus:ring-bleu"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-bleu px-4 py-2.5 text-sm font-semibold text-white hover:bg-bleu/90 disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Enviar presupuesto"}
        </button>
      </form>
    </div>
  );
}
