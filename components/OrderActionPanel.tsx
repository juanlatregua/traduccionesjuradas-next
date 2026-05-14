"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AssignOrderForm from "./AssignOrderForm";
import TranslatorNotifyForm from "./TranslatorNotifyForm";
import OrderFinancePanel from "./OrderFinancePanel";
import OrderWorkflowPanel from "./OrderWorkflowPanel";
import OrderDocumentsPanel from "./OrderDocumentsPanel";
import OrderLifecyclePanel from "./OrderLifecyclePanel";
import CollaboratorAssignmentPanel from "./CollaboratorAssignmentPanel";
import DraftGeneratorButton from "./DraftGeneratorButton";
import ConfirmPaymentButton from "./ConfirmPaymentButton";
import SourceDocumentUpload from "./SourceDocumentUpload";
import CopyField from "./CopyField";
import type { FinanceSnapshot } from "@/lib/finance";
import { getWorkflowStateLabel } from "@/lib/workflow";
import type { NextBestAction, OrderActionStage, OrderGates } from "@/lib/order-actions";

type Props = {
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
  paymentProofs: Array<{
    fileUrl: string;
    fileName: string;
    uploadedAt?: string;
  }>;
  documents: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
    uploadedAt?: string;
  }>;
  quoteDraft?: {
    lines: Array<{
      documentName: string;
      amountCents: number;
      notes?: string | null;
    }>;
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
    lines?: Array<{
      documentName: string;
      amountCents: number;
      notes?: string | null;
    }>;
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
  trackedLinks: {
    paymentUrl: string;
    statusUrl: string;
  };
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
    adminNotes: string | null;
    collaborator: {
      fullName: string;
      email: string;
    };
  }>;
  draftFileUrl?: string | null;
  draftFilename?: string | null;
  draftGeneratedAt?: string | null;
  createdAt?: string | null;
  canonicalStage: OrderActionStage;
  gates: OrderGates;
  nextBestAction: NextBestAction;
  variant?: "default" | "card";
  isOverdue?: boolean;
  isDueSoon?: boolean;
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

