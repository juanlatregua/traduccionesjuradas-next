import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { isVerifiedOtpTokenValid, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { getAllOrdersForStaff } from "@/lib/orders";
import ConfirmPaymentButton from "@/components/ConfirmPaymentButton";
import ZonaTraductorFilters from "@/components/ZonaTraductorFilters";
import OrderActionPanel from "@/components/OrderActionPanel";

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

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function isDueSoon(dueDate: Date | null) {
  if (!dueDate) return false;
  const now = new Date();
  const diff = new Date(dueDate).getTime() - now.getTime();
  return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

function isOverdue(dueDate: Date | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PAID: { label: "Pagado", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    PENDING: { label: "Pendiente", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    FAILED: { label: "Fallido", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    REFUNDED: { label: "Reembolsado", cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  };
  const info = map[status] || map.PENDING;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${info.cls}`}>
      {info.label}
    </span>
  );
}

function DeliveryBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESUPUESTO: { label: "Presupuesto", cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
    EN_PROCESO: { label: "En proceso", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    TRADUCIDO: { label: "Traducido", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  };
  const info = map[state] || map.PRESUPUESTO;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${info.cls}`}>
      {info.label}
    </span>
  );
}

export default async function ZonaTraductorPage({
  searchParams,
}: {
  searchParams: { filtro?: string };
}) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;

  if (!email) {
    redirect("/acceso?callbackUrl=/zona-traductor/verificar");
  }

  if (!isStaffEmail(email)) {
    redirect("/acceso?callbackUrl=/zona-traductor/verificar&error=StaffOnly");
  }

  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const isOtpVerified = isVerifiedOtpTokenValid(verifiedCookie, email);
  if (!isOtpVerified) {
    redirect("/zona-traductor/verificar");
  }

  const allOrders = await getAllOrdersForStaff();
  const filtro = searchParams.filtro || "todos";

  const orders = allOrders.filter((order) => {
    switch (filtro) {
      case "pagados-sin-asignar":
        return order.paymentStatus === "PAID" && !order.assignedTo && order.deliveryState !== "TRADUCIDO";
      case "en-proceso":
        return order.deliveryState === "EN_PROCESO";
      case "sla-riesgo":
        return order.dueDate && (isDueSoon(order.dueDate) || isOverdue(order.dueDate)) && order.deliveryState !== "TRADUCIDO";
      case "pendientes-pago":
        return order.paymentStatus === "PENDING";
      case "traducidos":
        return order.deliveryState === "TRADUCIDO";
      default:
        return true;
    }
  });

  const counts = {
    todos: allOrders.length,
    "pagados-sin-asignar": allOrders.filter((o) => o.paymentStatus === "PAID" && !o.assignedTo && o.deliveryState !== "TRADUCIDO").length,
    "en-proceso": allOrders.filter((o) => o.deliveryState === "EN_PROCESO").length,
    "sla-riesgo": allOrders.filter((o) => o.dueDate && (isDueSoon(o.dueDate) || isOverdue(o.dueDate)) && o.deliveryState !== "TRADUCIDO").length,
    "pendientes-pago": allOrders.filter((o) => o.paymentStatus === "PENDING").length,
    "traducidos": allOrders.filter((o) => o.deliveryState === "TRADUCIDO").length,
  };

  /* ---- KPI counters ---- */
  const paidCount = allOrders.filter((o) => o.paymentStatus === "PAID").length;
  const inProgressCount = allOrders.filter((o) => o.deliveryState === "EN_PROCESO").length;
  const deliveredCount = allOrders.filter((o) => o.deliveryState === "TRADUCIDO").length;
  const pendingPayCount = allOrders.filter((o) => o.paymentStatus === "PENDING").length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-10">
      {/* Header */}
      <section className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Zona traductor</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Gestion de pedidos
        </h1>
        <p className="mt-1 text-sm text-slate-400">Sesion: {email}</p>

        {/* KPI cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-center">
            <p className="text-2xl font-bold text-white">{allOrders.length}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total pedidos</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{paidCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/60">Pagados</p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{inProgressCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-blue-400/60">En proceso</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingPayCount}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400/60">Pend. pago</p>
          </div>
        </div>
      </section>

      {/* Table section */}
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <h2 className="text-lg font-semibold text-white">
          Pedidos
          <span className="ml-2 text-sm font-normal text-slate-400">({orders.length})</span>
        </h2>

        <ZonaTraductorFilters current={filtro} counts={counts} />

        {orders.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500">No hay pedidos con este filtro.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ref.</th>
                  <th className="px-4 py-3 font-semibold">Titulo</th>
                  <th className="px-4 py-3 font-semibold">Importe</th>
                  <th className="px-4 py-3 font-semibold">Pago</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Asignado</th>
                  <th className="px-4 py-3 font-semibold">Entrega</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {orders.map((order) => {
                  const overdue = isOverdue(order.dueDate);
                  const dueSoon = isDueSoon(order.dueDate);
                  return (
                    <tr
                      key={order.reference}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        overdue ? "bg-red-500/5" : dueSoon ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-300">{order.reference}</td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-300" title={order.title}>
                        {order.title}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-200">{formatMoney(order.amountCents)}</td>
                      <td className="px-4 py-3"><PaymentBadge status={order.paymentStatus} /></td>
                      <td className="px-4 py-3"><DeliveryBadge state={order.deliveryState} /></td>
                      <td className="px-4 py-3 text-xs text-slate-300">{order.assignedTo || <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3">
                        {order.dueDate ? (
                          <span
                            className={`text-xs font-semibold ${
                              overdue ? "text-red-400" : dueSoon ? "text-amber-400" : "text-slate-300"
                            }`}
                          >
                            {formatDate(order.dueDate)}
                            {overdue && " !"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-400" title={order.clientEmail}>
                        {order.clientEmail}
                      </td>
                      <td className="px-4 py-3">
                        {order.paymentStatus === "PENDING" && (
                          <ConfirmPaymentButton reference={order.reference} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Action panels - collapsible per order */}
      {orders.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Acciones por pedido
            <span className="ml-2 text-sm font-normal text-slate-400">
              (pulsa para expandir)
            </span>
          </h2>
          {orders.map((order) => (
            <OrderActionPanel
              key={order.reference}
              reference={order.reference}
              clientEmail={order.clientEmail}
              title={order.title}
              langPair={order.langPair}
              paymentStatus={order.paymentStatus}
              deliveryState={order.deliveryState}
              assignedTo={order.assignedTo}
              dueDate={order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null}
              amountCents={order.amountCents}
            />
          ))}
        </section>
      )}
    </main>
  );
}
