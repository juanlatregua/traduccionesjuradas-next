import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import {
  CLIENT_ORDERS,
  getDeliveryStateLabel,
  getDeliveryTypeLabel,
  getPaymentStateLabel,
} from "@/lib/client-area";
import { isStaffEmail } from "@/lib/staff-access";

export const metadata: Metadata = {
  title: "Area de cliente",
  description: "Acceso a tu area de cliente para seguimiento de pedidos.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AreaClientePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Acceso requerido
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Inicia sesion para ver tu area de cliente
          </h1>
          <p className="mt-3 text-sm text-slate-700">
            El pago directo sigue disponible sin login. El acceso con Google es opcional para centralizar
            seguimiento y datos de tus encargos.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <GoogleSignInButton
              callbackUrl="/area-cliente"
              label="Entrar con Google"
              className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
            />
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const isStaff = isStaffEmail(session?.user?.email);

  const paidOrders = CLIENT_ORDERS.filter((order) => order.paymentState === "pagado").length;
  const pendingOrders = CLIENT_ORDERS.filter((order) => order.paymentState === "pendiente").length;
  const translatedOrders = CLIENT_ORDERS.filter(
    (order) => order.deliveryState === "traducido"
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Area de cliente
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Bienvenido, {session.user?.name || "cliente"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sesion activa: {session.user?.email || "sin email"}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pedidos pendientes</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{pendingOrders}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pedidos pagados</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{paidOrders}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Traducidos</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{translatedOrders}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href="/api/auth/signout?callbackUrl=/"
            className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cerrar sesion
          </a>
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Crear nuevo encargo
          </Link>
          <Link
            href="/traductor-jurado-frances"
            className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Servicio frances
          </Link>
          {isStaff && (
            <Link
              href="/zona-traductor"
              className="rounded-2xl border border-emerald-300 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Zona traductor
            </Link>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Estado de mis pedidos</h2>
        <p className="mt-2 text-sm text-slate-700">
          Referencias activas desde <span className="font-semibold">26_001</span>. Cada fila incluye
          acceso al presupuesto, pago, estado del proceso y descarga del archivo final cuando este listo.
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Referencia</th>
                <th className="px-4 py-3 font-semibold">Presupuesto</th>
                <th className="px-4 py-3 font-semibold">Pago</th>
                <th className="px-4 py-3 font-semibold">Entrega</th>
                <th className="px-4 py-3 font-semibold">Proceso</th>
                <th className="px-4 py-3 font-semibold">Facturacion</th>
                <th className="px-4 py-3 font-semibold">Archivo</th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_ORDERS.map((order) => (
                <tr key={order.reference} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.reference}</td>
                  <td className="px-4 py-3">
                    <Link href={order.presupuestoUrl} className="font-semibold text-emerald-700 hover:underline">
                      Ver presupuesto
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getPaymentStateLabel(order.paymentState)}</td>
                  <td className="px-4 py-3 text-slate-700">{getDeliveryTypeLabel(order.deliveryType)}</td>
                  <td className="px-4 py-3 text-slate-700">{getDeliveryStateLabel(order.deliveryState)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {order.invoiceRequested
                      ? order.invoiceDataCompleted
                        ? "Solicitada"
                        : "Solicitada (faltan datos)"
                      : "No solicitada"}
                  </td>
                  <td className="px-4 py-3">
                    {order.translatedFileUrl ? (
                      <Link href={order.translatedFileUrl} className="font-semibold text-emerald-700 hover:underline">
                        Descargar PDF
                      </Link>
                    ) : (
                      <span className="text-slate-500">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/area-cliente/pedido/${order.reference}`}
                      className="rounded-xl border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ver estado
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Historial de pedidos</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {CLIENT_ORDERS.map((order) => (
            <li key={`history-${order.reference}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-mono text-xs font-semibold text-slate-800">{order.reference}</span>{" "}
              · {order.langPair} · {order.createdAt} · {getDeliveryStateLabel(order.deliveryState)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
