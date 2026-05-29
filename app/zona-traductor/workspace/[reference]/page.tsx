import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { prisma } from "@/lib/prisma";
import { getWorkflowState, getWorkflowStateLabel } from "@/lib/workflow";
import WorkspaceEditor from "@/components/WorkspaceEditor";
import TranslationWorkspacePanel from "@/components/TranslationWorkspacePanel";

export const metadata: Metadata = {
  title: "Workspace — Zona traductor",
  robots: { index: false, follow: false },
};

type Params = { params: { reference: string } };

function getSubmittedDocuments(events: any[]) {
  const submitted = events.find((e: any) => e.type === "presupuesto.submitted");
  const submittedFiles = (() => {
    if (!submitted) return [];
    const payload = (submitted.payload as any) || {};
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files.map((file: any) => ({
      name: String(file?.name || "Documento"),
      url: file?.url ? String(file.url) : undefined,
      type: String(file?.type || ""),
    }));
  })();

  const sourceUploadFiles = events
    .filter((e: any) => e.type === "order.source_document_uploaded")
    .map((e: any) => {
      const payload = (e.payload as any) || {};
      return {
        name: String(payload.fileName || "Documento"),
        url: payload.fileUrl ? String(payload.fileUrl) : undefined,
        type: String(payload.fileType || ""),
      };
    });

  const seen = new Set<string>();
  return [...sourceUploadFiles, ...submittedFiles].filter((doc) => {
    const url = doc.url || "";
    if (!url) return true;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export default async function WorkspacePage({ params }: Params) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const verified = readVerifiedOtpToken(verifiedCookie);
  const verifiedEmail = verified?.email && isStaffEmail(verified.email) ? verified.email : null;
  const sessionStaffEmail = sessionEmail && isStaffEmail(sessionEmail) ? sessionEmail : null;

  if (sessionStaffEmail) {
    if (!verifiedEmail || verifiedEmail !== sessionStaffEmail) {
      redirect("/zona-traductor/verificar");
    }
  }

  const email = sessionStaffEmail || verifiedEmail;
  if (!email) {
    redirect("/zona-traductor/verificar");
  }

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      collaboratorAssignments: {
        where: { status: { in: ["ACCEPTED", "DELIVERED"] } },
        include: { collaborator: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    redirect("/zona-traductor");
  }

  const workflowState = getWorkflowState(order);
  const documents = getSubmittedDocuments(order.events);

  const activeAssignment = order.collaboratorAssignments?.[0] || null;
  const collaboratorDelivery = activeAssignment?.deliveredFileUrl ? {
    fileUrl: activeAssignment.deliveredFileUrl,
    filename: activeAssignment.deliveredFilename || "Entrega colaborador",
    deliveredAt: activeAssignment.deliveredAt?.toISOString() || null,
    collaboratorName: activeAssignment.collaborator.fullName,
  } : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <a
              href="/zona-traductor"
              className="text-xs font-semibold text-cyan-400 hover:underline"
            >
              ← Volver a zona traductor
            </a>
            <h1 className="mt-2 text-2xl font-bold text-white">
              Workspace: <span className="font-mono text-cyan-300">{order.reference}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-300">{order.title}</p>
            <a
              href={`/zona-traductor/proyecto/${order.reference}`}
              className="mt-2 inline-block rounded-lg border border-cyan-700 bg-cyan-600/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-600/30"
            >
              📋 Vista de proyecto (cockpit)
            </a>
          </div>
        </div>

        {/* Info grid */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <p>
              Cliente: <span className="font-semibold text-slate-100">{order.clientEmail}</span>
            </p>
            <p>
              Idiomas: <span className="font-semibold text-slate-100">{order.langPair || "—"}</span>
            </p>
            <p>
              Asignado: <span className="font-semibold text-amber-300">{order.assignedTo || "—"}</span>
            </p>
            <p>
              Workflow: <span className="font-semibold text-slate-100">{getWorkflowStateLabel(workflowState)}</span>
            </p>
            <p>
              Pago:{" "}
              <span className={`font-semibold ${order.paymentStatus === "PAID" ? "text-emerald-300" : "text-amber-300"}`}>
                {order.paymentStatus}
              </span>
            </p>
            <p>
              Entrega:{" "}
              <span className={`font-semibold ${order.deliveryState === "TRADUCIDO" ? "text-emerald-300" : order.deliveryState === "EN_PROCESO" ? "text-blue-300" : "text-slate-300"}`}>
                {order.deliveryState}
              </span>
            </p>
            <p>
              ETA: <span className="font-semibold text-slate-100">{order.dueDate ? new Date(order.dueDate).toLocaleDateString("es-ES") : "—"}</span>
            </p>
            <p>
              Importe: <span className="font-semibold text-slate-100">{(order.amountCents / 100).toFixed(2)} EUR</span>
            </p>
          </div>
          {order.clientNotes && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-300 mb-1">Observaciones del cliente:</p>
              <p className="text-sm text-slate-200 whitespace-pre-line">{order.clientNotes}</p>
            </div>
          )}
        </div>

        {/* Two-column editor */}
        <WorkspaceEditor
          reference={order.reference}
          langPair={order.langPair}
          draftContentJson={order.draftContentJson || null}
          draftFileUrl={order.draftFileUrl || null}
          draftFilename={order.draftFilename || null}
          draftGeneratedAt={order.draftGeneratedAt?.toISOString() || null}
          documents={documents}
          collaboratorDelivery={collaboratorDelivery}
        />

        {/* Delivery controls */}
        <TranslationWorkspacePanel
          reference={order.reference}
          currentDeliveryState={order.deliveryState}
          currentDueDate={order.dueDate ? order.dueDate.toISOString().split("T")[0] : null}
          existingFileUrl={order.finalDeliveryFileUrl || order.translatedFileUrl || null}
          existingFilename={order.finalFilename || null}
        />
      </div>
    </main>
  );
}
