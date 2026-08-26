"use client";

import { useMemo, useState } from "react";
import ConfirmPaymentButton from "./ConfirmPaymentButton";
import type { FinanceSnapshot } from "@/lib/finance";
import type { NextBestAction, OrderActionStage, OrderGates } from "@/lib/order-actions";

export type BandejaOrder = {
  reference: string;
  clientName?: string | null;
  clientEmail: string;
  title: string;
  langPair: string | null;
  paymentStatus: string;
  deliveryState: string;
  workflowState: string;
  isArchived: boolean;
  acquisitionSource: "WHATSAPP" | "WEB";
  createdAt: string;
  assignedTo: string | null;
  dueDate: string | null;
  // El traductor ya entregó (sobre de lavori, asignación o campo del pedido) aunque el
  // pedido siga sin DELIVERED: lo que falta es de Juan (papel, verificar). Agenda 26-ago.
  translatorDeliveredAt?: string | null;
  deliveryType?: string | null;
  amountCents: number;
  paymentProofs: Array<{ fileUrl: string; fileName: string; uploadedAt?: string }>;
  documents: Array<{ name: string; type: string; size: number; url?: string; uploadedAt?: string }>;
  quoteDraft?: {
    lines: Array<{ documentName: string; amountCents: number; notes?: string | null }>;
    totalCents: number | null;
    updatedAt?: string | null;
  } | null;
  quoteAuditTrail?: Array<{
    type: string;
    message: string;
    createdAt: string | null;
    actorEmail?: string | null;
    toEmail?: string | null;
    paymentUrl?: string | null;
    subject?: string | null;
    error?: string | null;
    provider?: string | null;
    providerMessageId?: string | null;
    totalCents?: number | null;
    lines?: Array<{ documentName: string; amountCents: number; notes?: string | null }>;
  }>;
  financeSnapshot: FinanceSnapshot;
  artifacts: {
    quotePreviewFileKey?: string | null;
    quotePreviewFileUrl?: string | null;
    quoteSnapshotJson?: unknown;
    paymentProofFileKey?: string | null;
    finalDeliveryFileKey?: string | null;
    finalDeliveryFileUrl?: string | null;
    finalFilename?: string | null;
    finalMimeType?: string | null;
  };
  deliveryNotification?: {
    type: string;
    sentAt: string | null;
    toEmail?: string | null;
    channel?: string | null;
    downloadUrl?: string | null;
  } | null;
  trackedLinks: { paymentUrl: string; statusUrl: string };
  collaboratorAssignments: Array<{
    id: string;
    status: string;
    collaboratorId: string;
    quotedPriceCents: number | null;
    quotedDeadline: string | null;
    collaboratorNotes: string | null;
    rejectionReason: string | null;
    revisionReason: string | null;
    deliveredFileUrl: string | null;
    deliveredFilename: string | null;
    deliveredAt: string | null;
    isWinning?: boolean;
    adminNotes: string | null;
    collaborator: { fullName: string; email: string };
  }>;
  draftFileUrl?: string | null;
  draftFilename?: string | null;
  draftGeneratedAt?: string | null;
  canonicalStage: OrderActionStage;
  gates: OrderGates;
  nextBestAction: NextBestAction;
  overdue: boolean;
  dueSoon: boolean;
};

type Props = {
  orders: BandejaOrder[];
  staffEmail: string;
};

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PAID: { label: "Pagado", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    PENDING: { label: "Pendiente", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    FAILED: { label: "Fallido", cls: "bg-red-500/20 text-red-300 border-red-500/30" },
    REFUNDED: { label: "Reembolsado", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  };
  const info = map[status] || map.PENDING;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${info.cls}`}>
      {info.label}
    </span>
  );
}

function DeliveryBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESUPUESTO: { label: "Presupuesto", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    EN_PROCESO: { label: "En proceso", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    TRADUCIDO: { label: "Traducido", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  };
  const info = map[state] || map.PRESUPUESTO;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${info.cls}`}>
      {info.label}
    </span>
  );
}

