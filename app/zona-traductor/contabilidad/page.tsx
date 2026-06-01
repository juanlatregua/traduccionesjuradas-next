import type { Metadata } from "next";
import { authZonaTraductorOrRedirect, loadBandejaState } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { getFinanceSnapshot } from "@/lib/finance";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import ContabilidadClient, { type AcInvoice, type AcOrder } from "@/components/ContabilidadClient";

export const metadata: Metadata = {
  title: "Zona traductor — Contabilidad general",
  robots: { index: false, follow: false },
};

export default async function ZonaTraductorContabilidadPage() {
  await authZonaTraductorOrRedirect();
  const bandeja = await loadBandejaState().catch(() => null);
  const accionables = bandeja?.pedidosAccionables ?? 0;

  const [rawInvoices, rawOrders] = await Promise.all([
    prisma.clientInvoice.findMany({
      where: { status: "ISSUED" },
      orderBy: { issuedAt: "desc" },
      take: 2000,
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: {
        reference: true,
        title: true,
        amountCents: true,
        paymentStatus: true,
        paidAt: true,
        createdAt: true,
        events: { select: { type: true, payload: true, createdAt: true } },
      },
      take: 2000,
    }),
  ]);

  const invoices: AcInvoice[] = rawInvoices.map((i) => ({
    id: i.id,
    number: i.number,
    issuedAt: (i.issuedAt ?? i.createdAt).toISOString(),
    fiscalName: i.fiscalName,
    nif: i.nif,
    baseCents: i.baseCents,
    vatCents: i.vatCents,
    totalCents: i.totalCents,
  }));

  const orders: AcOrder[] = rawOrders.map((o) => {
    const snap = getFinanceSnapshot(o);
    const supplier = snap.marginSupplierCostCents ?? 0;
    const gateway = snap.marginGatewayFeeCents ?? 0;
    const other = snap.marginOtherCostCents ?? 0;
    return {
      reference: o.reference,
      title: o.title,
      date: (o.paidAt ?? o.createdAt).toISOString(),
      revenueBaseCents: Math.round(o.amountCents / 1.21),
      supplierCostCents: supplier,
      gatewayFeeCents: gateway,
      otherCostCents: other,
      totalCostCents: supplier + gateway + other,
      costRecorded: snap.marginCents !== null,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <ZonaTraductorNav modoActivo="contabilidad" pedidosAccionables={accionables} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Contabilidad general</h1>
            <p className="mt-1 text-sm text-slate-400">
              Ingresos, gastos y resultado por año, trimestre o mes. Facturación e IVA para el modelo 303/390; resultado a
              partir de los pedidos cobrados y sus costes. Descarga el CSV para la gestoría.
            </p>
          </div>
          <a
            href="/zona-traductor/facturas?nueva=holabonjour"
            className="shrink-0 rounded-lg border border-fuchsia-600 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/30"
          >
            + Factura de otra actividad
          </a>
        </div>
        <ContabilidadClient invoices={invoices} orders={orders} />
      </div>
    </div>
  );
}
