"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWorkflowStateLabel } from "@/lib/client-area";

type OrderResult = {
  reference: string;
  title: string;
  langPair?: string;
  amountCents: number;
  currency: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  paidAt?: string;
  words?: number;
  pagesLabel?: string;
  dueDate?: string;
  deliveryState?: string;
  events?: Array<{ type: string; message: string; createdAt: string; payload?: any }>;
  workflowState?: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente de pago", color: "text-amber-700 bg-amber-50 border-amber-200" },
  PAID: { label: "Pagado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  IN_PROGRESS: { label: "En proceso", color: "text-blue-700 bg-blue-50 border-blue-200" },
  DELIVERED: { label: "Entregado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  CANCELLED: { label: "Cancelado", color: "text-red-700 bg-red-50 border-red-200" },
  FAILED: { label: "Fallido", color: "text-red-700 bg-red-50 border-red-200" },
};

const DELIVERY_LABELS: Record<string, string> = {
  PRESUPUESTO: "Presupuesto enviado",
  EN_PROCESO: "En proceso de traduccion",
  TRADUCIDO: "Traduccion lista",
};

export default function GuestOrderLookup() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get("ref") || "").trim();
    const prefillEmail = (params.get("email") || "").trim().toLowerCase();
    if (ref && !reference) setReference(ref);
    if (prefillEmail && !email) setEmail(prefillEmail);
  }, [reference, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOrder(null);

    const ref = reference.trim();
    const em = email.trim().toLowerCase();
    if (!ref || !em) {
      setError("Introduce la referencia y el email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref, email: em }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Pedido no encontrado.");
      } else {
        setOrder(data.order);
      }
    } catch {
      setError("Error de conexion. Intentalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function formatMoney(cents: number) {
    return `${(cents / 100).toFixed(2)} EUR`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="guest-reference" className="block text-sm font-semibold text-slate-700">
            Referencia del pedido
          </label>
          <input
            id="guest-reference"
            type="text"
            placeholder="Ej: 26_ABC123"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="guest-email" className="block text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            id="guest-email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Consultando..." : "Consultar pedido"}
        </button>
      </form>

      {order && (
        <div className="mt-8 space-y-4">
          {(() => {
            const hasProof = !!order.events?.some((ev) => ev.type === "payment.proof_uploaded");
            const paymentCheckLabel =
              order.paymentStatus === "PAID"
                ? "Pago confirmado"
                : hasProof
                ? "Comprobante enviado (pendiente de verificacion)"
                : "Pendiente de pago";
            return (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                <p className="text-sm font-semibold text-cyan-900">
                  Verificacion de pago: {paymentCheckLabel}
                </p>
              </div>
            );
          })()}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{order.title}</h2>
              {(() => {
                const s = STATUS_LABELS[order.paymentStatus] || STATUS_LABELS[order.status];
                return s ? (
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.color}`}>
                    {s.label}
                  </span>
                ) : null;
              })()}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-semibold text-slate-600">Referencia:</span>{" "}
                <span className="font-mono">{order.reference}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Importe:</span>{" "}
                <span className="font-semibold">{formatMoney(order.amountCents)}</span>
              </div>
              {order.langPair && (
                <div>
                  <span className="font-semibold text-slate-600">Idiomas:</span> {order.langPair}
                </div>
              )}
              {order.words && (
                <div>
                  <span className="font-semibold text-slate-600">Palabras:</span> {order.words}
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-600">Creado:</span> {formatDate(order.createdAt)}
              </div>
              {order.paidAt && (
                <div>
                  <span className="font-semibold text-slate-600">Pagado:</span> {formatDate(order.paidAt)}
                </div>
              )}
              {order.dueDate && (
                <div>
                  <span className="font-semibold text-slate-600">ETA:</span> {formatDate(order.dueDate)}
                </div>
              )}
              {order.workflowState && (
                <div className="col-span-2">
                  <span className="font-semibold text-slate-600">Workflow:</span>{" "}
                  {getWorkflowStateLabel(order.workflowState)}
                </div>
              )}
            </div>

            {order.deliveryState && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-sm font-semibold text-blue-800">
                  Estado de entrega: {DELIVERY_LABELS[order.deliveryState] || order.deliveryState}
                </p>
              </div>
            )}

            {order.deliveryState === "TRADUCIDO" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-sm text-emerald-800">
                  Tu traduccion esta lista. Para descargarla, accede a tu{" "}
                  <Link href="/area-cliente" className="font-semibold underline">
                    area de cliente
                  </Link>{" "}
                  iniciando sesion.
                </p>
              </div>
            )}

            {order.workflowState === "PENDIENTE_REVISION" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm text-amber-800">
                  Este pedido esta en revision interna. Te avisaremos por email cuando este listo para pago.
                </p>
              </div>
            )}

            {order.paymentStatus === "PENDING" &&
              ["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO", "PRESUPUESTO_ENVIADO", ""].includes(
                String(order.workflowState || "")
              ) && (
              <div className="mt-2">
                <Link
                  href={`/area-cliente/pedido/${order.reference}/pagar`}
                  className="inline-block rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Ir al pago
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
