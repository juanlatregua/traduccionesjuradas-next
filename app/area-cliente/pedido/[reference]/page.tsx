import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CLIENT_ORDERS,
  getDeliveryStateLabel,
  getPaymentStateLabel,
} from "@/lib/client-area";
import OrderClientPanel from "@/components/OrderClientPanel";

export const metadata: Metadata = {
  title: "Estado de pedido",
  description: "Seguimiento del pedido, presupuesto, pago e historial.",
  robots: {
    index: false,
    follow: false,
  },
};

type PedidoPageProps = {
  params: {
    reference: string;
  };
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

export default function PedidoPage({ params }: PedidoPageProps) {
  const order = CLIENT_ORDERS.find((item) => item.reference === params.reference);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Referencia {order.reference}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Estado de tu pedido
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Fecha: {order.createdAt} · Combinacion: {order.langPair}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Presupuesto</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Generado</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pago</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{getPaymentStateLabel(order.paymentState)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Proceso</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{getDeliveryStateLabel(order.deliveryState)}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Presupuesto generado</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Concepto</th>
                <th className="px-4 py-3 font-semibold">Cantidad</th>
                <th className="px-4 py-3 font-semibold">Precio unitario</th>
                <th className="px-4 py-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.concepts.map((concept) => (
                <tr key={concept.concept} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-700">{concept.concept}</td>
                  <td className="px-4 py-3 text-slate-700">{concept.quantity}</td>
                  <td className="px-4 py-3 text-slate-700">{formatMoney(concept.unitPrice)}</td>
                  <td className="px-4 py-3 text-slate-900">{formatMoney(concept.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">Total: {formatMoney(order.total)}</p>
        <Link
          href={order.presupuestoUrl}
          className="mt-4 inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Ver presupuesto
        </Link>
      </section>

      <OrderClientPanel
        reference={order.reference}
        deliveryType={order.deliveryType}
        shippingDataCompleted={order.shippingDataCompleted}
        shippingSummary={order.shippingSummary}
        invoiceRequested={order.invoiceRequested}
        invoiceDataCompleted={order.invoiceDataCompleted}
        invoiceHistory={order.invoiceHistory}
        paymentUrl={order.paymentUrl}
        bizumUrl={order.bizumUrl}
        paypalUrl={order.paypalUrl}
        bankTransferUrl={order.bankTransferUrl}
      />

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Archivo traducido</h2>
        {order.translatedFileUrl ? (
          <Link
            href={order.translatedFileUrl}
            className="mt-3 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Descargar PDF traducido
          </Link>
        ) : (
          <p className="mt-2 text-sm text-slate-700">
            Aun no hay archivo disponible. Te avisaremos cuando el pedido pase a estado traducido.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {order.history.map((entry) => (
            <li key={`${entry.date}-${entry.text}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-semibold">{entry.date}</span> · {entry.text}
            </li>
          ))}
        </ul>
        <Link href="/area-cliente" className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:underline">
          Volver al area de cliente
        </Link>
      </section>
    </main>
  );
}
