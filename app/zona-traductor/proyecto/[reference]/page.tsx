import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import ProjectCockpit from "@/components/ProjectCockpit";
import { getWorkflowState, getNextWorkflowStates, getWorkflowStateLabel } from "@/lib/workflow";

export const metadata: Metadata = {
  title: "Zona traductor — Proyecto",
  robots: { index: false, follow: false },
};

export default async function ProyectoCockpitPage({ params }: { params: { reference: string } }) {
  await authZonaTraductorOrRedirect();

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    select: {
      id: true,
      reference: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      langPair: true,
      amountCents: true,
      dueDate: true,
      paymentStatus: true,
      deliveryState: true,
      assignedTo: true,
      title: true,
      createdAt: true,
      events: { select: { type: true, message: true, payload: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 25 },
      documentItems: { orderBy: { createdAt: "asc" } },
      collaboratorAssignments: { select: { quotedPriceCents: true, status: true } },
      clientInvoice: { select: { number: true, totalCents: true } },
      quote: { select: { quoteNumber: true, publicToken: true, status: true } },
    },
  });

  if (!order) notFound();

  const state = getWorkflowState(order as any);
  const moves = getNextWorkflowStates(state).map((s) => ({ to: s, label: getWorkflowStateLabel(s) }));
  const supplierCostCents = order.collaboratorAssignments
    .filter((a) => a.status === "ACCEPTED" || a.status === "DELIVERED")
    .reduce((s, a) => s + (a.quotedPriceCents || 0), 0);
  const marginCents = order.amountCents - supplierCostCents;
  const marginPct = order.amountCents > 0 ? Math.round((marginCents / order.amountCents) * 100) : null;

  const cockpit = {
    reference: order.reference,
    client: order.clientName || order.clientEmail || "—",
    clientEmail: order.clientEmail,
    clientPhone: order.clientPhone,
    langPair: order.langPair || "",
    amountCents: order.amountCents,
    paymentStatus: order.paymentStatus,
    state,
    stateLabel: getWorkflowStateLabel(state),
    moves,
    dueLabel: order.dueDate ? new Date(order.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : null,
    title: order.title,
    assignedTo: order.assignedTo,
    supplierCostCents,
    marginCents,
    marginPct,
    invoice: order.clientInvoice
      ? { number: order.clientInvoice.number, totalCents: order.clientInvoice.totalCents }
      : null,
    quote: order.quote,
    items: order.documentItems.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      documentType: d.documentType,
      sourceLang: d.sourceLang,
      targetLang: d.targetLang,
      words: d.words,
      quotedCents: d.quotedCents,
      prodStatus: d.prodStatus,
      assignedTo: d.assignedTo,
      fileUrl: d.fileUrl,
      deliveredFileUrl: d.deliveredFileUrl,
    })),
    timeline: order.events.map((e) => ({
      type: e.type,
      message: e.message,
      at: new Date(e.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    })),
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <ProjectCockpit data={cockpit} />
    </div>
  );
}
