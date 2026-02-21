"use client";

import { useState } from "react";
import AssignOrderForm from "./AssignOrderForm";
import TranslatorDeliveryForm from "./TranslatorDeliveryForm";
import TranslatorNotifyForm from "./TranslatorNotifyForm";

type Props = {
  reference: string;
  clientEmail: string;
  title: string;
  langPair: string | null;
  paymentStatus: string;
  deliveryState: string;
  assignedTo: string | null;
  dueDate: string | null;
  amountCents: number;
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

export default function OrderActionPanel({
  reference,
  clientEmail,
  title,
  langPair,
  paymentStatus,
  deliveryState,
  assignedTo,
  dueDate,
  amountCents,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"asignar" | "entrega" | "notificar">("asignar");

  const tabs = [
    { key: "asignar" as const, label: "Asignar", color: "text-amber-300" },
    { key: "entrega" as const, label: "Entrega", color: "text-emerald-300" },
    { key: "notificar" as const, label: "Notificar", color: "text-violet-300" },
  ];

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
          {/* Info row */}
          <div className="flex flex-wrap gap-4 border-b border-slate-700/50 bg-slate-800/30 px-5 py-3 text-xs text-slate-400">
            <span>Cliente: <span className="text-slate-200">{clientEmail}</span></span>
            <span>Importe: <span className="text-slate-200">{(amountCents / 100).toFixed(2)} EUR</span></span>
            {dueDate && (
              <span>
                Entrega:{" "}
                <span className={new Date(dueDate) < new Date() ? "text-red-400 font-semibold" : "text-slate-200"}>
                  {new Date(dueDate).toLocaleDateString("es-ES")}
                </span>
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  tab === t.key
                    ? `${t.color} border-b-2 border-current bg-slate-800/40`
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {tab === "asignar" && (
              <AssignOrderForm
                reference={reference}
                currentAssignedTo={assignedTo}
                currentDueDate={dueDate}
              />
            )}
            {tab === "entrega" && <TranslatorDeliveryForm reference={reference} />}
            {tab === "notificar" && (
              <TranslatorNotifyForm reference={reference} defaultClientEmail={clientEmail} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
