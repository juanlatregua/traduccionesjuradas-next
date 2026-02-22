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
import TranslatorAgenda from "@/components/TranslatorAgenda";
import AutoRefresh from "@/components/AutoRefresh";
import { getFinanceSnapshot } from "@/lib/finance";

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

function getPaymentProofs(order: any) {
  return (order.events || [])
    .filter((e: any) => e.type === "payment.proof_uploaded")
    .map((e: any) => ({
      fileUrl: String((e.payload as any)?.fileUrl || ""),
      fileName: String((e.payload as any)?.fileName || "Comprobante"),
      uploadedAt: String((e.payload as any)?.uploadedAt || e.createdAt?.toISOString?.() || ""),
    }))
    .filter((p: any) => p.fileUrl);
}

function hasFinancialRisk(order: any) {
  return !order.financeSnapshot.isFinanciallyCloseable || order.financeSnapshot.reconciliationStatus === "MISMATCH";
}

function requiresMarginApproval(order: any) {
  return order.financeSnapshot.requiresMarginApproval && order.financeSnapshot.marginApprovalStatus !== "APPROVED";
}

function hasMonthlyBatchPending(order: any) {
  return (
    order.financeSnapshot.supplierInvoiceBillingMode === "MONTHLY_BATCH" &&
    order.financeSnapshot.accountingCutoffPassed &&
    !["VALIDATED", "PAID"].includes(order.financeSnapshot.supplierInvoiceStatus)
  );
}

