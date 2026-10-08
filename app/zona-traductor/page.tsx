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
import PedidosHeader, { type PedidosMoney } from "@/components/pedidos/PedidosHeader";
import ZonaTraductorFilters from "@/components/ZonaTraductorFilters";
import ZonaTraductorThemeToggle from "@/components/ZonaTraductorThemeToggle";
import { getStaffRole } from "@/lib/staff-access";
import { loadPanelData } from "@/lib/panel-data";
import { aggregate, computeTotals } from "@/lib/panel-metrics";
import { allTimePeriod, type Period } from "@/lib/panel-period";
import {
  authZonaTraductorOrRedirect,
  loadControlState,
  getPaymentProofs,
  hasFinancialRisk,
  requiresMarginApproval,
  hasMonthlyBatchPending,
  topFinancialAlert,
  getTranslatorDeliveredAt,
} from "@/lib/zona-traductor-data";

export const metadata: Metadata = {
  title: "Zona traductor — Pedidos",
  description: "Triage y control de pedidos para traductor y administración.",
  robots: { index: false, follow: false },
};

// Cifras de dinero de la cabecera: las mismas del Panel (cobro = paidAt, sin IVA). Solo ADMIN.
async function loadMoney(period: Period | null): Promise<PedidosMoney> {
  const effective = period ?? allTimePeriod();
  const { current, previous } = await loadPanelData(effective);
  const cmp = period ? previous : undefined;
  const tot = (m: "ingresos_netos" | "margen_eur" | "margen_pct", d = current) => computeTotals(d, m);
  const prev = (m: "ingresos_netos" | "margen_eur") => (cmp ? tot(m, cmp) : undefined);
  const rows = (dimension: "par" | "traductor") => aggregate(current, { metric: "ingresos_netos", dimension, period: effective, top: 5 });
  return {
    cobrado: { value: tot("ingresos_netos"), prev: prev("ingresos_netos") },
    margenEur: { value: tot("margen_eur"), prev: prev("margen_eur") },
    margenPct: tot("margen_pct"),
    chart: period
      ? (() => {
          const t = aggregate(current, { metric: "ingresos_netos", dimension: "tiempo", period });
          return { labels: t.map((r) => r.label), series: [{ metric: "ingresos_netos" as const, name: "Cobrado sin IVA", values: t.map((r) => r.value) }] };
        })()
      : null,
    porPar: rows("par"),
    porTraductor: rows("traductor"),
  };
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
    p?: string;
    d?: string;
    base?: string;
    vista?: string;
  };
}) {
  const email = await authZonaTraductorOrRedirect();
  const state = await loadControlState(searchParams);
  const vista = searchParams.vista === "tabla" ? "tabla" : "cards";
  const { orders, bandejaOrders, allActive, counts, kpis, alerts, criticalFinanceOrders, p, period, explicitPeriod, dateBase, filtro, qRaw } = state;
  const isAdmin = getStaffRole(email) === "ADMIN";
  const money = isAdmin ? await loadMoney(period) : null;

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

          <PedidosHeader
            p={p}
            period={period}
            explicit={explicitPeriod}
            dateBase={dateBase}
            filtro={filtro}
            q={qRaw}
            vista={searchParams.vista}
            kpis={kpis}
            alerts={alerts}
            money={money}
          />

          <p className="mt-4 text-xs text-slate-400">
            Flujo WhatsApp: usa{" "}
            <a href={getTrackedPresupuestoUrl("pm")} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 underline">
              enlace presupuesto
            </a>{" "}
            y{" "}
            <a href={getTrackedConsultaUrl(undefined, "pm")} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 underline">
              enlace consulta
            </a>{" "}
            para que el lead entre trazado como `src=wa`.
          </p>
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
          items={allActive
            // Solo lo vivo: pagado y no archivado (26-ago: la agenda enseñaba un
            // presupuesto de abril sin pagar y un pedido archivado).
            .filter((o) => o.paymentStatus === "PAID" && !o.isArchived)
            .map((o) => ({
              reference: o.reference,
              title: o.title,
              dueDate: o.dueDate,
              deliveryState: o.deliveryState,
              assignedTo:
                o.assignedTo ||
                (o.collaboratorAssignments as any[]).find((a) => a.isWinning || a.status === "ACCEPTED")?.collaborator?.fullName ||
                null,
              translatorDeliveredAt: getTranslatorDeliveredAt(o),
              deliveryType: o.deliveryType ?? null,
              langPair: o.langPair,
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
