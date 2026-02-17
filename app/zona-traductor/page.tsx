import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CLIENT_ORDERS, getDeliveryStateLabel, getPaymentStateLabel } from "@/lib/client-area";
import { isStaffEmail } from "@/lib/staff-access";
import TranslatorNotifyForm from "@/components/TranslatorNotifyForm";

export const metadata: Metadata = {
  title: "Zona traductor",
  description: "Gestion interna de pedidos para traductor y administracion.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ZonaTraductorPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;

  if (!isStaffEmail(email)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Acceso restringido</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Esta zona es solo para traductor y administracion
          </h1>
          <p className="mt-3 text-sm text-slate-700">
            Tu sesion actual no tiene permisos para esta seccion.
          </p>
          <Link
            href="/area-cliente"
            className="mt-4 inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Volver al area de cliente
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Zona traductor</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Gestion de pedidos y entrega al cliente
        </h1>
        <p className="mt-2 text-sm text-slate-600">Sesion autorizada: {email}</p>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Pedidos activos</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Referencia</th>
                <th className="px-4 py-3 font-semibold">Combinacion</th>
                <th className="px-4 py-3 font-semibold">Pago</th>
                <th className="px-4 py-3 font-semibold">Proceso</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_ORDERS.map((order, idx) => (
                <tr key={order.reference} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.reference}</td>
                  <td className="px-4 py-3 text-slate-700">{order.langPair}</td>
                  <td className="px-4 py-3 text-slate-700">{getPaymentStateLabel(order.paymentState)}</td>
                  <td className="px-4 py-3 text-slate-700">{getDeliveryStateLabel(order.deliveryState)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {idx === 0 ? "cliente1@example.com" : "cliente2@example.com"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {CLIENT_ORDERS.map((order, idx) => (
          <TranslatorNotifyForm
            key={order.reference}
            reference={order.reference}
            defaultClientEmail={idx === 0 ? "cliente1@example.com" : "cliente2@example.com"}
          />
        ))}
      </section>
    </main>
  );
}
