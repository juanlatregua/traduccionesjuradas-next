"use client";

import { useState } from "react";
import { Loader2, Mail, Sparkles, AlertTriangle, FileText, Plus, ArrowRight } from "lucide-react";
import { VAT_RATE } from "@/lib/pricing-engine/calculator";

export type PendingDoc = {
  id: string;
  specificTypeEs: string;
  sourceName: string;
  targetName: string;
  basePrice: number;
  urgentPrice: number;
  analysisJson: any;
  quoteBreakdown: any;
  estimatedDays: string | null;
  estimatedDaysUrgent: string | null;
};

type Props = {
  documentId: string;
  documentIds?: string[];
  onComplete: (data: { name: string; email: string; phone: string; notes: string }) => void;
  onMergePending: (pendingDocs: PendingDoc[]) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string {
  if (!value) return "El email es obligatorio";
  if (!EMAIL_RE.test(value)) return "Introduce un email válido";
  return "";
}

export default function LeadGate({ documentId, documentIds, onComplete, onMergePending }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const [pendingDocs, setPendingDocs] = useState<PendingDoc[] | null>(null);
  const [showMergeBanner, setShowMergeBanner] = useState(false);

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
      const allIds = documentIds && documentIds.length > 0 ? documentIds : [documentId];
      const contactData = {
        clientName: name.trim(),
        clientEmail: email.trim(),
        clientPhone: phone.trim() || undefined,
      };

      const results = await Promise.all(
        allIds.map((id) =>
          fetch(`/api/documents/${id}/contact`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contactData),
          }).then((r) => r.json())
        )
      );

      const failed = results.find((r) => !r.ok);
      if (failed) {
        setError(failed.error || "Error al guardar los datos.");
        setLoading(false);
        return;
      }

      // Check for pending documents from previous sessions
      const excludeParam = allIds.join(",");
      const pendingRes = await fetch(
        `/api/documents/pending-by-email?email=${encodeURIComponent(email.trim())}&exclude=${encodeURIComponent(excludeParam)}`
      ).then((r) => r.json()).catch(() => ({ ok: false }));

      if (pendingRes.ok && pendingRes.documents && pendingRes.documents.length > 0) {
        setPendingDocs(pendingRes.documents);
        setShowMergeBanner(true);
        setLoading(false);
        return;
      }

      onComplete({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      });
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const handleMerge = () => {
    if (pendingDocs) {
      onMergePending(pendingDocs);
    }
    onComplete({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
    });
  };

  const handleSkipMerge = () => {
    setShowMergeBanner(false);
    onComplete({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
    });
  };

  if (showMergeBanner && pendingDocs && pendingDocs.length > 0) {
    return (
      <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper animate-fadeIn">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bleu/10">
            <FileText className="h-5 w-5 text-bleu" />
          </div>
          <div>
            <h3 className="font-baskerville text-xl text-encre">
              {pendingDocs.length === 1
                ? "Tienes 1 documento pendiente"
                : `Tienes ${pendingDocs.length} documentos pendientes`}
            </h3>
            <p className="text-sm text-graphite">de una visita anterior</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {pendingDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-cream bg-cream/30 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-graphite shrink-0" />
                <span className="text-sm font-medium text-encre">
                  {doc.specificTypeEs}
                </span>
              </div>
              <span className="text-sm text-graphite">
                {doc.sourceName} → {doc.targetName} · {(doc.basePrice * (1 + VAT_RATE)).toFixed(2)}€
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleMerge}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-bleu px-6 py-3.5 text-base font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors"
          >
            <Plus className="h-5 w-5" />
            Añadir al presupuesto actual
          </button>
          <button
            onClick={handleSkipMerge}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-graphite/20 px-6 py-3 text-sm font-medium text-graphite hover:bg-cream/50 transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            Continuar sin añadir
          </button>
        </div>
      </div>
    );
  }

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
            Introduce tus datos para ver el presupuesto detallado.
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
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailTouched) setEmailError(validateEmail(e.target.value));
            }}
            onBlur={() => {
              setEmailTouched(true);
              setEmailError(validateEmail(email));
            }}
            placeholder="tu@email.com"
            required
            className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:ring-2 outline-none transition-colors ${
              emailError && emailTouched
                ? "border-rouge focus:border-rouge focus:ring-rouge/20"
                : "border-graphite/20 focus:border-bleu focus:ring-bleu/20"
            }`}
          />
          {emailError && emailTouched && (
            <p className="text-rouge text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {emailError}
            </p>
          )}
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

        <div>
          <label
            htmlFor="lead-notes"
            className="block text-sm font-medium text-encre mb-1"
          >
            Observaciones{" "}
            <span className="text-graphite font-normal">(opcional)</span>
          </label>
          <textarea
            id="lead-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Necesito apostilla, el documento tiene sellos, necesito entrega urgente..."
            rows={3}
            className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none transition-colors resize-none"
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
          disabled={loading || !!emailError || !consent || !email || !name}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-or px-6 py-3.5 text-base font-semibold text-white shadow-md hover:bg-or-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
