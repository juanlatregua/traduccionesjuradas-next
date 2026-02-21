"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
};

export default function PagarPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"bizum" | "transferencia">("bizum");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofSent, setProofSent] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${reference}`)
      .then((r) => {
        if (r.status === 401) return fetch(`/api/orders/${reference}/public`);
        return r;
      })
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

  async function handleUploadProof() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/orders/${reference}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Error al subir el comprobante.");
      }
      setProofSent(true);
    } catch (err: any) {
      setUploadError(err?.message || "Error al subir el comprobante.");
    } finally {
      setUploading(false);
    }
  }

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
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Volver al inicio
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
          <Link href="/consulta" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline">
            Consultar estado del pedido
          </Link>
        </section>
      </main>
    );
  }

  // After proof uploaded successfully
  if (proofSent) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-emerald-800">Comprobante recibido</h2>
          <p className="mt-2 text-sm text-emerald-700">
            Hemos recibido tu comprobante de pago para el pedido <span className="font-mono font-semibold">{reference}</span>.
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            Verificaremos el pago y recibiras una actualizacion por email en breve.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/consulta"
              className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Consultar estado del pedido
            </Link>
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              Volver al inicio
            </Link>
          </div>
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
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("bizum")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "bizum"
                ? "bg-blue-700 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Bizum
          </button>
          <button
            type="button"
            onClick={() => setTab("transferencia")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              tab === "transferencia"
                ? "bg-blue-700 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Transferencia
          </button>
        </div>

        {/* Bizum */}
        {tab === "bizum" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Realiza un Bizum con los siguientes datos:
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
              Incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto.
            </p>
          </div>
        )}

        {/* Transferencia */}
        {tab === "transferencia" && (
          <div className="mt-6">
            <p className="text-sm text-slate-700">
              Realiza una transferencia bancaria con los siguientes datos:
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
              Incluye la referencia <span className="font-mono font-semibold">{order.reference}</span> en el concepto.
            </p>
          </div>
        )}

        {/* Upload comprobante */}
        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="text-sm font-semibold text-blue-900">
            Adjunta tu comprobante de pago
          </h3>
          <p className="mt-1 text-xs text-blue-700">
            Sube una captura del Bizum o el justificante de la transferencia.
            Verificaremos el pago y te enviaremos una confirmacion por email.
          </p>
          <div className="mt-4">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setUploadError(null);
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-200"
            />
          </div>
          {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          <button
            type="button"
            onClick={handleUploadProof}
            disabled={!file || uploading}
            className="mt-4 rounded-2xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {uploading ? "Enviando..." : "Enviar comprobante"}
          </button>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
