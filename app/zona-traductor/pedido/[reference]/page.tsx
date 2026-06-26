import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { prisma } from "@/lib/prisma";
import { getWorkflowState, getWorkflowStateLabel, getNextWorkflowStates } from "@/lib/workflow";
import { getFinanceSnapshot } from "@/lib/finance";
import { getOrderActionStage, getNextBestAction } from "@/lib/order-actions";
import OrderStepper from "@/components/order-workspace/OrderStepper";
import OrderManagementActions from "@/components/order-workspace/OrderManagementActions";
import ClientMessageComposer from "@/components/order-workspace/ClientMessageComposer";
import FileThumbnails from "@/components/order-workspace/FileThumbnails";
import TranslationWorkspacePanel from "@/components/TranslationWorkspacePanel";
import WorkspaceEditor from "@/components/WorkspaceEditor";
import ClientMessagesSection, {
  type ClientMessage,
} from "@/components/order-workspace/ClientMessagesSection";

export const metadata: Metadata = {
  title: "Pedido — Zona traductor",
  robots: { index: false, follow: false },
};

type Params = { params: { reference: string } };

type DocRef = { name: string; url?: string };

function getSourceDocuments(events: any[]): DocRef[] {
  const submitted = events.find((e: any) => e.type === "presupuesto.submitted");
  const submittedFiles: DocRef[] = submitted
    ? (Array.isArray((submitted.payload as any)?.files) ? (submitted.payload as any).files : []).map(
        (f: any) => ({ name: String(f?.name || "Documento"), url: f?.url ? String(f.url) : undefined })
      )
    : [];
  const uploaded: DocRef[] = events
    .filter((e: any) => e.type === "order.source_document_uploaded")
    .map((e: any) => ({
      name: String((e.payload as any)?.fileName || "Documento"),
      url: (e.payload as any)?.fileUrl ? String((e.payload as any).fileUrl) : undefined,
    }));
  const seen = new Set<string>();
  return [...uploaded, ...submittedFiles].filter((d) => {
    if (!d.url) return true;
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

function getDeliveredFiles(order: any): DocRef[] {
  const raw = Array.isArray(order.deliveryFilesJson) ? order.deliveryFilesJson : [];
  const list: DocRef[] = raw
    .filter((f: any) => f && typeof f.url === "string" && f.url.trim())
    .map((f: any, i: number) => ({
      name: String(f.filename || `Traducción ${i + 1}`),
      url: String(f.url),
    }));
  if (list.length === 0) {
    const single = order.finalDeliveryFileUrl || order.translatedFileUrl;
    if (single) list.push({ name: order.finalFilename || "Traducción jurada", url: String(single) });
  }
  return list;
}

// Documentos fuente con tipo, para el editor de producción (visor pdf/img/docx).
function getWorkspaceDocuments(events: any[]): { name: string; url?: string; type: string }[] {
  const submitted = events.find((e: any) => e.type === "presupuesto.submitted");
  const submittedFiles = submitted
    ? (Array.isArray((submitted.payload as any)?.files) ? (submitted.payload as any).files : []).map((f: any) => ({
        name: String(f?.name || "Documento"),
        url: f?.url ? String(f.url) : undefined,
        type: String(f?.type || ""),
      }))
    : [];
  const uploaded = events
    .filter((e: any) => e.type === "order.source_document_uploaded")
    .map((e: any) => {
      const p = (e.payload as any) || {};
      return { name: String(p.fileName || "Documento"), url: p.fileUrl ? String(p.fileUrl) : undefined, type: String(p.fileType || "") };
    });
  const seen = new Set<string>();
  return [...uploaded, ...submittedFiles].filter((d) => {
    if (!d.url) return true;
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

function getClientMessages(events: any[]): ClientMessage[] {
  return events
    .filter((e: any) => typeof e.type === "string" && e.type.startsWith("notification."))
    .map((e: any) => {
      const p = (e.payload as any) || {};
      const isSms = e.type.includes("sms") || p.channel === "SMS";
      return {
        id: e.id,
        type: e.type,
        channel: String(p.channel || (isSms ? "SMS" : "EMAIL")),
        subject: p.subject ? String(p.subject) : isSms ? String(e.message || "") : null,
        bodyHtml: p.bodyHtml ? String(p.bodyHtml) : null,
        bodyText: p.body ? String(p.body) : null,
        toEmail: p.toEmail ? String(p.toEmail) : null,
        createdAt: (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).toISOString(),
      };
    });
}

const PAY_CLS: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-300",
};
const DELIVERY_CLS: Record<string, string> = {
  TRADUCIDO: "bg-emerald-500/15 text-emerald-300",
  EN_PROCESO: "bg-cyan-500/15 text-cyan-400",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function PedidoWorkspacePage({ params }: Params) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;
  const verifiedCookie = cookies().get(STAFF_OTP_VERIFIED_COOKIE)?.value;
  const verified = readVerifiedOtpToken(verifiedCookie);
  const verifiedEmail = verified?.email && isStaffEmail(verified.email) ? verified.email : null;
  const sessionStaffEmail = sessionEmail && isStaffEmail(sessionEmail) ? sessionEmail : null;

  if (sessionStaffEmail && (!verifiedEmail || verifiedEmail !== sessionStaffEmail)) {
    redirect("/zona-traductor/verificar");
  }
  const email = sessionStaffEmail || verifiedEmail;
  if (!email) redirect("/zona-traductor/verificar");

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      collaboratorAssignments: {
        include: { collaborator: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      clientInvoice: { select: { number: true, totalCents: true } },
      quote: { select: { quoteNumber: true } },
    },
  });
  if (!order) redirect("/zona-traductor");

  const workflowState = getWorkflowState(order);
  const moves = getNextWorkflowStates(workflowState).map((s) => ({ to: s, label: getWorkflowStateLabel(s) }));
  const sourceDocs = getSourceDocuments(order.events);
  const deliveredFiles = getDeliveredFiles(order);
  const messages = getClientMessages(order.events);
  const assignment = order.collaboratorAssignments?.[0] || null;
  const workspaceDocs = getWorkspaceDocuments(order.events);
  const collaboratorDelivery = assignment?.deliveredFileUrl
    ? {
        fileUrl: assignment.deliveredFileUrl,
        filename: assignment.deliveredFilename || "Entrega colaborador",
        deliveredAt: assignment.deliveredAt?.toISOString() || null,
        collaboratorName: assignment.collaborator?.fullName || assignment.collaborator?.email || "colaborador",
      }
    : null;

  // Stepper lineal: el backend (lib/order-actions) ya calcula el paso actual y
  // la "siguiente mejor accion". La landing solo lo renderiza — cero logica nueva.
  const orderForActions = { ...order, workflowState } as any;
  const financeSnapshot = getFinanceSnapshot(orderForActions);
  const actionStage = getOrderActionStage(orderForActions, financeSnapshot);
  const nextAction = getNextBestAction(orderForActions, financeSnapshot);

  // Reenvío manual al cliente (sobre todo leads de WhatsApp con email sintético
  // @whatsapp.local, a los que el email de entrega no llega): un enlace wa.me con
  // las traducciones + el enlace de reseña ya escritos, y la reseña accesible.
  const reviewUrl = (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ || "").trim().startsWith("http")
    ? (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ as string).trim()
    : "https://www.google.com/maps?cid=1858671208989418611";
  const clientPhoneDigits = (order.clientPhone || "").replace(/\D/g, "");
  const whatsappResendText =
    deliveredFiles.length > 0
      ? [
          `Hola, tu traducción jurada (pedido ${order.reference}) ya está lista.`,
          deliveredFiles.map((f) => `• ${f.name}: ${f.url}`).join("\n"),
          `Si todo está correcto, nos ayudaría muchísimo tu reseña en Google: ${reviewUrl}`,
          "¡Gracias!",
        ].join("\n\n")
      : "";
  const clientMessageSubject = `Tu traducción jurada está lista (pedido ${order.reference})`;

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Cabecera */}
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-sm">
          <a href="/zona-traductor" className="text-xs font-semibold text-cyan-400 hover:underline">
            ← Volver a zona traductor
          </a>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                Pedido <span className="font-mono text-cyan-400">{order.reference}</span>
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                {order.title} · {order.langPair || "—"} · {order.clientEmail}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md bg-slate-700/50 px-2 py-1 text-slate-100">
                {getWorkflowStateLabel(workflowState)}
              </span>
              <span className={`rounded-md px-2 py-1 ${PAY_CLS[order.paymentStatus] || "bg-amber-500/15 text-amber-300"}`}>
                Pago: {order.paymentStatus}
              </span>
              <span className={`rounded-md px-2 py-1 ${DELIVERY_CLS[order.deliveryState] || "bg-slate-700/50 text-slate-100"}`}>
                Entrega: {order.deliveryState}
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <p>ETA: <strong className="text-slate-100">{order.dueDate ? new Date(order.dueDate).toLocaleDateString("es-ES") : "—"}</strong></p>
            <p>Importe: <strong className="text-slate-100">{(order.amountCents / 100).toFixed(2)} EUR</strong></p>
            <p>Asignado: <strong className="text-slate-100">{order.assignedTo || "—"}</strong></p>
            <p>Teléfono: <strong className="text-slate-100">{order.clientPhone || "—"}</strong></p>
          </div>
          {order.clientNotes && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-300">Observaciones del cliente</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-300">{order.clientNotes}</p>
            </div>
          )}
        </div>

        {/* STEPPER lineal: estado del pedido + siguiente paso, todo en un sitio */}
        <OrderStepper stage={actionStage} nextAction={nextAction} />

        {/* Acciones de gestión (antes solo en el Cockpit): avanzar, factura, envío, cobro */}
        <div className="rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones del pedido</p>
          <OrderManagementActions
            reference={order.reference}
            clientName={order.clientName || order.clientEmail || "cliente"}
            clientPhone={order.clientPhone}
            amountCents={order.amountCents}
            paymentStatus={order.paymentStatus}
            moves={moves}
            invoice={order.clientInvoice ? { number: order.clientInvoice.number } : null}
            quote={order.quote ? { quoteNumber: order.quote.quoteNumber } : null}
          />
        </div>

        {/* SECCIÓN 1 — Subir / ver traducciones (lo primero: el dolor de "dónde meto la traducción") */}
        {/* SECCIÓN — Producción · Borrador IA (migrado del Workspace), plegable */}
        <section id="produccion" className="scroll-mt-20 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-sm">
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-slate-100">Producción · Borrador IA</summary>
            <div className="mt-4">
              <WorkspaceEditor
                reference={order.reference}
                langPair={order.langPair}
                draftContentJson={order.draftContentJson || null}
                draftFileUrl={order.draftFileUrl || null}
                draftFilename={order.draftFilename || null}
                draftGeneratedAt={order.draftGeneratedAt?.toISOString() || null}
                documents={workspaceDocs}
                collaboratorDelivery={collaboratorDelivery}
              />
            </div>
          </details>
        </section>

        <Section id="traduccion" title="Subir y entregar la traducción">
          {deliveredFiles.length > 0 ? (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs font-semibold text-emerald-300">
                Traducciones subidas en este pedido ({deliveredFiles.length})
              </p>
              <ul className="mt-1.5 space-y-1">
                {deliveredFiles.map((f, i) => (
                  <li key={i} className="text-sm">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                      ✓ {f.name}
                    </a>
                  </li>
                ))}
              </ul>
              <FileThumbnails
                files={deliveredFiles.filter((f) => f.url).map((f) => ({ name: f.name, url: f.url as string }))}
              />
              <ClientMessageComposer
                reference={order.reference}
                clientEmail={order.clientEmail}
                clientPhoneDigits={clientPhoneDigits}
                defaultSubject={clientMessageSubject}
                defaultMessage={whatsappResendText}
              />
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-400">
              Aún no hay ninguna traducción subida en este pedido.
            </p>
          )}
          {/* Uploader/entrega ya existente (arreglado): sube N archivos o carpeta y notifica al cliente. */}
          <TranslationWorkspacePanel
            reference={order.reference}
            currentDeliveryState={order.deliveryState}
            currentDueDate={order.dueDate ? order.dueDate.toISOString().split("T")[0] : null}
            existingFileUrl={order.finalDeliveryFileUrl || order.translatedFileUrl || null}
            existingFilename={order.finalFilename || null}
            translatorDeliveredAt={order.translatorDeliveredAt?.toISOString() || null}
          />
        </Section>

        {/* SECCIÓN 2 — Documentos del cliente */}
        <Section id="docs" title="Documentos del cliente">
          {sourceDocs.length === 0 ? (
            <p className="text-sm text-slate-400">No hay documentos fuente guardados en este pedido.</p>
          ) : (
            <ul className="space-y-1">
              {sourceDocs.map((d, i) => (
                <li key={i} className="text-sm">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                      {d.name}
                    </a>
                  ) : (
                    <span className="text-slate-300">{d.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <FileThumbnails
            files={sourceDocs.filter((d) => d.url).map((d) => ({ name: d.name, url: d.url as string }))}
          />
        </Section>

        {/* SECCIÓN 3 — Colaborador */}
        <Section id="colab" title="Colaborador">
          {assignment ? (
            <div className="text-sm text-slate-300">
              <p>
                <strong className="text-slate-100">{assignment.collaborator.fullName}</strong> · {assignment.status}
              </p>
              {assignment.deliveredFileUrl && (
                <p className="mt-1">
                  Entrega del colaborador:{" "}
                  <a href={assignment.deliveredFileUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    {assignment.deliveredFilename || "archivo"}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Sin colaborador asignado{" "}
              <span className="text-slate-500">(FR lo traduce Juan; otros idiomas se auto-asignan al pago).</span>
            </p>
          )}
        </Section>

        {/* SECCIÓN 4 — Finanzas */}
        <Section id="finanzas" title="Finanzas">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Importe (ingreso)</p>
              <p className="text-sm font-semibold text-slate-100">{(order.amountCents / 100).toFixed(2)} EUR</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Margen</p>
              <p
                className={`text-sm font-semibold ${
                  financeSnapshot.marginCents != null && financeSnapshot.marginCents < 0
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {financeSnapshot.marginCents != null
                  ? `${(financeSnapshot.marginCents / 100).toFixed(2)} EUR`
                  : "—"}
                {financeSnapshot.marginPct != null ? ` (${financeSnapshot.marginPct}%)` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado de pago</p>
              <p className="text-sm font-semibold text-slate-100">{order.paymentStatus}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Factura</p>
              <a href="/zona-traductor/facturas" className="text-sm font-semibold text-cyan-400 hover:underline">
                Gestionar facturas →
              </a>
            </div>
          </div>
        </Section>

        {/* SECCIÓN 5 — Cliente y mensajes (lo que NUNCA se veía) */}
        <Section id="cliente" title="Mensajes enviados al cliente">
          <ClientMessagesSection messages={messages} />
        </Section>
      </div>
      </main>
    </div>
  );
}
