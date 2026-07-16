import type { Metadata } from "next";
import { Suspense } from "react";
import { getWorkflowStateLabel } from "@/lib/workflow";
import { getTrackedConsultaUrl, getTrackedPresupuestoUrl } from "@/lib/contact";
import { isDueSoon, isOverdue } from "@/lib/order-utils";
import AutoRefresh from "@/components/AutoRefresh";
import BandejaEntrada from "@/components/BandejaEntrada";
import EstimationAccuracyCard from "@/components/EstimationAccuracyCard";
import OrderTableWithBulkActions from "@/components/OrderTableWithBulkActions";
import PedidosViewToggle from "@/components/PedidosViewToggle";
import TranslatorAgenda from "@/components/TranslatorAgenda";
import ZonaTraductorFilters from "@/components/ZonaTraductorFilters";
import ZonaTraductorThemeToggle from "@/components/ZonaTraductorThemeToggle";
import {
  authZonaTraductorOrRedirect,
  loadControlState,
  getPaymentProofs,
  hasFinancialRisk,
  requiresMarginApproval,
  hasMonthlyBatchPending,
  topFinancialAlert,
} from "@/lib/zona-traductor-data";

export const metadata: Metadata = {
  title: "Zona traductor — Pedidos",
  description: "Triage y control de pedidos para traductor y administración.",
  robots: { index: false, follow: false },
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

// PEDIDOS = fusión de la antigua Bandeja (triage por urgencia) y el antiguo
// Resumen/control (filtros server-side, KPIs, tabla con bulk y export CSV).
// Eran dos vistas del MISMO dataset con dos sistemas de filtrado paralelos.
// Aquí hay un solo dataset, un solo filtro y dos lecturas: Tarjetas | Tabla.
export default async function ZonaTraductorPedidosPage({
  searchParams,
}: {
  searchParams: {
    filtro?: string;
    q?: string;
    periodo?: string;
    desde?: string;
    hasta?: string;
    base?: string;
    vista?: string;
  };
}) {
  const email = await authZonaTraductorOrRedirect();
  const state = await loadControlState(searchParams);
  const vista = searchParams.vista === "tabla" ? "tabla" : "cards";
  const {
    orders,
    bandejaOrders,
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
  } = state;

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="px-4 py-8">
        <AutoRefresh intervalMs={20000} idleMs={30000} />

        <section className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Zona traductor</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Pedidos</h1>
              <p className="mt-1 text-sm text-slate-400">Sesión: {email}</p>
            </div>
            <ZonaTraductorThemeToggle />
          </div>

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
              <span className="text-slate-400">Resetear vista no borra datos, solo limpia filtros y estadísticas.</span>
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

        <EstimationAccuracyCard />

        {criticalFinanceOrders.length > 0 && (
          <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6 shadow-xl sm:p-8">
            <h2 className="text-lg font-semibold text-red-200">Alertas críticas a resolver hoy</h2>
            <ul className="mt-3 space-y-2 text-sm text-red-100">
              {criticalFinanceOrders.map((order) => (
                <li key={order.reference} className="rounded-xl border border-red-500/20 bg-slate-900/50 px-3 py-2">
                  <a
                    href={`/zona-traductor/pedido/${order.reference}`}
                    className="font-mono text-xs font-bold text-cyan-300 hover:underline"
                  >
                    {order.reference}
                  </a>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              Pedidos
              <span className="ml-2 text-sm font-normal text-slate-400">({orders.length})</span>
            </h2>
            <Suspense fallback={null}>
              <PedidosViewToggle vista={vista} />
            </Suspense>
          </div>

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
          ) : vista === "cards" ? (
            <BandejaEntrada orders={bandejaOrders} staffEmail={email} />
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
                  // El atajo de cobro se conserva: es el mismo chokepoint que el
                  // detalle (#pago), no una implementación paralela. Quitarlo
                  // obligaría a abrir el pedido para algo que hoy es un clic.
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
