"use client";

import { useState } from "react";
import { Loader2, CreditCard, AlertTriangle, Smartphone, Landmark, Wallet } from "lucide-react";
import CopyField from "@/components/CopyField";
import PayPalButton from "@/components/PayPalButton";

const BIZUM_PHONE =
  process.env.NEXT_PUBLIC_BIZUM_IDENTIFIER || "+34 607 356 273";
const TRANSFER_IBAN =
  process.env.NEXT_PUBLIC_TRANSFER_IBAN || "ES66 0182 3370 67 0201616991";
const TRANSFER_BIC =
  process.env.NEXT_PUBLIC_TRANSFER_BIC || "BBVAESMM";
const TRANSFER_HOLDER =
  process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_HOLDER || "HBTJ Consultores Lingüísticos S.L.";

type PaymentMethod = "card" | "bizum" | "transfer" | "paypal";

type Props = {
  documentIds: string[];
  isUrgent: boolean;
  amount: number;
  onSuccess: (orderReference: string) => void;
  onCancel: () => void;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
};

function methodToApi(method: PaymentMethod): string {
  if (method === "bizum") return "BIZUM";
  if (method === "transfer") return "TRANSFER";
  if (method === "paypal") return "PAYPAL";
  return "STRIPE";
}

export default function PaymentFlow({
  documentIds,
  isUrgent,
  amount,
  onSuccess,
  onCancel,
  defaultName,
  defaultEmail,
  defaultPhone,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bizum");
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "processing">("form");
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(defaultName || "");
  const [email, setEmail] = useState(defaultEmail || "");
  const [phone, setPhone] = useState(defaultPhone || "");

  const isManual = paymentMethod === "bizum" || paymentMethod === "transfer";
  const isPayPal = paymentMethod === "paypal";

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
          documentIds,
          isUrgent,
          clientName: name.trim(),
          clientEmail: email.trim(),
          clientPhone: phone.trim() || undefined,
          paymentMethod: methodToApi(paymentMethod),
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Error al procesar el pago.");
        setStep("form");
        return;
      }

      if (isPayPal && data.orderReference) {
        setOrderReference(data.orderReference);
        setStep("form");
        return;
      } else if (isManual && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        onSuccess(data.orderReference);
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setStep("form");
    }
  };

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-bleu/15 bg-card p-8 shadow-paper animate-fadeIn">
        <Loader2 className="h-10 w-10 text-bleu animate-spin" />
        <p className="font-baskerville text-lg text-bleu">
          {isManual
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
      <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-cream/60 p-1">
        {([
          { key: "bizum" as const, icon: Smartphone, label: "Bizum" },
          { key: "card" as const, icon: CreditCard, label: "Tarjeta" },
          { key: "transfer" as const, icon: Landmark, label: "Transfer." },
          { key: "paypal" as const, icon: Wallet, label: "PayPal" },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setPaymentMethod(key); setError(null); setOrderReference(null); }}
            className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-2.5 text-xs font-medium transition-all ${
              paymentMethod === key
                ? "bg-white text-bleu shadow-sm"
                : "text-graphite hover:text-encre"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Bizum info */}
      {paymentMethod === "bizum" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-encre">Datos para el Bizum:</p>
          <CopyField label="Teléfono Bizum" value={BIZUM_PHONE} />
          <CopyField
            label="Importe"
            value={`${amount.toFixed(2)} €`}
            copyValue={amount.toFixed(2)}
          />
          <p className="text-xs text-graphite">
            Al confirmar, se te redirigirá a una página donde podrás realizar el
            Bizum y subir el comprobante.
          </p>
        </div>
      )}

      {/* Transfer info */}
      {paymentMethod === "transfer" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-encre">Datos bancarios:</p>
          <CopyField label="Beneficiario" value={TRANSFER_HOLDER} mono={false} />
          <CopyField label="IBAN" value={TRANSFER_IBAN} />
          <CopyField label="BIC / SWIFT" value={TRANSFER_BIC} />
          <CopyField
            label="Importe"
            value={`${amount.toFixed(2)} €`}
            copyValue={amount.toFixed(2)}
          />
          <p className="text-xs text-graphite">
            Al confirmar, se te redirigirá a una página donde podrás subir el
            comprobante de transferencia.
          </p>
        </div>
      )}

      {/* PayPal */}
      {paymentMethod === "paypal" && orderReference && (
        <div className="mt-4">
          <PayPalButton
            reference={orderReference}
            onSuccess={() => onSuccess(orderReference)}
          />
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
          <button
            type="submit"
            disabled={isPayPal && !!orderReference}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-bleu px-6 py-2.5 text-sm font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paymentMethod === "card" && <><CreditCard className="h-4 w-4" /> Pagar con tarjeta</>}
            {paymentMethod === "bizum" && <><Smartphone className="h-4 w-4" /> Confirmar y pagar por Bizum</>}
            {paymentMethod === "transfer" && <><Landmark className="h-4 w-4" /> Confirmar y pagar por transferencia</>}
            {paymentMethod === "paypal" && !orderReference && <><Wallet className="h-4 w-4" /> Continuar con PayPal</>}
            {paymentMethod === "paypal" && orderReference && <><Wallet className="h-4 w-4" /> Usa el botón de PayPal arriba</>}
          </button>
        </div>
      </form>

      <p className="mt-4 text-center text-[11px] text-graphite/60">
        {paymentMethod === "card" && "Pago seguro con Stripe. Tus datos bancarios no se almacenan en nuestros servidores."}
        {paymentMethod === "paypal" && "Pago seguro con PayPal. Serás redirigido para completar el pago."}
        {(paymentMethod === "bizum" || paymentMethod === "transfer") && "Tras confirmar, podrás completar el pago y subir el comprobante."}
      </p>
    </div>
  );
}
