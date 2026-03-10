"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BulkDeleteBar from "./BulkDeleteBar";
import ConfirmPaymentButton from "./ConfirmPaymentButton";

type OrderRow = {
  reference: string;
  title: string;
  amountCents: number;
  paymentStatus: string;
  deliveryState: string;
  workflowState: string;
  workflowStateLabel: string;
  acquisitionSource: "WHATSAPP" | "WEB";
  assignedTo: string | null;
  dueDate: string | null;
  dueSoon: boolean;
  overdue: boolean;
  clientEmail: string;
  clientName: string | null;
  langPair: string | null;
  latestProofUrl: string | null;
  financeRisk: boolean;
  financeTitle: string;
  marginPct: number | null;
  requiresMarginApproval: boolean;
  hasMonthlyBatchPending: boolean;
  quickQuoteHref: string;
  showConfirmPayment: boolean;
  hasWorkspaceAccess: boolean;
};

type Props = {
  orders: OrderRow[];
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
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

function WorkflowBadge({ state, label }: { state: string; label: string }) {
  const palette: Record<string, string> = {
    BORRADOR: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    PENDIENTE_REVISION: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    PRESUPUESTO_ENVIADO: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    PENDIENTE_PAGO: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    JUSTIFICANTE_SUBIDO: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    PAGO_VALIDADO: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    EN_TRADUCCION: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    TRADUCIDO_ENTREGADO: "bg-lime-500/20 text-lime-300 border-lime-500/30",
    CERRADO: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  };
  const cls = palette[state] || palette.PENDIENTE_PAGO;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function ChannelBadge({ source }: { source: "WHATSAPP" | "WEB" }) {
  const cls =
    source === "WHATSAPP"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : "border-slate-500/40 bg-slate-500/10 text-slate-300";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {source === "WHATSAPP" ? "WhatsApp" : "Web"}
    </span>
  );
}

export default function OrderTableWithBulkActions({ orders }: Props) {
  const router = useRouter();
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const allRefs = orders.map((o) => o.reference);
  const allSelected = allRefs.length > 0 && allRefs.every((r) => selectedRefs.has(r));

  function toggleRef(ref: string) {
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedRefs(new Set());
    } else {
      setSelectedRefs(new Set(allRefs));
    }
  }

  async function handleBulkDelete() {
    const refs = Array.from(selectedRefs);
    if (refs.length === 0) return;

    const confirmed = window.confirm(
      `¿Eliminar ${refs.length} pedido${refs.length > 1 ? "s" : ""} definitivamente?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: refs }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || "Error al eliminar pedidos.");
        return;
      }
      setSelectedRefs(new Set());
      router.refresh();
    } catch {
      alert("Error de red al eliminar pedidos.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Ref.</th>
              <th className="px-4 py-3 font-semibold">Titulo</th>
              <th className="px-4 py-3 font-semibold">Importe</th>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Canal</th>
              <th className="px-4 py-3 font-semibold">Workflow</th>
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
              const isSelected = selectedRefs.has(order.reference);
              return (
                <tr
                  key={order.reference}
                  className={`transition-colors hover:bg-slate-800/40 ${
                    isSelected
                      ? "bg-cyan-500/10"
                      : order.overdue
                        ? "bg-red-500/5"
                        : order.dueSoon
                          ? "bg-amber-500/5"
                          : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRef(order.reference)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-300">{order.reference}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-300" title={order.title}>
                    {order.title}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-200">{formatMoney(order.amountCents)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={order.paymentStatus} /></td>
                  <td className="px-4 py-3"><ChannelBadge source={order.acquisitionSource} /></td>
                  <td className="px-4 py-3"><WorkflowBadge state={order.workflowState} label={order.workflowStateLabel} /></td>
                  <td className="px-4 py-3"><DeliveryBadge state={order.deliveryState} /></td>
                  <td className="px-4 py-3 text-xs text-slate-300">{order.assignedTo || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3">
                    {order.dueDate ? (
                      <span
                        className={`text-xs font-semibold ${
                          order.overdue ? "text-red-400" : order.dueSoon ? "text-amber-400" : "text-slate-300"
                        }`}
                      >
                        {formatDate(order.dueDate)}
                        {order.overdue && " !"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {order.latestProofUrl ? (
                      <a
                        href={order.latestProofUrl}
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
                  <td className="px-4 py-3" title={order.financeTitle}>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        order.financeRisk
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {order.financeRisk ? "Riesgo" : "OK"}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {order.marginPct === null ? "Margen —" : `Margen ${order.marginPct}%`}
                      {order.requiresMarginApproval ? " · aprobar" : ""}
                      {order.hasMonthlyBatchPending ? " · lote vencido" : ""}
                    </p>
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-400" title={order.clientEmail}>
                    {order.clientEmail}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={order.quickQuoteHref}
                      className="mb-2 inline-flex rounded-lg border border-cyan-500/40 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/10"
                    >
                      Presupuesto pro
                    </a>
                    {order.hasWorkspaceAccess && (
                      <>
                        <br />
                        <a
                          href={`/zona-traductor/workspace/${order.reference}`}
                          className="mb-2 inline-flex rounded-lg border border-indigo-500/40 px-2 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/10"
                        >
                          Workspace
                        </a>
                      </>
                    )}
                    <br />
                    {order.showConfirmPayment && (
                      <ConfirmPaymentButton reference={order.reference} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkDeleteBar
        selectedCount={selectedRefs.size}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedRefs(new Set())}
        isDeleting={isDeleting}
      />
    </>
  );
}
