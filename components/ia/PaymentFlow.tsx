"use client";

import { useState } from "react";
import { Loader2, CreditCard, AlertTriangle, Smartphone } from "lucide-react";
import CopyField from "@/components/CopyField";

const BIZUM_PHONE =
  process.env.NEXT_PUBLIC_BIZUM_IDENTIFIER || "+34 607 356 273";

type Props = {
  documentId: string;
  isUrgent: boolean;
  amount: number;
  onSuccess: (orderReference: string) => void;
  onCancel: () => void;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
};

export default function PaymentFlow({
  documentId,
  isUrgent,
  amount,
  onSuccess,
  onCancel,
  defaultName,
  defaultEmail,
  defaultPhone,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bizum">("card");
  const [step, setStep] = useState<"form" | "processing" | "error">("form");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(defaultName || "");
  const [email, setEmail] = useState(defaultEmail || "");
  const [phone, setPhone] = useState(defaultPhone || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email no válido.");
      return;
    }

    setStep("processing");
    setError(null);

    try {
      const res = await fetch("/api/documents/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          isUrgent,
          clientName: name.trim(),
          clientEmail: email.trim(),
          clientPhone: phone.trim() || undefined,
          paymentMethod: paymentMethod === "bizum" ? "BIZUM" : "STRIPE",
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Error al procesar el pago.");
        setStep("error");
        return;
      }

      if (paymentMethod === "bizum" && data.paymentUrl) {
        // Redirect to manual payment page (Bizum proof upload)
        window.location.href = data.paymentUrl;
      } else if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        onSuccess(data.orderReference);
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setStep("error");
    }
  };

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-bleu/15 bg-card p-8 shadow-paper animate-fadeIn">
        <Loader2 className="h-10 w-10 text-bleu animate-spin" />
        <p className="font-baskerville text-lg text-bleu">
          {paymentMethod === "bizum"
            ? "Creando tu pedido..."
            : "Preparando pasarela de pago..."}
        </p>
        <p className="text-sm text-graphite">No cierres esta página.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper animate-fadeIn">
      <h3 className="font-baskerville text-xl text-encre flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-bleu" />
        Método de pago
      </h3>
      <p className="mt-1 text-sm text-graphite">
        Elige cómo prefieres pagar tu traducción jurada.
      </p>

      {/* Payment method tabs */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-cream/60 p-1">
        <button
          type="button"
          onClick={() => {
            setPaymentMethod("card");
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
            paymentMethod === "card"
              ? "bg-white text-bleu shadow-sm"
              : "text-graphite hover:text-encre"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Tarjeta
        </button>
        <button
          type="button"
          onClick={() => {
            setPaymentMethod("bizum");
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all ${
            paymentMethod === "bizum"
              ? "bg-white text-bleu shadow-sm"
              : "text-graphite hover:text-encre"
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Bizum
        </button>
      </div>

      {/* Bizum info (only when Bizum selected) */}
      {paymentMethod === "bizum" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-encre">
            Datos para el Bizum:
          </p>
          <CopyField label="Teléfono Bizum" value={BIZUM_PHONE} />
          <CopyField
            label="Importe"
            value={`${amount.toFixed(2)} €`}
            copyValue={amount.toFixed(2)}
          />
          <p className="text-xs text-graphite">
            Al confirmar el pedido, se te redirigirá a una página donde podrás
            realizar el Bizum y subir el comprobante.
          </p>
        </div>
      )}

      {/* Contact form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <p className="text-sm font-medium text-encre">Datos de contacto</p>
        <div>
          <label
            htmlFor="ia-name"
            className="block text-sm font-medium text-encre mb-1"
          >
            Nombre completo *
          </label>
          <input
            id="ia-name"
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
            htmlFor="ia-email"
            className="block text-sm font-medium text-encre mb-1"
          >
            Email *
          </label>
          <input
            id="ia-email"
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
            htmlFor="ia-phone"
            className="block text-sm font-medium text-encre mb-1"
          >
            Teléfono / WhatsApp{" "}
            <span className="text-graphite font-normal">(opcional)</span>
          </label>
          <input
            id="ia-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rouge/20 bg-rouge/5 px-4 py-3 text-sm text-rouge">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-graphite/20 px-5 py-2.5 text-sm font-medium text-graphite hover:bg-cream transition-colors"
          >
            Volver
          </button>
          {paymentMethod === "card" ? (
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-bleu px-6 py-2.5 text-sm font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Pagar con tarjeta
            </button>
          ) : (
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-bleu px-6 py-2.5 text-sm font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              Confirmar y pagar por Bizum
            </button>
          )}
        </div>
      </form>

      <p className="mt-4 text-center text-[11px] text-graphite/60">
        {paymentMethod === "card"
          ? "Pago seguro con Stripe. Tus datos bancarios no se almacenan en nuestros servidores."
          : "Tras confirmar, podrás realizar el Bizum y subir el comprobante de pago."}
      </p>
    </div>
  );
}
