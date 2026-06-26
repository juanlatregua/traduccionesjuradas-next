import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { getFinanceSnapshot } from "@/lib/finance";
import { getStaffRole } from "@/lib/staff-access";
import { listPaidUnbilledOrders, listExcludedFromBilling } from "@/lib/reconcile-invoices";
import ContabilidadClient, { type AcInvoice, type AcOrder, type AcExpense } from "@/components/ContabilidadClient";
import ImportInvoicesPanel from "@/components/ImportInvoicesPanel";
import ReconcilePanel from "@/components/ReconcilePanel";
import ExcludedOrdersPanel from "@/components/ExcludedOrdersPanel";
import BankReconcilePanel from "@/components/BankReconcilePanel";

export const metadata: Metadata = {
  title: "Zona traductor — Contabilidad general",
  robots: { index: false, follow: false },
};

export default async function ZonaTraductorContabilidadPage() {
  const staffEmail = await authZonaTraductorOrRedirect();
  const role = getStaffRole(staffEmail);
  const canIssue = role === "ADMIN" || role === "PM";

  const [rawInvoices, rawOrders, rawExpenses, unbilled] = await Promise.all([
    prisma.clientInvoice.findMany({ where: { status: "ISSUED" }, orderBy: { issuedAt: "desc" }, take: 3000 }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: { reference: true, paidAt: true, createdAt: true, amountCents: true, paymentStatus: true, events: { select: { type: true, payload: true, createdAt: true } } },
      take: 3000,
    }),
    prisma.expense.findMany({ orderBy: { date: "desc" }, take: 3000 }),
    listPaidUnbilledOrders(),
  ]);
  const unbilledTotal = unbilled.reduce((s, r) => s + r.bookableAmountCents, 0);
  const excludedFromBilling = await listExcludedFromBilling();

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
    const cost = (snap.marginSupplierCostCents ?? 0) + (snap.marginGatewayFeeCents ?? 0) + (snap.marginOtherCostCents ?? 0);
    return {
      reference: o.reference,
      date: (o.paidAt ?? o.createdAt).toISOString(),
      totalCostCents: cost,
      costRecorded: snap.marginCents !== null,
    };
  });

  const expenses: AcExpense[] = rawExpenses.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    concept: e.concept,
    supplier: e.supplier,
    supplierInvoiceNumber: e.supplierInvoiceNumber,
    category: e.category,
    brand: e.brand,
    baseCents: e.baseCents,
    vatCents: e.vatCents,
    ivaDeducible: e.ivaDeducible,
    irpfCents: e.irpfCents,
    totalCents: e.totalCents,
    payableCents: e.payableCents ?? e.totalCents,
    attachmentUrl: e.attachmentUrl,
    attachmentName: e.attachmentName,
  }));

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Contabilidad general</h1>
            <p className="mt-1 text-sm text-slate-400">
              Ingresos, gastos, IVA y resultado por año, trimestre o mes (modelo 303/390). Registra gastos a mano o importa
              tu histórico desde Excel.
            </p>
          </div>
          <a
            href="/zona-traductor/facturas?nueva=holabonjour"
            className="shrink-0 rounded-lg border border-fuchsia-600 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/30"
          >
            + Factura de otra actividad
          </a>
        </div>
        <ReconcilePanel rows={unbilled} totalAmountCents={unbilledTotal} canIssue={canIssue} />
        <ExcludedOrdersPanel rows={excludedFromBilling} />
        <ContabilidadClient invoices={invoices} orders={orders} expenses={expenses} />
        <BankReconcilePanel canIssue={canIssue} />
        <ImportInvoicesPanel />
      </div>
    </div>
  );
}
