import type { Metadata } from "next";
import ContabilidadSubNav from "@/components/ContabilidadSubNav";
import { BRANDS } from "@/lib/invoice-brands";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { getFinanceSnapshot } from "@/lib/finance";
import { getStaffRole } from "@/lib/staff-access";
import { listPaidUnbilledOrders } from "@/lib/reconcile-invoices";
import { inBooksOrderWhere } from "@/lib/bizum-ledger";
import ContabilidadClient, { type AcInvoice, type AcOrder, type AcExpense, type AcUnbilled } from "@/components/ContabilidadClient";
import ImportInvoicesPanel from "@/components/ImportInvoicesPanel";
import ReconcilePanel from "@/components/ReconcilePanel";
import BankReconcilePanel from "@/components/BankReconcilePanel";
import CollaboratorAccountPanel, { type CollaboratorAccountGroup } from "@/components/CollaboratorAccountPanel";

export const metadata: Metadata = {
  title: "Zona traductor — Contabilidad general",
  robots: { index: false, follow: false },
};

export default async function ZonaTraductorContabilidadPage() {
  const staffEmail = await authZonaTraductorOrRedirect();
  const role = getStaffRole(staffEmail);
  const canIssue = role === "ADMIN" || role === "PM";

  const [rawInvoices, rawOrders, rawExpenses, unbilled, rawTaxCloses, rawAccruals] = await Promise.all([
    prisma.clientInvoice.findMany({ where: { status: "ISSUED", docKind: "invoice" }, orderBy: { issuedAt: "desc" }, take: 3000, include: { order: { select: { reference: true } } } }),
    // Bizum y apartados NO entran en la contabilidad general (regla 27-ago-2026):
    // viven en /zona-traductor/contabilidad/bizum con su propia relación.
    prisma.order.findMany({
      where: { paymentStatus: "PAID", AND: [inBooksOrderWhere()] },
      select: { reference: true, paidAt: true, createdAt: true, amountCents: true, paymentStatus: true, events: { select: { type: true, payload: true, createdAt: true } } },
      take: 3000,
    }),
    // Los devengos de colaborador (isAccrual) no son facturas recibidas: van a la
    // cuenta por traductor, no al libro.
    prisma.expense.findMany({ where: { isAccrual: false }, orderBy: { date: "desc" }, take: 3000 }),
    listPaidUnbilledOrders(),
    prisma.taxPeriodClose.findMany({ select: { period: true, closedAt: true } }),
    prisma.expense.findMany({
      where: { isAccrual: true, settledById: null },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        supplier: true,
        concept: true,
        baseCents: true,
        orderReference: true,
        collaborator: { select: { id: true, fullName: true, companyName: true, supplierType: true, nif: true } },
      },
      take: 500,
    }),
  ]);
  const taxCloses = rawTaxCloses.map((c) => ({ period: c.period, closedAt: c.closedAt.toISOString() }));

  // Cuenta por traductor: devengos sin liquidar agrupados por colaborador.
  const accrualGroups = new Map<string, CollaboratorAccountGroup>();
  for (const a of rawAccruals) {
    const key = a.collaborator?.id ?? `sin-ficha:${a.supplier ?? "?"}`;
    let g = accrualGroups.get(key);
    if (!g) {
      g = {
        collaboratorId: a.collaborator?.id ?? null,
        name: a.collaborator ? a.collaborator.companyName || a.collaborator.fullName : a.supplier || "Sin colaborador",
        supplierType: a.collaborator?.supplierType ?? "AUTONOMO",
        // El NIF solo viaja al cliente para quien puede registrar la factura.
        nif: canIssue ? a.collaborator?.nif ?? null : null,
        charges: [],
      };
      accrualGroups.set(key, g);
    }
    g.charges.push({
      id: a.id,
      date: a.date.toISOString(),
      orderReference: a.orderReference,
      concept: a.concept,
      baseCents: a.baseCents,
    });
  }
  const unbilledTotal = unbilled.reduce((s, r) => s + r.bookableAmountCents, 0);

  const unbilledIncome: AcUnbilled[] = unbilled.map((r) => ({ date: r.paidAt ?? r.createdAt, baseCents: r.bookableBaseCents }));

  const invoices: AcInvoice[] = rawInvoices.map((i) => ({
    id: i.id,
    number: i.number,
    issuedAt: (i.issuedAt ?? i.createdAt).toISOString(),
    fiscalName: i.fiscalName,
    nif: i.nif,
    baseCents: i.baseCents,
    vatCents: i.vatCents,
    totalCents: i.totalCents,
    orderReference: i.order?.reference ?? null,
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
    supplierNif: e.supplierNif,
    supplierInvoiceNumber: e.supplierInvoiceNumber,
    category: e.category,
    brand: e.brand,
    baseCents: e.baseCents,
    vatRate: e.vatRate,
    vatCents: e.vatCents,
    ivaDeducible: e.ivaDeducible,
    taxTreatment: e.taxTreatment,
    needsReview: e.needsReview,
    notes: e.notes,
    irpfRetentionPct: e.irpfRetentionPct,
    irpfCents: e.irpfCents,
    totalCents: e.totalCents,
    payableCents: e.payableCents ?? e.totalCents,
    attachmentUrl: e.attachmentUrl,
    attachmentName: e.attachmentName,
  }));

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ContabilidadSubNav />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Contabilidad general</h1>
            <p className="mt-1 text-sm text-slate-400">
              Ingresos, gastos, IVA y resultado por año, trimestre o mes (modelo 303/390). Registra gastos a mano o importa
              tu histórico desde Excel.
            </p>
          </div>
          {/* Un atajo por actividad distinta de la principal, derivado de BRANDS:
              añadir una marca no debe exigir tocar esta cabecera. */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {Object.values(BRANDS)
              .filter((b) => b.key !== "traduccionesjuradas")
              .map((b) => (
                <a
                  key={b.key}
                  href={`/zona-traductor/facturas?nueva=${b.key}`}
                  className="rounded-lg border border-fuchsia-600 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-900/30"
                >
                  + Factura {b.label}
                </a>
              ))}
          </div>
        </div>
        <ContabilidadClient
          invoices={invoices}
          orders={orders}
          expenses={expenses}
          unbilled={unbilledIncome}
          taxCloses={taxCloses}
          sinFacturaSlot={
            <>
              <ReconcilePanel rows={unbilled} totalAmountCents={unbilledTotal} canIssue={canIssue} />
              <p className="mt-3 text-xs text-slate-500">
                Los cobros por Bizum y los pedidos apartados no aparecen aquí: están en{" "}
                <a href="/zona-traductor/contabilidad/bizum" className="text-cyan-400 hover:underline">
                  Bizum (fuera de contabilidad)
                </a>
                .
              </p>
            </>
          }
          bancoSlot={<BankReconcilePanel canIssue={canIssue} />}
          importSlot={<ImportInvoicesPanel />}
          proveedoresSlot={<CollaboratorAccountPanel groups={[...accrualGroups.values()]} canIssue={canIssue} />}
        />
      </div>
    </div>
  );
}