// Card resumen: la gestión completa vive en el detalle canónico /zona-traductor/pedido/[ref].
function BandejaOrderCard({ order }: { order: BandejaOrder }) {
  const quickQuoteHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("customerEmail", order.clientEmail);
    if (order.clientName) params.set("customerName", order.clientName);
    params.set("lineDescription", order.title || "Traducción jurada");
    params.set("lineAmount", (Math.max(0, order.amountCents) / 100).toFixed(2));
    if (order.langPair) params.set("langPair", order.langPair);
    return `/admin/quotes/new?${params.toString()}`;
  }, [order]);

  const borderColor = order.overdue
    ? "border-l-4 border-l-red-500"
    : order.dueSoon
      ? "border-l-4 border-l-amber-500"
      : order.deliveryState === "EN_PROCESO"
        ? "border-l-4 border-l-blue-500"
        : "";

  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-900/80 px-5 py-4 transition-colors hover:border-slate-600 hover:bg-slate-800/50 ${borderColor}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-cyan-300">{order.reference}</span>
        {order.langPair && <span className="text-xs text-slate-500">{order.langPair}</span>}
        <PaymentBadge status={order.paymentStatus} />
        <DeliveryBadge state={order.deliveryState} />
        {order.collaboratorAssignments.some((a) => a.status === "DELIVERED" && a.deliveredFileUrl) && (
          <span className="inline-block rounded-full border bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 border-emerald-500/30">
            Entrega pendiente
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-sm text-slate-300">{order.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>{order.clientEmail}</span>
        <span className="font-medium text-slate-200">{(order.amountCents / 100).toFixed(2)} EUR</span>
        <span>
          {new Date(order.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}
        </span>
        <span className={order.acquisitionSource === "WHATSAPP" ? "font-semibold text-emerald-400" : "text-slate-500"}>
          {order.acquisitionSource === "WHATSAPP" ? "WA" : "Web"}
        </span>
        {order.dueDate && (
          <span className={order.overdue ? "font-semibold text-red-400" : order.dueSoon ? "font-semibold text-amber-400" : ""}>
            Entrega: {new Date(order.dueDate).toLocaleDateString("es-ES")}
            {order.overdue && " (vencido)"}
          </span>
        )}
        {order.assignedTo && <span className="text-amber-300/80">→ {order.assignedTo}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/zona-traductor/pedido/${order.reference}`}
          className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
        >
          Abrir pedido
        </a>
        {order.nextBestAction.tab === "presupuesto" && (
          <a
            href={quickQuoteHref}
            className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
          >
            {order.nextBestAction.label}
          </a>
        )}
        {order.nextBestAction.tab === "workflow" && order.paymentStatus === "PENDING" && (
          <ConfirmPaymentButton reference={order.reference} />
        )}
      </div>
    </div>
  );
}

type FilterKey = "todos" | "urgentes" | "a-trabajar" | "en-curso" | "mis-pedidos";
type GroupKey = "urgente" | "aTrabajar" | "enCurso" | "pendientes";

const GROUP_META: Record<GroupKey, { label: string; color: string; defaultOpen: boolean }> = {
  urgente: { label: "URGENTE", color: "text-red-400", defaultOpen: true },
  aTrabajar: { label: "A TRABAJAR", color: "text-amber-400", defaultOpen: true },
  enCurso: { label: "EN CURSO", color: "text-blue-400", defaultOpen: false },
  pendientes: { label: "PENDIENTES", color: "text-slate-400", defaultOpen: false },
};

function classifyOrder(order: BandejaOrder): GroupKey {
  if (order.isArchived) return "pendientes";
  if ((order.overdue || order.dueSoon) && order.deliveryState !== "TRADUCIDO") return "urgente";
  if (order.paymentStatus === "PAID" && order.deliveryState !== "TRADUCIDO") return "aTrabajar";
  if (order.deliveryState === "EN_PROCESO") return "enCurso";
  return "pendientes";
}

export default function BandejaEntrada({ orders, staffEmail }: Props) {
  const [filtro, setFiltro] = useState<FilterKey>("todos");
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>(() => ({
    urgente: false,
    aTrabajar: false,
    enCurso: true,
    pendientes: true,
  }));

  const activeOrders = useMemo(() => orders.filter((o) => !o.isArchived), [orders]);

  const filteredOrders = useMemo(() => {
    switch (filtro) {
      case "urgentes":
        return activeOrders.filter(
          (o) => (o.overdue || o.dueSoon) && o.deliveryState !== "TRADUCIDO"
        );
      case "a-trabajar":
        return activeOrders.filter(
          (o) => o.paymentStatus === "PAID" && o.deliveryState !== "TRADUCIDO" && !o.overdue && !o.dueSoon
        );
      case "en-curso":
        return activeOrders.filter((o) => o.deliveryState === "EN_PROCESO");
      case "mis-pedidos":
        return activeOrders.filter(
          (o) => o.assignedTo && o.assignedTo.toLowerCase().includes(staffEmail.toLowerCase())
        );
      default:
        return activeOrders;
    }
  }, [activeOrders, filtro, staffEmail]);

  const groups = useMemo(() => {
    const result: Record<GroupKey, BandejaOrder[]> = {
      urgente: [],
      aTrabajar: [],
      enCurso: [],
      pendientes: [],
    };
    for (const order of filteredOrders) {
      const group = classifyOrder(order);
      result[group].push(order);
    }
    return result;
  }, [filteredOrders]);

  const toggleGroup = (key: GroupKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pills: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "urgentes", label: "Urgentes" },
    { key: "a-trabajar", label: "A trabajar" },
    { key: "en-curso", label: "En curso" },
    { key: "mis-pedidos", label: "Mis pedidos" },
  ];

  const groupOrder: GroupKey[] = ["urgente", "aTrabajar", "enCurso", "pendientes"];

  return (
    <section className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFiltro(p.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              filtro === p.key
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-8">No hay pedidos con este filtro.</p>
      )}

      {/* Groups */}
      {groupOrder.map((groupKey) => {
        const items = groups[groupKey];
        if (items.length === 0) return null;
        const meta = GROUP_META[groupKey];
        const isCollapsed = collapsed[groupKey];

        return (
          <div key={groupKey}>
            <button
              type="button"
              onClick={() => toggleGroup(groupKey)}
              className="flex w-full items-center gap-2 py-2 text-left"
            >
              <svg
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                {meta.label}
              </span>
              <span className="text-xs text-slate-500">({items.length})</span>
            </button>

            {!isCollapsed && (
              <div className="space-y-3 pl-1">
                {items.map((order) => (
                  <BandejaOrderCard key={order.reference} order={order} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