function StageBadge({ stage }: { stage: OrderActionStage }) {
  const map: Record<OrderActionStage, { label: string; cls: string }> = {
    DRAFT: { label: "DRAFT", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
    QUOTE_READY: { label: "QUOTE_READY", cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
    SENT_TO_CLIENT: { label: "SENT_TO_CLIENT", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    PAYMENT_PENDING: { label: "PAYMENT_PENDING", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    PAYMENT_VALIDATED: { label: "PAYMENT_VALIDATED", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    IN_PRODUCTION: { label: "IN_PRODUCTION", cls: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    DELIVERY_READY: { label: "DELIVERY_READY", cls: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
    DELIVERED: { label: "DELIVERED", cls: "bg-lime-500/20 text-lime-300 border-lime-500/30" },
    CLOSED: { label: "CLOSED", cls: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30" },
  };
  const info = map[stage];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${info.cls}`}>
      {info.label}
    </span>
  );
}

export default function OrderActionPanel({
  reference,
  clientName,
  clientEmail,
  title,
  langPair,
  paymentStatus,
  deliveryState,
  workflowState,
  isArchived,
  acquisitionSource,
  assignedTo,
  dueDate,
  amountCents,
  paymentProofs,
  documents,
  quoteDraft,
  quoteAuditTrail,
  financeSnapshot,
  artifacts,
  deliveryNotification,
  trackedLinks,
  collaboratorAssignments,
  draftFileUrl,
  draftFilename,
  draftGeneratedAt,
  createdAt,
  canonicalStage,
  gates,
  nextBestAction,
  variant = "default",
  isOverdue: overdue = false,
  isDueSoon: dueSoon = false,
}: Props) {
  const router = useRouter();
  const lastRefreshedTab = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<
    "presupuesto" | "documentos" | "comprobante" | "workflow" | "asignar" | "entrega" | "notificar" | "finanzas" | "control"
  >("presupuesto");

  const quickQuoteHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("customerEmail", clientEmail);
    if (clientName) params.set("customerName", clientName);
    params.set("lineDescription", title || "Traducción jurada");
    params.set("lineAmount", (Math.max(0, amountCents) / 100).toFixed(2));
    if (langPair) params.set("langPair", langPair);
    return `/admin/quotes/new?${params.toString()}`;
  }, [clientEmail, clientName, title, amountCents, langPair]);

  const allTabs = [
    { key: "presupuesto" as const, label: "Presupuesto", color: "text-cyan-300" },
    { key: "documentos" as const, label: "Documentos", color: "text-teal-300" },
    { key: "comprobante" as const, label: "Comprobante", color: "text-cyan-300" },
    { key: "workflow" as const, label: "Workflow", color: "text-indigo-300" },
    { key: "asignar" as const, label: "Asignar", color: "text-amber-300" },
    { key: "entrega" as const, label: "Entrega", color: "text-emerald-300" },
    { key: "notificar" as const, label: "Notificar", color: "text-violet-300" },
    { key: "finanzas" as const, label: "Finanzas", color: "text-lime-300" },
    { key: "control" as const, label: "Control", color: "text-rose-300" },
  ];

  // Tabs relevantes según el stage del pedido
  const visibleTabKeys = useMemo(() => {
    const always = ["presupuesto", "documentos", "workflow"] as const;
    const stage = canonicalStage;
    const extra: string[] = [];

    if (stage === "DRAFT" || stage === "QUOTE_READY" || stage === "SENT_TO_CLIENT") {
      extra.push("notificar");
    }
    if (stage === "PAYMENT_PENDING" || stage === "PAYMENT_VALIDATED" || stage === "IN_PRODUCTION" || stage === "DELIVERY_READY" || stage === "DELIVERED" || stage === "CLOSED") {
      extra.push("comprobante", "asignar", "entrega", "notificar");
    }
    if (stage === "DELIVERED" || stage === "CLOSED") {
      extra.push("finanzas", "control");
    }
    // Siempre mostrar finanzas si ya hay pago validado
    if (paymentStatus === "PAID") {
      extra.push("finanzas");
    }
    // Siempre mostrar control para poder archivar
    extra.push("control");

    const set = new Set([...always, ...extra]);
    return set;
  }, [canonicalStage, paymentStatus]);

  const tabs = allTabs.filter((t) => visibleTabKeys.has(t.key));

  const finalDownloadUrl = String(artifacts.finalDeliveryFileUrl || "").trim();
  const quotePreviewUrl = String(artifacts.quotePreviewFileUrl || "").trim();
  const latestProofUrl = String(paymentProofs?.[0]?.fileUrl || "").trim();
  const canClose = gates.closeReady;

  useEffect(() => {
    if (!open) {
      lastRefreshedTab.current = null;
      return;
    }
    if (lastRefreshedTab.current === tab) return;
    lastRefreshedTab.current = tab;
    router.refresh();
  }, [open, tab, router]);

  const showWorkspaceLink = paymentStatus === "PAID" || deliveryState === "EN_PROCESO";
  const nbaIsWorkspace = nextBestAction.tab === "entrega" && showWorkspaceLink;
  const borderColor = overdue
    ? "border-l-4 border-l-red-500"
    : dueSoon
      ? "border-l-4 border-l-amber-500"
      : deliveryState === "EN_PROCESO"
        ? "border-l-4 border-l-blue-500"
        : "";

  if (variant === "card") {
    return (
      <div className={`rounded-2xl border border-slate-700 bg-slate-900/80 overflow-hidden ${borderColor} ${open ? "" : "hover:border-slate-600 hover:bg-slate-800/50 transition-colors"}`}>
        {/* Card header */}
        <div
          className="cursor-pointer px-5 py-4"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a, button")) return;
            setOpen(!open);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-cyan-300">{reference}</span>
            {langPair && <span className="text-xs text-slate-500">{langPair}</span>}
            <PaymentBadge status={paymentStatus} />
            <DeliveryBadge state={deliveryState} />
            {collaboratorAssignments.some((a) => a.status === "DELIVERED" && a.deliveredFileUrl) && (
              <span className="inline-block rounded-full border bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 border-emerald-500/30">
                Entrega pendiente
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-300">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>{clientEmail}</span>
            <span className="font-medium text-slate-200">{(amountCents / 100).toFixed(2)} EUR</span>
            {createdAt && (
              <span>{new Date(createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
            )}
            <span className={acquisitionSource === "WHATSAPP" ? "font-semibold text-emerald-400" : "text-slate-500"}>
              {acquisitionSource === "WHATSAPP" ? "WA" : "Web"}
            </span>
            {dueDate && (
              <span className={overdue ? "font-semibold text-red-400" : dueSoon ? "font-semibold text-amber-400" : ""}>
                Entrega: {new Date(dueDate).toLocaleDateString("es-ES")}
                {overdue && " (vencido)"}
              </span>
            )}
            {assignedTo && <span className="text-amber-300/80">→ {assignedTo}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {showWorkspaceLink && (
              <a
                href={`/zona-traductor/workspace/${reference}`}
                className="rounded-lg border border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/10"
                onClick={(e) => e.stopPropagation()}
              >
                Workspace
              </a>
            )}
            {!nbaIsWorkspace && nextBestAction.tab === "presupuesto" && (
              <a
                href={quickQuoteHref}
                className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                onClick={(e) => e.stopPropagation()}
              >
                {nextBestAction.label}
              </a>
            )}
            {!nbaIsWorkspace && nextBestAction.tab === "workflow" && paymentStatus === "PENDING" && (
              <span onClick={(e) => e.stopPropagation()}>
                <ConfirmPaymentButton reference={reference} />
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
            >
              {open ? "Ocultar" : "Ver detalle"}
            </button>
          </div>
        </div>

        {/* Expanded panel */}
        {open && (
          <div className="border-t border-slate-700">
            {/* Reuse same expanded content as default variant */}
            <div className="border-b border-slate-700/50 bg-slate-800/30 px-5 py-4">
              <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                <p>Cliente: <span className="font-semibold text-slate-100">{clientEmail}</span></p>
                <p>Referencia: <span className="font-mono font-semibold text-cyan-300">{reference}</span></p>
                <p>Importe: <span className="font-semibold text-slate-100">{(amountCents / 100).toFixed(2)} EUR</span></p>
                <p>Workflow: <span className="font-semibold text-slate-100">{getWorkflowStateLabel(workflowState)}</span></p>
                <p>Canal: <span className="font-semibold text-slate-100">{acquisitionSource === "WHATSAPP" ? "WhatsApp" : "Web"}</span></p>
                <p>Entrega prevista: <span className="font-semibold text-slate-100">{dueDate ? new Date(dueDate).toLocaleDateString("es-ES") : "—"}</span></p>
                <p>Stage canonico: <StageBadge stage={canonicalStage} /></p>
                <p>Conciliacion: <span className={["MATCHED", "RECONCILED"].includes(financeSnapshot.reconciliationStatus) ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>{financeSnapshot.reconciliationStatus}</span></p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <CopyField label="Referencia" value={reference} />
                <CopyField label="Email cliente" value={clientEmail} mono={false} />
              </div>
            </div>

            <div className="flex flex-wrap border-b border-slate-700/50">
              {tabs.map((t) => {
                const isRecommended = t.key === nextBestAction.tab && tab !== t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                      tab === t.key
                        ? `${t.color} border-b-2 border-current bg-slate-800/40`
                        : isRecommended
                          ? "text-emerald-400 animate-pulse hover:text-emerald-300"
                          : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t.label}
                    {isRecommended && <span className="ml-1 text-[9px]">●</span>}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {tab === "presupuesto" && (
                <OrderDocumentsPanel reference={reference} workflowState={workflowState} amountCents={amountCents} documents={documents} quoteDraft={quoteDraft || null} quoteAuditTrail={quoteAuditTrail || []} />
              )}
              {tab === "documentos" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Documentos del cliente</p>
                  {documents.length === 0 ? (
                    <p className="text-sm text-slate-400">No hay documentos guardados en este pedido.</p>
                  ) : (
                    <ul className="space-y-2">
                      {documents.map((doc, idx) => (
                        <li key={`${doc.name}-${idx}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200">
                          <p className="font-semibold text-slate-100">{doc.name}</p>
                          <p className="text-xs text-slate-400">{doc.type || "application/octet-stream"}</p>
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10">Abrir documento</a>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">Sin URL registrada.</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <SourceDocumentUpload reference={reference} />
                </div>
              )}
              {tab === "comprobante" && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Comprobante de pago</p>
                  {paymentProofs.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">Aun no se ha subido comprobante.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {paymentProofs.map((proof, idx) => (
                        <li key={`${proof.fileUrl}-${idx}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200">
                          <p className="font-semibold text-slate-100">{proof.fileName || "Comprobante"}</p>
                          {proof.uploadedAt && <p className="text-xs text-slate-400">Subido: {new Date(proof.uploadedAt).toLocaleString("es-ES")}</p>}
                          <a href={proof.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10">Abrir comprobante</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {tab === "workflow" && <OrderWorkflowPanel reference={reference} currentState={workflowState} />}
              {tab === "asignar" && (
                <div className="space-y-8">
                  <AssignOrderForm reference={reference} currentAssignedTo={assignedTo} currentDueDate={dueDate} />
                  <div className="border-t border-slate-700/50 pt-6">
                    <CollaboratorAssignmentPanel reference={reference} langPair={langPair} assignments={collaboratorAssignments} />
                  </div>
                </div>
              )}
              {tab === "entrega" && (
                <div className="space-y-6">
                  {(paymentStatus === "PAID" || deliveryState === "EN_PROCESO" || draftFileUrl) && (
                    <DraftGeneratorButton orderReference={reference} documents={documents} langPair={langPair} existingDraftUrl={draftFileUrl} existingDraftFilename={draftFilename} existingDraftGeneratedAt={draftGeneratedAt} />
                  )}
                  <a
                  href={`/zona-traductor/workspace/${reference}`}
                  className="block rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 hover:bg-indigo-500/10 transition-colors"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                    Estado de entrega
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    Abrir Workspace de traducción →
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Editor lado a lado, draft IA, marcar entrega y notificar cliente.
                  </p>
                </a>
                </div>
              )}
              {tab === "notificar" && (
                <TranslatorNotifyForm reference={reference} defaultClientEmail={clientEmail} acquisitionSource={acquisitionSource} defaultDownloadUrl={finalDownloadUrl || undefined} quotePreviewUrl={String(artifacts.quotePreviewFileUrl || "") || undefined} paymentLink={trackedLinks.paymentUrl} statusLink={trackedLinks.statusUrl} deliveryNotifiedAt={deliveryNotification?.sentAt || null} deliveryNotifiedTo={deliveryNotification?.toEmail || null} canonicalStage={canonicalStage} />
              )}
              {tab === "finanzas" && <OrderFinancePanel reference={reference} amountCents={amountCents} snapshot={financeSnapshot} />}
              {tab === "control" && <OrderLifecyclePanel reference={reference} isArchived={isArchived} canonicalStage={canonicalStage} gates={gates} canClose={canClose} />}
            </div>
          </div>
        )}
      </div>
    );
  }

  // variant === "default" — original behavior
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/90 overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-800/50"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-cyan-300">{reference}</span>
          <span className="text-sm text-slate-300 truncate max-w-[200px]">{title}</span>
          {langPair && <span className="text-xs text-slate-500">{langPair}</span>}
          <PaymentBadge status={paymentStatus} />
          <DeliveryBadge state={deliveryState} />
          {assignedTo && (
            <span className="text-xs text-amber-300/80">
              → {assignedTo}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-700">
          <div className="border-b border-slate-700/50 bg-slate-800/30 px-5 py-4">
            <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
              <p>
                Cliente: <span className="font-semibold text-slate-100">{clientEmail}</span>
              </p>
              <p>
                Referencia: <span className="font-mono font-semibold text-cyan-300">{reference}</span>
              </p>
              <p>
                Importe: <span className="font-semibold text-slate-100">{(amountCents / 100).toFixed(2)} EUR</span>
              </p>
              <p>
                Workflow: <span className="font-semibold text-slate-100">{getWorkflowStateLabel(workflowState)}</span>
              </p>
              <p>
                Canal: <span className="font-semibold text-slate-100">{acquisitionSource === "WHATSAPP" ? "WhatsApp" : "Web"}</span>
              </p>
              <p>
                Entrega prevista:{" "}
                <span className="font-semibold text-slate-100">
                  {dueDate ? new Date(dueDate).toLocaleDateString("es-ES") : "—"}
                </span>
              </p>
              <p>
                Stage canonico: <StageBadge stage={canonicalStage} />
              </p>
              <p>
                Conciliacion:{" "}
                <span
                  className={
                    ["MATCHED", "RECONCILED"].includes(financeSnapshot.reconciliationStatus)
                      ? "font-semibold text-emerald-300"
                      : "font-semibold text-amber-300"
                  }
                >
                  {financeSnapshot.reconciliationStatus}
                </span>
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <CopyField label="Referencia" value={reference} />
              <CopyField label="Email cliente" value={clientEmail} mono={false} />
            </div>
          </div>

          <div className="border-b border-slate-700/50 bg-slate-900/60 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Next Best Action</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{nextBestAction.label}</p>
            <p className="mt-1 text-xs text-slate-400">{nextBestAction.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab(nextBestAction.tab)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Ir a {nextBestAction.tab}
              </button>
              {(canonicalStage === "DRAFT" || canonicalStage === "QUOTE_READY") && (
                <a
                  href={quickQuoteHref}
                  className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                >
                  Crear presupuesto con preview
                </a>
              )}
              {paymentStatus === "PAID" && assignedTo && (
                <a
                  href={`/zona-traductor/workspace/${reference}`}
                  className="rounded-lg border border-indigo-500/40 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/10"
                >
                  Abrir workspace
                </a>
              )}
            </div>
          </div>

          <div className="border-b border-slate-700/50 bg-slate-950/60 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
              Artefactos clave del pedido
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Enlaces persistidos en DB para evitar perder contexto entre pestañas.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {quotePreviewUrl ? (
                <CopyField
                  label="Preview presupuesto"
                  value={quotePreviewUrl}
                  actionLabel="Abrir"
                  actionHref={quotePreviewUrl}
                />
              ) : (
                <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-amber-300">
                  Falta preview de presupuesto.
                </p>
              )}
              {latestProofUrl ? (
                <CopyField
                  label="Comprobante pago"
                  value={latestProofUrl}
                  actionLabel="Abrir"
                  actionHref={latestProofUrl}
                />
              ) : (
                <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-amber-300">
                  Sin comprobante registrado.
                </p>
              )}
              {finalDownloadUrl ? (
                <CopyField
                  label="Entrega final"
                  value={finalDownloadUrl}
                  actionLabel="Abrir"
                  actionHref={finalDownloadUrl}
                />
              ) : (
                <p className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-amber-300">
                  Falta archivo final de entrega.
                </p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap border-b border-slate-700/50">
            {tabs.map((t) => {
              const isRecommended = t.key === nextBestAction.tab && tab !== t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    tab === t.key
                      ? `${t.color} border-b-2 border-current bg-slate-800/40`
                      : isRecommended
                        ? "text-emerald-400 animate-pulse hover:text-emerald-300"
                        : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.label}
                  {isRecommended && <span className="ml-1 text-[9px]">●</span>}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {tab === "presupuesto" && (
              <OrderDocumentsPanel
                reference={reference}
                workflowState={workflowState}
                amountCents={amountCents}
                documents={documents}
                quoteDraft={quoteDraft || null}
                quoteAuditTrail={quoteAuditTrail || []}
              />
            )}
            {tab === "documentos" && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
                  Documentos del cliente
                </p>
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-400">No hay documentos guardados en este pedido.</p>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc, idx) => (
                      <li
                        key={`${doc.name}-${idx}`}
                        className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200"
                      >
                        <p className="font-semibold text-slate-100">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.type || "application/octet-stream"}</p>
                        {doc.url && doc.url.startsWith("http") ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                          >
                            Abrir documento
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">{doc.url?.includes("DELETED") ? "Eliminado (GDPR)" : "Sin URL registrada."}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <SourceDocumentUpload reference={reference} />
              </div>
            )}
            {tab === "comprobante" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Comprobante de pago
                </p>
                {paymentProofs.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">Aun no se ha subido comprobante.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {paymentProofs.map((proof, idx) => (
                      <li key={`${proof.fileUrl}-${idx}`} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200">
                        <p className="font-semibold text-slate-100">{proof.fileName || "Comprobante"}</p>
                        {proof.uploadedAt && (
                          <p className="text-xs text-slate-400">Subido: {new Date(proof.uploadedAt).toLocaleString("es-ES")}</p>
                        )}
                        <a
                          href={proof.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                        >
                          Abrir comprobante
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === "workflow" && (
              <OrderWorkflowPanel reference={reference} currentState={workflowState} />
            )}
            {tab === "asignar" && (
              <div className="space-y-8">
                <AssignOrderForm
                  reference={reference}
                  currentAssignedTo={assignedTo}
                  currentDueDate={dueDate}
                />
                <div className="border-t border-slate-700/50 pt-6">
                  <CollaboratorAssignmentPanel
                    reference={reference}
                    langPair={langPair}
                    assignments={collaboratorAssignments}
                  />
                </div>
              </div>
            )}
            {tab === "entrega" && (
              <div className="space-y-6">
                {(paymentStatus === "PAID" || deliveryState === "EN_PROCESO" || draftFileUrl) && (
                  <DraftGeneratorButton
                    orderReference={reference}
                    documents={documents}
                    langPair={langPair}
                    existingDraftUrl={draftFileUrl}
                    existingDraftFilename={draftFilename}
                    existingDraftGeneratedAt={draftGeneratedAt}
                  />
                )}
                <a
                  href={`/zona-traductor/workspace/${reference}`}
                  className="block rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 hover:bg-indigo-500/10 transition-colors"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                    Estado de entrega
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    Abrir Workspace de traducción →
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Editor lado a lado, draft IA, marcar entrega y notificar cliente.
                  </p>
                </a>
              </div>
            )}
            {tab === "notificar" && (
              <TranslatorNotifyForm
                reference={reference}
                defaultClientEmail={clientEmail}
                acquisitionSource={acquisitionSource}
                defaultDownloadUrl={finalDownloadUrl || undefined}
                quotePreviewUrl={String(artifacts.quotePreviewFileUrl || "") || undefined}
                paymentLink={trackedLinks.paymentUrl}
                statusLink={trackedLinks.statusUrl}
                deliveryNotifiedAt={deliveryNotification?.sentAt || null}
                deliveryNotifiedTo={deliveryNotification?.toEmail || null}
                canonicalStage={canonicalStage}
              />
            )}
            {tab === "finanzas" && (
              <OrderFinancePanel
                reference={reference}
                amountCents={amountCents}
                snapshot={financeSnapshot}
              />
            )}
            {tab === "control" && (
              <OrderLifecyclePanel
                reference={reference}
                isArchived={isArchived}
                canonicalStage={canonicalStage}
                gates={gates}
                canClose={canClose}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
