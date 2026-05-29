import type { Metadata } from "next";
import { authZonaTraductorOrRedirect, loadBandejaState } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import KanbanBoard from "@/components/KanbanBoard";
import {
  getWorkflowState,
  getNextWorkflowStates,
  getWorkflowStateLabel,
  type WorkflowState,
} from "@/lib/workflow";

export const metadata: Metadata = {
  title: "Zona traductor — Tablero",
  robots: { index: false, follow: false },
};

const LANES: { key: string; label: string; states: WorkflowState[] }[] = [
  { key: "presupuesto", label: "Presupuesto", states: ["BORRADOR", "PENDIENTE_REVISION", "PRESUPUESTO_ENVIADO"] },
  { key: "pago", label: "Pendiente pago", states: ["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO"] },
  { key: "traduccion", label: "En traducción", states: ["PAGO_VALIDADO", "EN_TRADUCCION"] },
  { key: "entregado", label: "Entregado", states: ["TRADUCIDO_ENTREGADO"] },
  { key: "cerrado", label: "Cerrado", states: ["CERRADO"] },
];

function laneOf(state: WorkflowState): string {
  return LANES.find((l) => l.states.includes(state))?.key || "pago";
}

export default async function ZonaTraductorTableroPage() {
  await authZonaTraductorOrRedirect();
  const bandeja = await loadBandejaState().catch(() => null);
  const accionables = bandeja?.pedidosAccionables ?? 0;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      reference: true,
      clientName: true,
      clientEmail: true,
      langPair: true,
      amountCents: true,
      dueDate: true,
      assignedTo: true,
      paymentStatus: true,
      deliveryState: true,
      events: { select: { type: true, payload: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      documentItems: { select: { prodStatus: true } },
      clientInvoice: { select: { number: true } },
    },
  });

  const now = Date.now();
  const cards = orders.map((o) => {
    const state = getWorkflowState(o as any);
    const moves = getNextWorkflowStates(state).map((s) => ({
      to: s,
      lane: laneOf(s),
      label: getWorkflowStateLabel(s),
    }));
    const docTotal = o.documentItems.length;
    const docDone = o.documentItems.filter((d) => d.prodStatus === "DELIVERED").length;
    const due = o.dueDate ? new Date(o.dueDate).getTime() : null;
    const open = state !== "TRADUCIDO_ENTREGADO" && state !== "CERRADO";
    return {
      reference: o.reference,
      client: o.clientName || o.clientEmail || "—",
      langPair: o.langPair || "",
      amountCents: o.amountCents,
      dueLabel: o.dueDate
        ? new Date(o.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
        : null,
      overdue: !!(due && open && due < now),
      urgent: !!(due && open && due >= now && due < now + 36 * 3600 * 1000),
      assignedTo: o.assignedTo || null,
      docTotal,
      docDone,
      paymentPending: o.paymentStatus !== "PAID",
      invoiceNumber: o.clientInvoice?.number || null,
      state,
      stateLabel: getWorkflowStateLabel(state),
      lane: laneOf(state),
      moves,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <ZonaTraductorNav modoActivo="tablero" pedidosAccionables={accionables} />
      <KanbanBoard lanes={LANES.map(({ key, label }) => ({ key, label }))} initialCards={cards} />
    </div>
  );
}
