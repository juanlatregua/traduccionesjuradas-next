import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import GuestOrderLookup from "@/components/GuestOrderLookup";
import { getOrdersByClientEmail } from "@/lib/orders";
import {
  getDeliveryStateLabel,
  getDeliveryTypeLabel,
  getPaymentStateLabel,
} from "@/lib/client-area";
import { isStaffEmail } from "@/lib/staff-access";
import AutoRefresh from "@/components/AutoRefresh";

export const metadata: Metadata = {
  title: "Área de cliente",
  description: "Acceso a tu área de cliente para seguimiento de pedidos.",
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
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-encre sm:text-3xl">
            Área de cliente
          </h1>
          <p className="mt-2 text-sm text-sepia">
            Consulta el estado de tu pedido con la referencia y el email.
          </p>

          <div className="mt-6">
            <GuestOrderLookup />
          </div>

          <div className="mt-8 border-t border-cream pt-6">
            <p className="text-sm text-sepia">
              Para ver todos tus pedidos y descargar traducciones, inicia sesión:
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <GoogleSignInButton
                callbackUrl="/area-cliente"
                label="Entrar con Google"
                className="rounded-2xl bg-encre px-4 py-2 font-semibold text-white hover:bg-encre"
              />
              <Link
                href="/"
                className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream"
              >
                Volver al inicio
              </Link>
            </div>
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
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Área de cliente
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          Bienvenido, {session.user?.name || "cliente"}
        </h1>
        <p className="mt-2 text-sm text-sepia">
          Sesión activa: {session.user?.email || "sin email"}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">Pedidos pendientes</p>
            <p className="mt-1 text-sm font-semibold text-encre">{pendingOrders}</p>
          </div>
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">Pedidos pagados</p>
            <p className="mt-1 text-sm font-semibold text-encre">{paidOrders}</p>
          </div>
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">Traducidos</p>
            <p className="mt-1 text-sm font-semibold text-encre">{translatedOrders}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href="/api/auth/signout?callbackUrl=/"
            className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream"
          >
            Cerrar sesión
          </a>
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-bleu px-4 py-2 font-semibold text-white hover:bg-bleu-dark"
          >
            Crear nuevo encargo
          </Link>
          {isStaff && (
            <Link
              href="/zona-traductor"
              className="rounded-2xl border border-bleu px-4 py-2 font-semibold text-bleu hover:bg-cream"
            >
              Zona traductor
            </Link>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Estado de mis pedidos</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-sepia">
            No tienes pedidos todavía.{" "}
            <Link href="/presupuesto" className="font-semibold text-bleu hover:underline">
              Solicita un presupuesto
            </Link>{" "}
            para empezar.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-sepia">
              Cada fila incluye acceso al pago, estado del proceso y descarga del archivo final cuando esté listo.
            </p>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-cream">
              <table className="w-full text-left text-sm">
                <thead className="bg-parchment text-xs uppercase tracking-wide text-graphite">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Referencia</th>
                    <th className="px-4 py-3 font-semibold">Descripción</th>
                    <th className="px-4 py-3 font-semibold">Importe</th>
                    <th className="px-4 py-3 font-semibold">Pago</th>
                    <th className="px-4 py-3 font-semibold">Formato</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">ETA</th>
                    <th className="px-4 py-3 font-semibold">Factura</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    return (
                      <tr key={order.reference} className="border-t border-cream">
                        <td className="px-4 py-3 font-mono text-xs text-sepia">{order.reference}</td>
                        <td className="px-4 py-3 text-sepia">{order.title}</td>
                        <td className="px-4 py-3 text-sepia">{formatMoney(order.amountCents)}</td>
                        <td className="px-4 py-3 text-sepia">{getPaymentStateLabel(order.paymentStatus)}</td>
                        <td className="px-4 py-3 text-sepia">{getDeliveryTypeLabel(order.deliveryType)}</td>
                        <td className="px-4 py-3 text-sepia">{getDeliveryStateLabel(order.deliveryState)}</td>
                        <td className="px-4 py-3 text-sepia">
                          {order.dueDate ? order.dueDate.toLocaleDateString("es-ES") : "—"}
                        </td>
                        <td className="px-4 py-3 text-sepia">
                          {order.billing?.requested
                            ? "Solicitada"
                            : "No solicitada"}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/area-cliente/pedido/${order.reference}`}
                            className="rounded-xl border border-cream px-2.5 py-1 text-xs font-semibold text-sepia hover:bg-cream"
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
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">Historial de pedidos</h2>
          <ul className="mt-3 space-y-2 text-sm text-sepia">
            {orders.map((order) => (
              <li key={`history-${order.reference}`} className="rounded-2xl border border-cream bg-parchment px-3 py-2">
                <span className="font-mono text-xs font-semibold text-encre">{order.reference}</span>{" "}
                · {order.langPair || "—"} · {order.createdAt.toISOString().slice(0, 10)} · {getDeliveryStateLabel(order.deliveryState)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
