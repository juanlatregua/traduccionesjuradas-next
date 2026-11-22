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
    PAID: { label: "Pagado", cls: "bg-[#EEF7F1] text-[#1F6B45] border-[#BFE0CC]" },
    PENDING: { label: "Pendiente", cls: "bg-[#FFF8E6] text-[#7A5A10] border-[#E9D8A6]" },
    FAILED: { label: "Fallido", cls: "bg-[#FDF2F2] text-[#A12B2B] border-[#F0C9C9]" },
    REFUNDED: { label: "Reembolsado", cls: "bg-[#F6F7F9] text-[#52606D] border-[#D5DAE1]" },
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
    PRESUPUESTO: { label: "Presupuesto", cls: "bg-[#F6F7F9] text-[#52606D] border-[#D5DAE1]" },
    EN_PROCESO: { label: "En proceso", cls: "bg-[#F6F7F9] text-[#1A2E4A] border-[#D5DAE1]" },
    TRADUCIDO: { label: "Traducido", cls: "bg-[#EEF7F1] text-[#1F6B45] border-[#BFE0CC]" },
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
    BORRADOR: "bg-[#F6F7F9] text-[#1F2933] border-[#D5DAE1]",
    PENDIENTE_REVISION: "bg-[#FFF8E6] text-[#7A5A10] border-[#E9D8A6]",
    PRESUPUESTO_ENVIADO: "bg-[#F6F7F9] text-[#1A2E4A] border-[#D5DAE1]",
    PENDIENTE_PAGO: "bg-[#FFF8E6] text-[#7A5A10] border-[#E9D8A6]",
    JUSTIFICANTE_SUBIDO: "bg-[#F6F7F9] text-[#1A2E4A] border-[#D5DAE1]",
    PAGO_VALIDADO: "bg-[#EEF7F1] text-[#1F6B45] border-[#BFE0CC]",
    EN_TRADUCCION: "bg-[#F6F7F9] text-[#1A2E4A] border-[#D5DAE1]",
    TRADUCIDO_ENTREGADO: "bg-[#EEF7F1] text-[#1F6B45] border-[#BFE0CC]",
    CERRADO: "bg-[#F6F7F9] text-[#1A2E4A] border-[#D5DAE1]",
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
      ? "border-[#BFE0CC] bg-[#EEF7F1] text-[#1F6B45]"
      : "border-[#D5DAE1] bg-[#F6F7F9] text-[#1F2933]";
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
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D5DAE1]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F6F7F9] text-[11px] uppercase tracking-wider text-[#52606D]">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-[#D5DAE1] bg-[#F6F7F9] text-[#1A2E4A] focus:ring-[#1A2E4A]/30"
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
          <tbody className="divide-y divide-[#D5DAE1]">
            {orders.map((order) => {
              const isSelected = selectedRefs.has(order.reference);
              return (
                <tr
                  key={order.reference}
                  className={`transition-colors hover:bg-[#F6F7F9] ${
                    isSelected
                      ? "bg-[#F6F7F9]"
                      : order.overdue
                        ? "bg-[#FDF2F2]"
                        : order.dueSoon
                          ? "bg-[#FFF8E6]"
                          : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRef(order.reference)}
                      className="h-4 w-4 rounded border-[#D5DAE1] bg-[#F6F7F9] text-[#1A2E4A] focus:ring-[#1A2E4A]/30"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#1A2E4A]">{order.reference}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-[#1F2933]" title={order.title}>
                    {order.title}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[#1F2933]">{formatMoney(order.amountCents)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={order.paymentStatus} /></td>
                  <td className="px-4 py-3"><ChannelBadge source={order.acquisitionSource} /></td>
                  <td className="px-4 py-3"><WorkflowBadge state={order.workflowState} label={order.workflowStateLabel} /></td>
                  <td className="px-4 py-3"><DeliveryBadge state={order.deliveryState} /></td>
                  <td className="px-4 py-3 text-xs text-[#1F2933]">{order.assignedTo || <span className="text-[#52606D]">—</span>}</td>
                  <td className="px-4 py-3">
                    {order.dueDate ? (
                      <span
                        className={`text-xs font-semibold ${
                          order.overdue ? "text-[#A12B2B]" : order.dueSoon ? "text-[#7A5A10]" : "text-[#1F2933]"
                        }`}
                      >
                        {formatDate(order.dueDate)}
                        {order.overdue && " !"}
                      </span>
                    ) : (
                      <span className="text-xs text-[#52606D]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {order.latestProofUrl ? (
                      <a
                        href={order.latestProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg border border-[#D5DAE1] px-2 py-1 text-xs font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9]"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-xs text-[#52606D]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" title={order.financeTitle}>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        order.financeRisk
                          ? "border-[#F0C9C9] bg-[#FDF2F2] text-[#A12B2B]"
                          : "border-[#BFE0CC] bg-[#EEF7F1] text-[#1F6B45]"
                      }`}
                    >
                      {order.financeRisk ? "Riesgo" : "OK"}
                    </span>
                    <p className="mt-1 text-[10px] text-[#52606D]">
                      {order.marginPct === null ? "Margen —" : `Margen ${order.marginPct}%`}
                      {order.requiresMarginApproval ? " · aprobar" : ""}
                      {order.hasMonthlyBatchPending ? " · lote vencido" : ""}
                    </p>
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-xs text-[#52606D]" title={order.clientEmail}>
                    {order.clientEmail}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={order.quickQuoteHref}
                      className="mb-2 inline-flex rounded-lg border border-[#D5DAE1] px-2 py-1 text-[11px] font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9]"
                    >
                      Presupuesto pro
                    </a>
                    {order.hasWorkspaceAccess && (
                      <>
                        <br />
                        <a
                          href={`/zona-traductor/pedido/${order.reference}`}
                          className="mb-2 inline-flex rounded-lg border border-[#D5DAE1] px-2 py-1 text-[11px] font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9]"
                        >
                          Abrir pedido
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
