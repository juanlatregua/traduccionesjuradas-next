"use client";

import { useState } from "react";
import { Search, Loader2, AlertTriangle, CheckCircle2, Clock, FileText, CreditCard, Languages, Download } from "lucide-react";

type OrderInfo = {
  reference: string;
  title: string;
  amountCents: number;
  paymentStatus: string;
  deliveryState: string;
  dueDate: string | null;
  createdAt: string;
  translatedFileUrl: string | null;
  langPair: string | null;
};

const DELIVERY_LABELS: Record<string, string> = {
  PRESUPUESTO: "Presupuesto enviado",
  EN_PROCESO: "En traducción",
  TRADUCIDO: "Traducción lista",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendiente de pago",
  PAID: "Pagado",
  FAILED: "Pago fallido",
  REFUNDED: "Reembolsado",
};

const STEPS = [
  { key: "PENDING_PAYMENT", label: "Pago", icon: CreditCard },
  { key: "IN_PROGRESS", label: "En traducción", icon: Languages },
  { key: "TRADUCIDO", label: "Traducido", icon: FileText },
  { key: "DELIVERED", label: "Entregado", icon: Download },
];

function getActiveStep(order: OrderInfo): number {
  if (order.translatedFileUrl) return 3;
  if (order.deliveryState === "TRADUCIDO") return 2;
  if (order.deliveryState === "EN_PROCESO") return 1;
  if (order.paymentStatus === "PAID") return 1;
  return 0;
}

export default function ConsultaPedidoClient() {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);

    if (!email.trim() || !reference.trim()) {
      setError("Email y referencia son obligatorios.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/documents/lookup?email=${encodeURIComponent(email.trim())}&reference=${encodeURIComponent(reference.trim().toUpperCase())}`
      );
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Pedido no encontrado.");
        return;
      }

      setOrder(data.order);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search form */}
      {!order && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="lookup-email"
                className="block text-sm font-medium text-encre mb-1"
              >
                Tu email
              </label>
              <input
                id="lookup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="lookup-ref"
                className="block text-sm font-medium text-encre mb-1"
              >
                Referencia del pedido
              </label>
              <input
                id="lookup-ref"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="TJ-2026-XXXX"
                required
                className="w-full rounded-lg border border-graphite/20 bg-white px-4 py-2.5 text-sm text-encre placeholder:text-graphite/40 focus:border-bleu focus:ring-2 focus:ring-bleu/20 outline-none uppercase"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rouge/20 bg-rouge/5 px-4 py-3 text-sm text-rouge">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-bleu px-6 py-3 text-sm font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Consultar estado
            </button>
          </div>
        </form>
      )}

      {/* Order result */}
      {order && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header */}
          <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-graphite uppercase tracking-wide">
                  Pedido
                </p>
                <h2 className="font-baskerville text-xl text-encre">
                  {order.reference}
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${
                  order.paymentStatus === "PAID"
                    ? "bg-vert/10 text-vert"
                    : "bg-or/10 text-or"
                }`}
              >
                {order.paymentStatus === "PAID" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-graphite">Concepto</p>
                <p className="font-medium text-encre">{order.title}</p>
              </div>
              <div>
                <p className="text-xs text-graphite">Importe</p>
                <p className="font-medium text-encre">
                  {(order.amountCents / 100).toFixed(2)} EUR
                </p>
              </div>
              {order.langPair && (
                <div>
                  <p className="text-xs text-graphite">Idiomas</p>
                  <p className="font-medium text-encre">{order.langPair}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-graphite">Estado</p>
                <p className="font-medium text-encre">
                  {DELIVERY_LABELS[order.deliveryState] || order.deliveryState}
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper">
            <h3 className="font-baskerville text-lg text-encre mb-4">
              Seguimiento
            </h3>
            <div className="space-y-0">
              {STEPS.map((step, i) => {
                const activeStep = getActiveStep(order);
                const completed = i <= activeStep;
                const active = i === activeStep;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                          completed
                            ? active
                              ? "border-bleu bg-bleu text-white"
                              : "border-vert bg-vert text-white"
                            : "border-graphite/20 bg-cream text-graphite/40"
                        }`}
                      >
                        {completed && !active ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={`w-0.5 h-8 ${
                            completed ? "bg-vert" : "bg-graphite/10"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-1">
                      <p
                        className={`text-sm font-medium ${
                          active
                            ? "text-bleu"
                            : completed
                            ? "text-encre"
                            : "text-graphite/50"
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {order.dueDate && order.deliveryState !== "TRADUCIDO" && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-bleu/5 border border-bleu/10 px-4 py-3 text-sm text-bleu">
                <Clock className="h-4 w-4 shrink-0" />
                Entrega estimada:{" "}
                <strong>
                  {new Date(order.dueDate).toLocaleDateString("es-ES")}
                </strong>
              </div>
            )}

            {order.translatedFileUrl && (
              <a
                href={order.translatedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-vert px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-vert/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar traducción jurada firmada
              </a>
            )}
          </div>

          {/* New search */}
          <div className="text-center">
            <button
              onClick={() => {
                setOrder(null);
                setError(null);
              }}
              className="text-sm text-bleu hover:underline"
            >
              Consultar otro pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
