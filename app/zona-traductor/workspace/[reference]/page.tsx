import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { prisma } from "@/lib/prisma";
import { getWorkflowState, getWorkflowStateLabel } from "@/lib/workflow";
import DraftGeneratorButton from "@/components/DraftGeneratorButton";
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
    }));
  })();

  const sourceUploadFiles = events
    .filter((e: any) => e.type === "order.source_document_uploaded")
    .map((e: any) => {
      const payload = (e.payload as any) || {};
      return {
        name: String(payload.fileName || "Documento"),
        url: payload.fileUrl ? String(payload.fileUrl) : undefined,
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
  // Auth: same pattern as zona-traductor
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
    },
  });

  if (!order) {
    redirect("/zona-traductor");
  }

  const workflowState = getWorkflowState(order);
  const documents = getSubmittedDocuments(order.events);

  const recentEvents = order.events
    .filter((e) =>
      [
        "workflow.state_changed",
        "draft.generated",
        "notification.delivery_ready.sent",
        "client.translation_ready_notified",
        "order.source_document_uploaded",
      ].includes(e.type)
    )
    .slice(0, 10);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
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
          </div>
        </div>

        {/* Info grid */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <p>
              Cliente: <span className="font-semibold text-slate-100">{order.clientEmail}</span>
            </p>
            <p>
              Par idiomas: <span className="font-semibold text-slate-100">{order.langPair || "—"}</span>
            </p>
            <p>
              Asignado a: <span className="font-semibold text-amber-300">{order.assignedTo || "Sin asignar"}</span>
            </p>
            <p>
              Workflow:{" "}
              <span className="font-semibold text-slate-100">{getWorkflowStateLabel(workflowState)}</span>
            </p>
            <p>
              Pago:{" "}
              <span
                className={`font-semibold ${order.paymentStatus === "PAID" ? "text-emerald-300" : "text-amber-300"}`}
              >
                {order.paymentStatus}
              </span>
            </p>
            <p>
              Entrega:{" "}
              <span
                className={`font-semibold ${
                  order.deliveryState === "TRADUCIDO"
                    ? "text-emerald-300"
                    : order.deliveryState === "EN_PROCESO"
                      ? "text-blue-300"
                      : "text-slate-300"
                }`}
              >
                {order.deliveryState}
              </span>
            </p>
            <p>
              ETA:{" "}
              <span className="font-semibold text-slate-100">
                {order.dueDate
                  ? new Date(order.dueDate).toLocaleDateString("es-ES")
                  : "—"}
              </span>
            </p>
            <p>
              Importe:{" "}
              <span className="font-semibold text-slate-100">
                {(order.amountCents / 100).toFixed(2)} EUR
              </span>
            </p>
          </div>
        </div>

        {/* Source documents */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
            Documentos fuente
          </p>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No hay documentos fuente.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {documents.map((doc, idx) => (
                <li
                  key={`${doc.name}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 p-3"
                >
                  <span className="text-sm text-slate-200">{doc.name}</span>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                    >
                      Descargar
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Draft IA */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-300">
            Borrador IA
          </p>
          <DraftGeneratorButton
            orderReference={order.reference}
            documents={documents}
            langPair={order.langPair}
            existingDraftUrl={order.draftFileUrl}
            existingDraftFilename={order.draftFilename}
            existingDraftGeneratedAt={order.draftGeneratedAt?.toISOString() || null}
          />
        </div>

        {/* Delivery controls */}
        <TranslationWorkspacePanel
          reference={order.reference}
          currentDeliveryState={order.deliveryState}
          currentDueDate={order.dueDate ? order.dueDate.toISOString().split("T")[0] : null}
          existingFileUrl={order.finalDeliveryFileUrl || order.translatedFileUrl || null}
          existingFilename={order.finalFilename || null}
        />

        {/* Recent events */}
        {recentEvents.length > 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Historial reciente
            </p>
            <ul className="mt-3 space-y-2">
              {recentEvents.map((evt) => (
                <li
                  key={evt.id}
                  className="flex items-start justify-between rounded-xl border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-mono text-cyan-400">{evt.type}</span>
                    <p className="mt-0.5 text-slate-300">{evt.message}</p>
                  </div>
                  <span className="shrink-0 text-slate-500">
                    {new Date(evt.createdAt).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
