import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";
import { AdminOrdersList } from "@/components/AdminOrdersList";

export const metadata: Metadata = {
  title: "Admin · Pedidos",
  robots: { index: false, follow: false },
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

export default async function AdminOrdersPage() {
  await requireAdminPageAccess("/admin/orders");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [totalOrders, pendingPayment, inProgress, revenueYTD] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: "PENDING" } }),
    prisma.order.count({ where: { status: "IN_PROGRESS" } }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", paidAt: { gte: startOfYear } },
      _sum: { amountCents: true },
    }),
  ]);

  const stats = [
    { label: "Total pedidos", value: String(totalOrders) },
    { label: "Pendientes pago", value: String(pendingPayment) },
    { label: "En proceso", value: String(inProgress) },
    { label: "Ingresos YTD", value: formatMoney(revenueYTD._sum.amountCents || 0) },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Backoffice</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Pedidos</h1>
        </div>

        {/* Stats bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Client-side interactive list */}
        <AdminOrdersList />
      </section>
    </main>
  );
}
