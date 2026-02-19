import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import {
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

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

export default async function PedidoPage({ params }: PedidoPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/acceso?callbackUrl=" + encodeURIComponent(`/area-cliente/pedido/${params.reference}`));
  }

  const order = await getOrderDetail(params.reference, session.user.email);
  if (!order) notFound();

  const invoiceEvents = order.events.filter((e) => e.type.startsWith("invoice"));

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
          Fecha: {order.createdAt.toISOString().slice(0, 10)} · Combinacion: {order.langPair || "—"}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Presupuesto</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatMoney(order.amountCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pago</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{getPaymentStateLabel(order.paymentStatus)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Proceso</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{getDeliveryStateLabel(order.deliveryState)}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Detalle del pedido</h2>
        <div className="mt-4 space-y-1 text-sm text-slate-700">
          <p><span className="font-semibold">Concepto:</span> {order.title}</p>
          {order.langPair && <p><span className="font-semibold">Idiomas:</span> {order.langPair}</p>}
          {order.words && <p><span className="font-semibold">Palabras:</span> {order.words}</p>}
          {order.pagesLabel && <p><span className="font-semibold">Alcance:</span> {order.pagesLabel}</p>}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">Total: {formatMoney(order.amountCents)}</p>
      </section>

      <OrderClientPanel
        reference={order.reference}
        deliveryType={order.deliveryType}
        paymentStatus={order.paymentStatus}
        hasShipping={!!order.shipping}
        hasBilling={!!order.billing}
        billingRequested={order.billing?.requested || false}
        initialShipping={
          order.shipping
            ? {
                name: order.shipping.name,
                phone: order.shipping.phone,
                address: order.shipping.address,
                city: order.shipping.city,
                province: order.shipping.province,
                postalCode: order.shipping.postalCode,
                country: order.shipping.country,
              }
            : null
        }
        initialBilling={
          order.billing
            ? {
                requestInvoice: order.billing.requested,
                fiscalName: order.billing.fiscalName,
                nif: order.billing.nif,
                address: order.billing.address,
                city: order.billing.city,
                postalCode: order.billing.postalCode,
                country: order.billing.country,
                email: order.billing.email,
              }
            : null
        }
        invoiceEvents={invoiceEvents.map((e) => ({
          date: e.createdAt.toISOString().slice(0, 16).replace("T", " "),
          text: e.message,
        }))}
      />

      {order.billing?.requested && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Factura</h2>
          <p className="mt-2 text-sm text-slate-600">
            Datos de facturacion registrados a nombre de {order.billing.fiscalName} ({order.billing.nif}).
          </p>
          <a
            href={`/api/orders/${order.reference}/invoice-pdf`}
            className="mt-3 inline-flex rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Descargar factura PDF
          </a>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Archivo traducido</h2>
        {order.translatedFileUrl ? (
          <a
            href={order.translatedFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Descargar PDF traducido
          </a>
        ) : (
          <p className="mt-2 text-sm text-slate-700">
            Aun no hay archivo disponible. Te avisaremos cuando el pedido pase a estado traducido.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
        {order.events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Sin eventos registrados.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {order.events.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold">{entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>{" "}
                · {entry.message}
              </li>
            ))}
          </ul>
        )}
        <Link href="/area-cliente" className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:underline">
          Volver al area de cliente
        </Link>
      </section>
    </main>
  );
}
