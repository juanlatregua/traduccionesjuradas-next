"use client";

import { useMemo, useState } from "react";
import OrderActionPanel from "./OrderActionPanel";
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
  assignedTo: string | null;
  dueDate: string | null;
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
    deliveredFileUrl: string | null;
    deliveredFilename: string | null;
    deliveredAt: string | null;
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
                  <OrderActionPanel
                    key={order.reference}
                    variant="card"
                    isOverdue={order.overdue}
                    isDueSoon={order.dueSoon}
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
                    dueDate={order.dueDate}
                    amountCents={order.amountCents}
                    paymentProofs={order.paymentProofs}
                    documents={order.documents}
                    quoteDraft={order.quoteDraft}
                    quoteAuditTrail={order.quoteAuditTrail}
                    isArchived={order.isArchived}
                    financeSnapshot={order.financeSnapshot}
                    artifacts={order.artifacts}
                    deliveryNotification={order.deliveryNotification}
                    trackedLinks={order.trackedLinks}
                    collaboratorAssignments={order.collaboratorAssignments}
                    draftFileUrl={order.draftFileUrl}
                    draftFilename={order.draftFilename}
                    draftGeneratedAt={order.draftGeneratedAt}
                    canonicalStage={order.canonicalStage}
                    gates={order.gates}
                    nextBestAction={order.nextBestAction}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