function matchesSearch(order: any, q: string) {
  if (!q) return true;
  const haystack = [
    order.reference,
    order.title,
    order.clientEmail,
    order.assignedTo,
    order.langPair,
    order?.billing?.nif,
    order?.billing?.fiscalName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function topFinancialAlert(order: any) {
  const snapshot = order.financeSnapshot;
  if (snapshot.reconciliationStatus === "MISMATCH") return "Descuadre en conciliacion de cobro";
  if (snapshot.marginCents !== null && snapshot.marginCents < 0) return "Margen negativo";
  if (requiresMarginApproval(order)) return "Margen bajo pendiente de aprobacion";
  if (hasMonthlyBatchPending(order)) return "Factura de lote mensual vencida tras corte";
  if (!["VALIDATED", "PAID"].includes(snapshot.supplierInvoiceStatus)) return "Factura proveedor pendiente de validar";
  if (snapshot.accountingCutoffPassed && !snapshot.hasFinanceCloseEvent) return "Pendiente cierre contable del periodo";
  return "Revisar estado financiero";
}

export default async function ZonaTraductorPage({
  searchParams,
}: {
  searchParams: { filtro?: string; q?: string };
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
  const allOrdersWithFinance = allOrders.map((o) => ({
    ...o,
    financeSnapshot: getFinanceSnapshot(o),
  }));

  const filtro = searchParams.filtro || "todos";
  const qRaw = String(searchParams.q || "").trim();
  const q = qRaw.toLowerCase();

  const scopedOrders = q ? allOrdersWithFinance.filter((order) => matchesSearch(order, q)) : allOrdersWithFinance;

  const orders = scopedOrders.filter((order) => {
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
      case "riesgo-financiero":
        return hasFinancialRisk(order);
      case "margen-aprobacion":
        return requiresMarginApproval(order);
      case "lote-pendiente":
        return hasMonthlyBatchPending(order);
      default:
        return true;
    }
  });

  const counts = {
    todos: scopedOrders.length,
    "pagados-sin-asignar": scopedOrders.filter((o) => o.paymentStatus === "PAID" && !o.assignedTo && o.deliveryState !== "TRADUCIDO").length,
    "en-proceso": scopedOrders.filter((o) => o.deliveryState === "EN_PROCESO").length,
    "sla-riesgo": scopedOrders.filter((o) => o.dueDate && (isDueSoon(o.dueDate) || isOverdue(o.dueDate)) && o.deliveryState !== "TRADUCIDO").length,
    "pendientes-pago": scopedOrders.filter((o) => o.paymentStatus === "PENDING").length,
    traducidos: scopedOrders.filter((o) => o.deliveryState === "TRADUCIDO").length,
    "riesgo-financiero": scopedOrders.filter((o) => hasFinancialRisk(o)).length,
    "margen-aprobacion": scopedOrders.filter((o) => requiresMarginApproval(o)).length,
    "lote-pendiente": scopedOrders.filter((o) => hasMonthlyBatchPending(o)).length,
  };

  const paidCount = scopedOrders.filter((o) => o.paymentStatus === "PAID").length;
  const inProgressCount = scopedOrders.filter((o) => o.deliveryState === "EN_PROCESO").length;
  const pendingPayCount = scopedOrders.filter((o) => o.paymentStatus === "PENDING").length;
  const financialRiskCount = counts["riesgo-financiero"];
  const marginApprovalPendingCount = counts["margen-aprobacion"];
  const monthlyBatchPendingCount = counts["lote-pendiente"];
  const financeClosedCount = scopedOrders.filter((o) => o.financeSnapshot.hasFinanceCloseEvent).length;
  const paidRevenueCents = scopedOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((acc, order) => acc + order.amountCents, 0);
  const supplierPaymentPendingCount = scopedOrders.filter(
    (o) => o.paymentStatus === "PAID" && o.financeSnapshot.supplierInvoiceStatus !== "PAID"
  ).length;

  const marginValues = scopedOrders
    .map((o) => o.financeSnapshot.marginPct)
    .filter((v): v is number => typeof v === "number");
  const avgMarginPct = marginValues.length
    ? Number((marginValues.reduce((acc, v) => acc + v, 0) / marginValues.length).toFixed(2))
    : null;

  const criticalFinanceOrders = scopedOrders
    .filter(
      (o) =>
        hasFinancialRisk(o) ||
        requiresMarginApproval(o) ||
        hasMonthlyBatchPending(o) ||
        (o.paymentStatus === "PAID" && o.financeSnapshot.accountingCutoffPassed && !o.financeSnapshot.hasFinanceCloseEvent)
    )
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-10">
      <AutoRefresh intervalMs={4000} />
      <section className="mx-auto max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Zona traductor</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Gestion operativa + control economico
        </h1>
        <p className="mt-1 text-sm text-slate-400">Sesion: {email}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-center">
            <p className="text-2xl font-bold text-white">{scopedOrders.length}</p>
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
            Margen medio con datos:{" "}
            <span className="font-semibold text-slate-100">{avgMarginPct === null ? "—" : `${avgMarginPct}%`}</span>
          </p>
          <p className="mt-1 text-slate-400">
            Si un pedido cae por debajo del umbral de margen (10%), queda bloqueado para cierre hasta aprobar.
          </p>
        </div>
      </section>

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
        items={allOrdersWithFinance.map((o) => ({
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

        <ZonaTraductorFilters current={filtro} counts={counts} query={qRaw} />

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
                  <th className="px-4 py-3 font-semibold">Comprobante</th>
                  <th className="px-4 py-3 font-semibold">Finanzas</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {orders.map((order) => {
                  const overdue = isOverdue(order.dueDate);
                  const dueSoon = isDueSoon(order.dueDate);
                  const paymentProofs = getPaymentProofs(order);
                  const latestProof = paymentProofs[0];
                  const financeRisk = hasFinancialRisk(order);
                  const financialLabel = financeRisk ? "Riesgo" : "OK";
                  const financeTitle = order.financeSnapshot.warnings.length
                    ? order.financeSnapshot.warnings.join(" | ")
                    : "Sin alertas financieras";
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
                      <td className="px-4 py-3">
                        {latestProof ? (
                          <a
                            href={latestProof.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-lg border border-cyan-500/40 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                          >
                            Ver
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" title={financeTitle}>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                            financeRisk
                              ? "border-red-500/40 bg-red-500/10 text-red-300"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {financialLabel}
                        </span>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {order.financeSnapshot.marginPct === null ? "Margen —" : `Margen ${order.financeSnapshot.marginPct}%`}
                          {requiresMarginApproval(order) ? " · aprobar" : ""}
                          {hasMonthlyBatchPending(order) ? " · lote vencido" : ""}
                        </p>
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-400" title={order.clientEmail}>
                        {order.clientEmail}
                      </td>
                      <td className="px-4 py-3">
                        {order.paymentStatus === "PENDING" && <ConfirmPaymentButton reference={order.reference} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
              clientEmail={order.clientEmail}
              title={order.title}
              langPair={order.langPair}
              paymentStatus={order.paymentStatus}
              deliveryState={order.deliveryState}
              assignedTo={order.assignedTo}
              dueDate={order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : null}
              amountCents={order.amountCents}
              paymentProofs={getPaymentProofs(order)}
              financeSnapshot={order.financeSnapshot}
            />
          ))}
        </section>
      )}
    </main>
  );
}
