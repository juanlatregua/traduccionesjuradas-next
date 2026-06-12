import type { Metadata } from "next";
import { getWorkflowStateLabel } from "@/lib/workflow";
import { getTrackedConsultaUrl, getTrackedPresupuestoUrl } from "@/lib/contact";
import { isDueSoon, isOverdue } from "@/lib/order-utils";
import AutoRefresh from "@/components/AutoRefresh";
import EstimationAccuracyCard from "@/components/EstimationAccuracyCard";
import OrderActionPanel from "@/components/OrderActionPanel";
import OrderTableWithBulkActions from "@/components/OrderTableWithBulkActions";
import PMQuickCreatePanel from "@/components/PMQuickCreatePanel";
import TranslatorAgenda from "@/components/TranslatorAgenda";
import ZonaTraductorFilters from "@/components/ZonaTraductorFilters";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import ZonaTraductorThemeToggle from "@/components/ZonaTraductorThemeToggle";
import {
  authZonaTraductorOrRedirect,
  loadControlState,
  getPaymentProofs,
  getSubmittedDocuments,
  getQuoteDraft,
  getQuoteAuditTrail,
  hasFinancialRisk,
  requiresMarginApproval,
  hasMonthlyBatchPending,
  topFinancialAlert,
} from "@/lib/zona-traductor-data";

