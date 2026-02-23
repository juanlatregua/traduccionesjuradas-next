import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { getOrdersByClientEmail } from "@/lib/orders";
import {
  getDeliveryStateLabel,
  getDeliveryTypeLabel,
  getPaymentStateLabel,
  getWorkflowStateLabel,
} from "@/lib/client-area";
import { isStaffEmail } from "@/lib/staff-access";
import AutoRefresh from "@/components/AutoRefresh";
import { getWorkflowState } from "@/lib/workflow";

export const metadata: Metadata = {
  title: "Area de cliente",
  description: "Acceso a tu area de cliente para seguimiento de pedidos.",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

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
  const orders = await getOrdersByClientEmail(session.user?.email || "");

  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID").length;
  const pendingOrders = orders.filter((o) => o.paymentStatus === "PENDING").length;
  const translatedOrders = orders.filter((o) => o.deliveryState === "TRADUCIDO").length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <AutoRefresh intervalMs={20000} idleMs={30000} />
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
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No tienes pedidos todavia.{" "}
            <Link href="/presupuesto" className="font-semibold text-emerald-700 hover:underline">
              Solicita un presupuesto
            </Link>{" "}
            para empezar.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              Cada fila incluye acceso al pago, estado del proceso y descarga del archivo final cuando este listo.
            </p>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Referencia</th>
                    <th className="px-4 py-3 font-semibold">Descripcion</th>
                    <th className="px-4 py-3 font-semibold">Importe</th>
                    <th className="px-4 py-3 font-semibold">Pago</th>
                    <th className="px-4 py-3 font-semibold">Entrega</th>
                    <th className="px-4 py-3 font-semibold">Proceso</th>
                    <th className="px-4 py-3 font-semibold">Workflow</th>
                    <th className="px-4 py-3 font-semibold">ETA</th>
                    <th className="px-4 py-3 font-semibold">Factura</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const workflowState = getWorkflowState(order);
                    return (
                      <tr key={order.reference} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.reference}</td>
                        <td className="px-4 py-3 text-slate-700">{order.title}</td>
                        <td className="px-4 py-3 text-slate-700">{formatMoney(order.amountCents)}</td>
                        <td className="px-4 py-3 text-slate-700">{getPaymentStateLabel(order.paymentStatus)}</td>
                        <td className="px-4 py-3 text-slate-700">{getDeliveryTypeLabel(order.deliveryType)}</td>
                        <td className="px-4 py-3 text-slate-700">{getDeliveryStateLabel(order.deliveryState)}</td>
                        <td className="px-4 py-3 text-slate-700">{getWorkflowStateLabel(workflowState)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {order.dueDate ? order.dueDate.toISOString().slice(0, 10) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {order.billing?.requested
                            ? "Solicitada"
                            : "No solicitada"}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {orders.length > 0 && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Historial de pedidos</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {orders.map((order) => (
              <li key={`history-${order.reference}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-mono text-xs font-semibold text-slate-800">{order.reference}</span>{" "}
                · {order.langPair || "—"} · {order.createdAt.toISOString().slice(0, 10)} · {getDeliveryStateLabel(order.deliveryState)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
