import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";
import { AdminOrderDetailPanel } from "@/components/AdminOrderDetailPanel";

export const metadata: Metadata = {
  title: "Admin · Detalle pedido",
  robots: { index: false, follow: false },
};

type Props = { params: { reference: string } };

export default async function AdminOrderDetailPage({ params }: Props) {
  await requireAdminPageAccess(`/admin/orders/${params.reference}`);

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    include: {
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      billing: true,
      shipping: true,
    },
  });

  if (!order) notFound();

  const serialized = {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.paidAt?.toISOString() || null,
    dueDate: order.dueDate?.toISOString() || null,
    events: order.events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
    billing: order.billing
      ? {
          fiscalName: order.billing.fiscalName,
          nif: order.billing.nif,
          address: order.billing.address,
          city: order.billing.city,
          postalCode: order.billing.postalCode,
          country: order.billing.country,
          email: order.billing.email,
        }
      : null,
    shipping: order.shipping
      ? {
          name: order.shipping.name,
          phone: order.shipping.phone,
          address: order.shipping.address,
          city: order.shipping.city,
          province: order.shipping.province,
          postalCode: order.shipping.postalCode,
          country: order.shipping.country,
        }
      : null,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Backoffice</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Pedido {order.reference}
            </h1>
          </div>
          <Link
            href="/admin/orders"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver a lista
          </Link>
        </div>

        <div className="mt-6">
          <AdminOrderDetailPanel order={serialized} />
        </div>
      </section>
    </main>
  );
}