export const metadata: Metadata = {
  title: "Zona traductor — Control",
  description: "Vista de control operativo y financiero de pedidos.",
  robots: { index: false, follow: false },
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

export default async function ZonaTraductorControlPage({
  searchParams,
}: {
  searchParams: {
    filtro?: string;
    q?: string;
    periodo?: string;
    desde?: string;
    hasta?: string;
    base?: string;
  };
}) {
  const email = await authZonaTraductorOrRedirect();
  const state = await loadControlState(searchParams);
  const {
    orders,
    periodOrders,
    counts,
    paidCount,
    inProgressCount,
    pendingPayCount,
    reviewPendingCount,
    whatsappLeadCount,
    financialRiskCount,
    marginApprovalPendingCount,
    monthlyBatchPendingCount,
    financeClosedCount,
    paidRevenueCents,
    supplierPaymentPendingCount,
    avgMarginPct,
    criticalFinanceOrders,
    activeScopedOrders,
    dateRange,
    dateBase,
    filtro,
    qRaw,
    pedidosAccionables,
  } = state;

  return (
    <div className="min-h-screen bg-slate-950">
      <ZonaTraductorNav modoActivo="control" pedidosAccionables={pedidosAccionables} />
      <main className="px-4 py-10">
        <AutoRefresh intervalMs={20000} idleMs={30000} />
        <section className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Zona traductor</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Gestion operativa + control economico
          </h1>
          <p className="mt-1 text-sm text-slate-400">Sesion: {email}</p>
          <ZonaTraductorThemeToggle />

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-center">
              <p className="text-2xl font-bold text-white">{activeScopedOrders.length}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total activos</p>
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
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-orange-300">{reviewPendingCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-orange-300/70">Pend. revisión</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-300">{whatsappLeadCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/70">Origen WA</p>
            </div>
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{financialRiskCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-red-400/70">Riesgo financiero</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-center col-span-2 sm:col-span-1">
              <p className="text-sm font-bold text-cyan-300">{formatMoney(paidRevenueCents)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300/70">Ingresos cobrados</p>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-rose-300">{supplierPaymentPendingCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-rose-300/70">Pagos prov. pend.</p>
            </div>
            <div className="rounded-2xl border border-lime-500/20 bg-lime-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-lime-300">{financeClosedCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-lime-300/70">Cierres fin.</p>
            </div>
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-300">{marginApprovalPendingCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-yellow-300/70">Aprob. margen</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-fuchsia-300">{monthlyBatchPendingCount}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/70">Lote vencido</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
            <p>
              Periodo activo: <span className="font-semibold text-slate-100">{dateRange.label}</span>
              {" · "}
              <span className="font-semibold text-slate-100">
                {dateBase === "paid" ? "Base fecha cobro" : "Base fecha pedido"}
              </span>
              {" · "}
              <span className="text-slate-400">Resetear vista no borra datos, solo limpia filtros y estadisticas.</span>
            </p>
            <p>
              Margen medio con datos:{" "}
              <span className="font-semibold text-slate-100">{avgMarginPct === null ? "—" : `${avgMarginPct}%`}</span>
            </p>
            <p className="mt-1 text-slate-400">
              Si un pedido cae por debajo del umbral de margen (10%), queda bloqueado para cierre hasta aprobar.
            </p>
            <p className="mt-2 text-slate-400">
              Flujo WhatsApp: usa{" "}
              <a
                href={getTrackedPresupuestoUrl("pm")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-cyan-300 underline"
              >
                enlace presupuesto
              </a>{" "}
              y{" "}
              <a
                href={getTrackedConsultaUrl(undefined, "pm")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-cyan-300 underline"
              >
                enlace consulta
              </a>{" "}
              para que el lead entre trazado como `src=wa`.
            </p>
          </div>
        </section>

        <PMQuickCreatePanel />

        <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-cyan-500/30 bg-cyan-500/5 p-6 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Presupuestos con preview</p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Crear, previsualizar y enviar presupuesto desde zona traductor
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Flujo recomendado para leads que te llegan por email o WhatsApp: primero previsualiza PDF y email, luego envía.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/zona-traductor/presupuesto"
              className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
            >
              Nuevo presupuesto
            </a>
            <a
              href="/admin/quotes"
              className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/10"
            >
              Ver todos los presupuestos
            </a>
          </div>
        </section>

        <EstimationAccuracyCard />

        {orders.length > 0 && (
          <section className="mx-auto mt-6 max-w-6xl space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Acciones por pedido
              <span className="ml-2 text-sm font-normal text-slate-400">(pulsa para expandir)</span>
            </h2>
            {orders.map((order) => (
              <OrderActionPanel
                key={order.reference}
                reference={order.reference}
                clientName={order.clientName}
                clientEmail={order.clientEmail}
                title={order.title}
                langPair={order.langPair}
                paymentStatus={order.paymentStatus}
                deliveryState={order.deliveryState}
                workflowState={order.workflowState}
                acquisitionSource={order.acquisitionSource}
                assignedTo={order.assignedTo}
                dueDate={order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null}
                amountCents={order.amountCents}
                paymentProofs={getPaymentProofs(order)}
                documents={getSubmittedDocuments(order)}
                quoteDraft={getQuoteDraft(order)}
                quoteAuditTrail={getQuoteAuditTrail(order)}
                isArchived={Boolean(order.isArchived)}
                financeSnapshot={order.financeSnapshot}
                artifacts={order.artifacts}
                deliveryNotification={order.deliveryNotification}
                trackedLinks={order.trackedLinks}
                draftFileUrl={order.draftFileUrl}
                draftFilename={order.draftFilename}
                draftGeneratedAt={order.draftGeneratedAt ? new Date(order.draftGeneratedAt).toISOString() : null}
                collaboratorAssignments={((order as any).collaboratorAssignments || []).map((a: any) => ({
                  id: a.id,
                  status: a.status,
                  collaboratorId: a.collaboratorId,
                  quotedPriceCents: a.quotedPriceCents,
                  quotedDeadline: a.quotedDeadline ? new Date(a.quotedDeadline).toISOString() : null,
                  collaboratorNotes: a.collaboratorNotes,
                  rejectionReason: a.rejectionReason,
                  revisionReason: a.revisionReason,
                  deliveredFileUrl: a.deliveredFileUrl,
                  deliveredFilename: a.deliveredFilename,
                  deliveredAt: a.deliveredAt ? new Date(a.deliveredAt).toISOString() : null,
                  adminNotes: a.adminNotes,
                  collaborator: {
                    fullName: a.collaborator.fullName,
                    email: a.collaborator.email,
                  },
                }))}
                canonicalStage={order.canonicalStage}
                gates={order.gates}
                nextBestAction={order.nextBestAction}
              />
            ))}
          </section>
        )}

        {criticalFinanceOrders.length > 0 && (
          <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6 shadow-xl sm:p-8">
            <h2 className="text-lg font-semibold text-red-200">Alertas criticas a resolver hoy</h2>
            <ul className="mt-3 space-y-2 text-sm text-red-100">
              {criticalFinanceOrders.map((order) => (
                <li key={order.reference} className="rounded-xl border border-red-500/20 bg-slate-900/50 px-3 py-2">
                  <span className="font-mono text-xs font-bold text-cyan-300">{order.reference}</span>
                  <span className="mx-2 text-slate-500">·</span>
                  <span>{topFinancialAlert(order)}</span>
                  <span className="mx-2 text-slate-500">·</span>
                  <span className="text-slate-300">{order.clientEmail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <TranslatorAgenda
          items={periodOrders.map((o) => ({
            reference: o.reference,
            title: o.title,
            dueDate: o.dueDate,
            deliveryState: o.deliveryState,
            assignedTo: o.assignedTo,
          }))}
        />

        <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
          <h2 className="text-lg font-semibold text-white">
            Pedidos
            <span className="ml-2 text-sm font-normal text-slate-400">({orders.length})</span>
          </h2>

          <ZonaTraductorFilters
            current={filtro}
            counts={counts}
            query={qRaw}
            period={dateRange.key}
            fromDate={dateRange.fromInput}
            toDate={dateRange.toInput}
            dateBase={dateBase}
          />

          {orders.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">No hay pedidos con este filtro.</p>
          ) : (
            <OrderTableWithBulkActions
              orders={orders.map((order) => {
                const paymentProofs = getPaymentProofs(order);
                const latestProof = paymentProofs[0];
                const quickQuoteParams = new URLSearchParams({
                  customerEmail: order.clientEmail || "",
                  customerName: order.clientName || "",
                  lineDescription: order.title || "Traducción jurada",
                  lineAmount: (Math.max(0, Number(order.amountCents || 0)) / 100).toFixed(2),
                  langPair: order.langPair || "",
                });
                return {
                  reference: order.reference,
                  title: order.title,
                  amountCents: order.amountCents,
                  paymentStatus: order.paymentStatus,
                  deliveryState: order.deliveryState,
                  workflowState: order.workflowState,
                  workflowStateLabel: getWorkflowStateLabel(order.workflowState),
                  acquisitionSource: order.acquisitionSource,
                  assignedTo: order.assignedTo,
                  dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null,
                  dueSoon: isDueSoon(order.dueDate),
                  overdue: isOverdue(order.dueDate),
                  clientEmail: order.clientEmail,
                  clientName: order.clientName,
                  langPair: order.langPair,
                  latestProofUrl: latestProof ? latestProof.fileUrl : null,
                  financeRisk: hasFinancialRisk(order),
                  financeTitle: order.financeSnapshot.warnings.length
                    ? order.financeSnapshot.warnings.join(" | ")
                    : "Sin alertas financieras",
                  marginPct: order.financeSnapshot.marginPct,
                  requiresMarginApproval: requiresMarginApproval(order),
                  hasMonthlyBatchPending: hasMonthlyBatchPending(order),
                  quickQuoteHref: `/zona-traductor/presupuesto?${quickQuoteParams.toString()}`,
                  showConfirmPayment:
                    order.paymentStatus === "PENDING" &&
                    ["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO", "PRESUPUESTO_ENVIADO"].includes(order.workflowState),
                  hasWorkspaceAccess: order.paymentStatus === "PAID" && !!order.assignedTo,
                };
              })}
            />
          )}
        </section>
      </main>
    </div>
  );
}
