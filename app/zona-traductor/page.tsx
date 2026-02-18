import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeliveryStateLabel, getPaymentStateLabel } from "@/lib/client-area";
import { isStaffEmail } from "@/lib/staff-access";
import { isVerifiedOtpTokenValid, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { getAllOrdersForStaff } from "@/lib/orders";
import TranslatorNotifyForm from "@/components/TranslatorNotifyForm";
import ConfirmPaymentButton from "@/components/ConfirmPaymentButton";

export const metadata: Metadata = {
  title: "Zona traductor",
  description: "Gestion interna de pedidos para traductor y administracion.",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

export default async function ZonaTraductorPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;

  if (!email) {
    redirect("/acceso?callbackUrl=/zona-traductor/verificar");
  }

  if (!isStaffEmail(email)) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-12 text-slate-100">
        <section className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Zona traductor · Acceso protegido</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Verificacion de acceso requerida
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            La cuenta actual no tiene permisos para esta zona interna.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/api/auth/signout?callbackUrl=/acceso?callbackUrl=/zona-traductor/verificar"
              className="inline-flex rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
            >
              Cambiar de cuenta
            </a>
            <Link
              href="/area-cliente"
              className="inline-flex rounded-2xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              Ir a area cliente
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const isOtpVerified = isVerifiedOtpTokenValid(verifiedCookie, email);
  if (!isOtpVerified) {
    redirect("/zona-traductor/verificar");
  }

  const orders = await getAllOrdersForStaff();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-10">
      <section className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Zona traductor</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Gestion de pedidos y entrega al cliente
        </h1>
        <p className="mt-2 text-sm text-slate-300">Sesion autorizada: {email}</p>
      </section>

      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <h2 className="text-lg font-semibold text-white">Pedidos ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No hay pedidos registrados.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Referencia</th>
                  <th className="px-4 py-3 font-semibold">Combinacion</th>
                  <th className="px-4 py-3 font-semibold">Importe</th>
                  <th className="px-4 py-3 font-semibold">Pago</th>
                  <th className="px-4 py-3 font-semibold">Proceso</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.reference} className="border-t border-slate-700">
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">{order.reference}</td>
                    <td className="px-4 py-3 text-slate-200">{order.langPair || "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{formatMoney(order.amountCents)}</td>
                    <td className="px-4 py-3 text-slate-200">{getPaymentStateLabel(order.paymentStatus)}</td>
                    <td className="px-4 py-3 text-slate-200">{getDeliveryStateLabel(order.deliveryState)}</td>
                    <td className="px-4 py-3 text-slate-300">{order.clientEmail}</td>
                    <td className="px-4 py-3">
                      {order.paymentStatus === "PENDING" && (
                        <ConfirmPaymentButton reference={order.reference} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {orders.length > 0 && (
        <section className="mx-auto mt-6 grid max-w-6xl gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <TranslatorNotifyForm
              key={order.reference}
              reference={order.reference}
              defaultClientEmail={order.clientEmail}
            />
          ))}
        </section>
      )}
    </main>
  );
}
