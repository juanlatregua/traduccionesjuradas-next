"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import PayPalButton from "@/components/PayPalButton";

type OrderInfo = {
  reference: string;
  title: string;
  amountCents: number;
  paymentStatus: string;
};

const MANUAL_PAYMENT = {
  bizumPhone: "+34 607 356 273",
  accountHolder: "HBTJ Consultores Lingüísticos S.L.",
  iban: "ES66 0182 3370 67 0201616991",
  bic: "BBVAESMM",
  paypalMe: "https://paypal.me/traduccionesjurada",
};

const PAYMENT_FEATURES = {
  redsys: process.env.NEXT_PUBLIC_ENABLE_REDSYS === "true",
  paypal: process.env.NEXT_PUBLIC_ENABLE_PAYPAL === "true",
};

export default function PagarPage() {
  const router = useRouter();
  const params = useParams<{ reference: string }>();
  const reference = params.reference;

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tarjeta" | "paypal" | "bizum" | "transferencia">("bizum");
  const [redsysSubmitting, setRedsysSubmitting] = useState(false);
  const redsysFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch(`/api/orders/${reference}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setOrder(data.order);
        } else {
          setError(data.error || "Pedido no encontrado.");
        }
      })
      .catch(() => setError("Error de conexion."))
      .finally(() => setLoading(false));
  }, [reference]);

  function formatMoney(cents: number) {
    return `${(cents / 100).toFixed(2)} EUR`;
  }

  async function handleRedsys() {
    setRedsysSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/redsys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al iniciar pago.");
        setRedsysSubmitting(false);
        return;
      }
      // Auto-submit form to Redsys
      const form = redsysFormRef.current;
      if (form) {
        (form.querySelector("[name=Ds_SignatureVersion]") as HTMLInputElement).value = data.Ds_SignatureVersion;
        (form.querySelector("[name=Ds_MerchantParameters]") as HTMLInputElement).value = data.Ds_MerchantParameters;
        (form.querySelector("[name=Ds_Signature]") as HTMLInputElement).value = data.Ds_Signature;
        form.action = data.url;
        form.submit();
      }
    } catch {
      setError("Error de conexion al iniciar pago.");
      setRedsysSubmitting(false);
    }
  }

  function handlePayPalSuccess() {
    router.push(`/pago/exito?ref=${reference}`);
  }

  const tabs = useMemo(
    () => [
      ...(PAYMENT_FEATURES.redsys ? [{ id: "tarjeta" as const, label: "Tarjeta" }] : []),
      ...(PAYMENT_FEATURES.paypal ? [{ id: "paypal" as const, label: "PayPal" }] : []),
      { id: "bizum" as const, label: "Bizum" },
      { id: "transferencia" as const, label: "Transferencia" },
    ],
    []
  );

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [tab, tabs]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-slate-600">Cargando datos del pedido...</p>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm text-red-600">{error}</p>
          <Link href="/area-cliente" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Volver al area de cliente
          </Link>
        </section>
      </main>
    );
  }

  if (!order) return null;

  if (order.paymentStatus === "PAID") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-emerald-700">Este pedido ya esta pagado.</p>
          <Link href={`/area-cliente/pedido/${reference}`} className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Ver detalle del pedido
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Pagar pedido
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          {order.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Referencia: <span className="font-mono">{order.reference}</span> · Importe:{" "}
          <span className="font-semibold">{formatMoney(order.amountCents)}</span>
        </p>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-blue-700 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!PAYMENT_FEATURES.redsys || !PAYMENT_FEATURES.paypal ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Algunos metodos online estan en configuracion. Puedes completar tu pedido ahora mismo por Bizum o transferencia.
          </p>
        ) : null}

        {/* Tarjeta (Redsys) */}
        {tab === "tarjeta" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Seras redirigido a la pasarela bancaria segura (Redsys) para completar el pago con tarjeta.
            </p>
            <button
              type="button"
              onClick={handleRedsys}
              disabled={redsysSubmitting}
              className="mt-4 rounded-2xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {redsysSubmitting ? "Redirigiendo..." : "Pagar con tarjeta"}
            </button>
            {/* Hidden form for Redsys redirect */}
            <form ref={redsysFormRef} method="POST" className="hidden">
              <input type="hidden" name="Ds_SignatureVersion" />
              <input type="hidden" name="Ds_MerchantParameters" />
              <input type="hidden" name="Ds_Signature" />
            </form>
          </div>
        )}

        {/* PayPal */}
        {tab === "paypal" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700 mb-4">
              Paga de forma segura con tu cuenta PayPal.
            </p>
            <a
              href={`${MANUAL_PAYMENT.paypalMe}/${(order.amountCents / 100).toFixed(2)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 inline-flex rounded-2xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Pagar con PayPal.Me
            </a>
            <PayPalButton reference={reference} onSuccess={handlePayPalSuccess} />
          </div>
        )}

        {/* Bizum */}
        {tab === "bizum" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Realiza un Bizum con los siguientes datos. Una vez realizado, confirmaremos el pago manualmente.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Telefono:</span>{" "}
                <span className="font-mono">{MANUAL_PAYMENT.bizumPhone}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Concepto:</span>{" "}
                <span className="font-mono">{order.reference}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Importe:</span>{" "}
                <span className="font-mono">{formatMoney(order.amountCents)}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Importante: incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto del Bizum para que podamos identificar tu pago.
            </p>
          </div>
        )}

        {/* Transferencia */}
        {tab === "transferencia" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Realiza una transferencia bancaria con los siguientes datos. Confirmaremos el pago una vez recibido.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-sm">
                <span className="font-semibold">Titular:</span> {MANUAL_PAYMENT.accountHolder}
              </p>
              <p className="text-sm">
                <span className="font-semibold">IBAN:</span>{" "}
                <span className="font-mono">{MANUAL_PAYMENT.iban}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">BIC/SWIFT:</span>{" "}
                <span className="font-mono">{MANUAL_PAYMENT.bic}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Concepto:</span>{" "}
                <span className="font-mono">{order.reference}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold">Importe:</span>{" "}
                <span className="font-mono">{formatMoney(order.amountCents)}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Importante: incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto de la transferencia.
            </p>
          </div>
        )}

        <div className="mt-6">
          <Link href={`/area-cliente/pedido/${reference}`} className="text-sm font-semibold text-emerald-700 hover:underline">
            Volver al detalle del pedido
          </Link>
        </div>
      </section>
    </main>
  );
}
