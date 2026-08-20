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
import { getSourceDocumentsFromEvents } from "@/lib/order-source-documents";
import {
  getOrderActionStage,
  getNextBestAction,
  getOrderGates,
  buildOrderTrackedLinks,
} from "@/lib/order-actions";
import {
  getAcquisitionSource,
  getArchiveState,
  getLatestDeliveryNotification,
  getOrderArtifacts,
  getPaymentProofs,
  getQuoteAuditTrail,
  getQuoteDraft,
  getSubmittedDocuments,
} from "@/lib/zona-traductor-data";
import OrderStepper from "@/components/order-workspace/OrderStepper";
import OrderManagementActions from "@/components/order-workspace/OrderManagementActions";
import CollaboratorAssignmentPanel from "@/components/CollaboratorAssignmentPanel";
import AssignOrderForm from "@/components/AssignOrderForm";
import ConfirmPaymentButton from "@/components/ConfirmPaymentButton";
import { buildDeliveryResendMessage } from "@/lib/notification-templates";
import OrderDocumentsPanel from "@/components/OrderDocumentsPanel";
import OrderFinancePanel from "@/components/OrderFinancePanel";
import OrderLifecyclePanel from "@/components/OrderLifecyclePanel";
import OrderWorkflowPanel from "@/components/OrderWorkflowPanel";
import SourceDocumentUpload from "@/components/SourceDocumentUpload";
import TranslatorNotifyForm from "@/components/TranslatorNotifyForm";
import ClientMessageComposer from "@/components/order-workspace/ClientMessageComposer";
import FileThumbnails from "@/components/order-workspace/FileThumbnails";
import TranslationWorkspacePanel from "@/components/TranslationWorkspacePanel";
import LavoriEntregasPanel, { type LavoriEntrega } from "@/components/LavoriEntregasPanel";
import WorkspaceEditor from "@/components/WorkspaceEditor";
import OrderDocumentItems from "@/components/order-workspace/OrderDocumentItems";
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
  return getSourceDocumentsFromEvents(events);
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

// Entregas llegadas por el puente lavori (Fase 2): eventos lavori.entrega_subida.
// "enviada" = su URL ya está en deliveryFilesJson (salió por el carril /delivery).
function getLavoriEntregas(order: any): LavoriEntrega[] {
  const delivered = new Set(
    (Array.isArray(order.deliveryFilesJson) ? order.deliveryFilesJson : []).map((f: any) =>
      String(f?.url || "")
    )
  );
  return order.events
    .filter((e: any) => e.type === "lavori.entrega_subida")
    .map((e: any) => {
      const p = (e.payload as any) || {};
      const url = String(p.attachmentUrl || "");
      return {
        url,
        nombre: String(p.nombre || "traduccion.pdf"),
        miembro: String(p.miembroNombre || p.miembroId || "traductor lavori"),
        fecha: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
        mimeType: p.contentType ? String(p.contentType) : null,
        recogida: p.recogida ? String(p.recogida) : null,
        enviada: delivered.has(url),
      };
    })
    .filter((e: LavoriEntrega) => e.url);
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
        bodyText: p.bodyText ? String(p.bodyText) : p.body ? String(p.body) : null,
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
      },
      clientInvoice: { select: { number: true, totalCents: true } },
      quote: { select: { id: true, quoteNumber: true } },
      documentItems: { orderBy: { createdAt: "asc" } },
      documentAnalyses: {
        select: { fileName: true, fileUrl: true, mimeType: true, fileSize: true, createdAt: true },
      },
      billing: true,
      shipping: true,
    },
  });
  if (!order) redirect("/zona-traductor");

  const workflowState = getWorkflowState(order);
  const moves = getNextWorkflowStates(workflowState).map((s) => ({ to: s, label: getWorkflowStateLabel(s) }));
  const sourceDocs = getSourceDocuments(order.events);
  const deliveredFiles = getDeliveredFiles(order);
  const lavoriEntregas = getLavoriEntregas(order);
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
  const docItems = (order.documentItems || []).map((d: any) => ({
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
  }));
  // Adjudicación de colaborador (antes solo accesible desde Control).
  const collabAssignments = (order.collaboratorAssignments || []).map((a: any) => ({
    id: a.id,
    status: a.status,
    collaboratorId: a.collaboratorId,
    quotedPriceCents: a.quotedPriceCents,
    quotedDeadline: a.quotedDeadline ? new Date(a.quotedDeadline).toISOString() : null,
    collaboratorNotes: a.collaboratorNotes,
    rejectionReason: a.rejectionReason,
    revisionReason: a.revisionReason,
    deliveredFileUrl: a.deliveredFileUrl,
    deliveredFilename: a.deliveredFilename,
    deliveredAt: a.deliveredAt ? new Date(a.deliveredAt).toISOString() : null,
    adminNotes: a.adminNotes,
    collaborator: { fullName: a.collaborator.fullName, email: a.collaborator.email },
  }));

  // Stepper lineal: el backend (lib/order-actions) ya calcula el paso actual y
  // la "siguiente mejor accion". La landing solo lo renderiza — cero logica nueva.
  const orderForActions = { ...order, workflowState } as any;
  const financeSnapshot = getFinanceSnapshot(orderForActions);
  const actionStage = getOrderActionStage(orderForActions, financeSnapshot);
  const nextAction = getNextBestAction(orderForActions, financeSnapshot);
  const gates = getOrderGates(orderForActions, financeSnapshot);

  // La ficha enseña lo que toca en cada etapa: lo demás se pliega, no se borra.
  const isPaidQuoteOrder = Boolean(order.quote) && order.paymentStatus === "PAID";
  const isDeliveredStage = actionStage === "DELIVERED" || actionStage === "CLOSED";

  // Datos que antes solo montaba la Bandeja: mismos helpers compartidos.
  const paymentProofs = getPaymentProofs(order);
  const submittedDocuments = getSubmittedDocuments(order);
  const quoteDraft = getQuoteDraft(order);
  const quoteAuditTrail = getQuoteAuditTrail(order);
  const artifacts = getOrderArtifacts(order);
  const deliveryNotification = getLatestDeliveryNotification(order);
  const trackedLinks = buildOrderTrackedLinks(order.reference);
  const acquisitionSource = getAcquisitionSource(order);
  const { isArchived } = getArchiveState(order);
  const dueDateInput = order.dueDate ? order.dueDate.toISOString().split("T")[0] : null;

  // Reenvío manual al cliente (sobre todo leads de WhatsApp con email sintético
  // @whatsapp.local, a los que el email de entrega no llega): un enlace wa.me con
  // las traducciones + el enlace de reseña ya escritos, y la reseña accesible.
  const reviewUrl = (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ || "").trim().startsWith("http")
    ? (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ as string).trim()
    : "https://www.google.com/maps?cid=1858671208989418611";
  const clientPhoneDigits = (order.clientPhone || "").replace(/\D/g, "");
  const whatsappResendText = buildDeliveryResendMessage({
    reference: order.reference,
    files: deliveredFiles,
    reviewUrl,
  });
  const clientMessageSubject =
    deliveredFiles.length > 0
      ? `Tu traducción jurada está lista (pedido ${order.reference})`
      : `Sobre tu pedido ${order.reference}`;

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
                {order.title} · {order.langPair || "—"} ·{" "}
                {/* La carpeta del cliente era una isla: ningún pedido enlazaba a ella. */}
                <a
                  href={`/zona-traductor/clientes/${encodeURIComponent(order.clientEmail)}`}
                  className="text-cyan-400 hover:underline"
                  title="Abrir la carpeta de este cliente"
                >
                  {order.clientEmail}
                </a>
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
            <p>Asignado: <strong className="text-slate-100">{order.assignedTo || assignment?.collaborator?.fullName || "—"}</strong></p>
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
            quote={order.quote ? { id: order.quote.id, quoteNumber: order.quote.quoteNumber } : null}
          />
          <details className="mt-4 border-t border-slate-700/50 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
              Cambiar workflow a otro estado
            </summary>
            <div className="mt-3">
              <OrderWorkflowPanel reference={order.reference} currentState={workflowState} />
            </div>
          </details>
        </div>

        {/* SECCIÓN — Presupuesto. Pedido nacido de presupuesto PAGADO → una línea:
            el editor de presupuestar aquí solo enseñaba totales a 0,00 y un botón
            que reenviaría el presupuesto a un cliente que ya pagó. El editor
            completo sigue disponible (plegado) y para pedidos sin Quote (WhatsApp
            order-first) se muestra como siempre. */}
        {isPaidQuoteOrder ? (
          <section id="presupuesto" className="scroll-mt-20 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Presupuesto {order.quote!.quoteNumber}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {(order.amountCents / 100).toFixed(2)} EUR ·{" "}
                  <span className="font-semibold text-emerald-300">pagado</span>
                </p>
              </div>
              <a
                href={`/admin/quotes/${order.quote!.id}`}
                className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
              >
                Abrir presupuesto →
              </a>
            </div>
            <details className="mt-3 border-t border-slate-700/50 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
                Editor de presupuesto del pedido (avanzado — este pedido ya está cobrado)
              </summary>
              <div className="mt-3">
                <OrderDocumentsPanel
                  reference={order.reference}
                  workflowState={workflowState}
                  amountCents={order.amountCents}
                  documents={submittedDocuments}
                  quoteDraft={quoteDraft}
                  quoteAuditTrail={quoteAuditTrail}
                />
              </div>
            </details>
          </section>
        ) : (
          <Section id="presupuesto" title="Presupuesto">
            <OrderDocumentsPanel
              reference={order.reference}
              workflowState={workflowState}
              amountCents={order.amountCents}
              documents={submittedDocuments}
              quoteDraft={quoteDraft}
              quoteAuditTrail={quoteAuditTrail}
            />
          </Section>
        )}

        {/* SECCIÓN — Pago. Pagado por pasarela sin justificantes → una línea
            («Aún no se ha subido comprobante» en un pedido cobrado por Stripe
            confundía). El flujo justificante→cobrada (Bizum/transferencia) sigue
            intacto: si hay comprobantes o falta el cobro, sección completa. */}
        {order.paymentStatus === "PAID" && paymentProofs.length === 0 ? (
          <section id="pago" className="scroll-mt-20 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-100">Pago</h2>
              <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                Pagado · {order.paymentMethod || "—"}
              </span>
              <span className="text-sm text-slate-300">
                {(order.amountCents / 100).toFixed(2)} EUR
                {order.paidAt ? ` · ${new Date(order.paidAt).toLocaleDateString("es-ES")}` : ""}
              </span>
            </div>
          </section>
        ) : (
        <Section id="pago" title="Pago y comprobantes">
          {order.paymentStatus !== "PAID" && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-300">Marcar cobrado:</span>
              <ConfirmPaymentButton reference={order.reference} />
            </div>
          )}
          {paymentProofs.length === 0 ? (
            <p className="text-sm text-slate-400">Aún no se ha subido comprobante.</p>
          ) : (
            <ul className="space-y-2">
              {paymentProofs.map((proof: any, idx: number) => (
                <li
                  key={`${proof.fileUrl}-${idx}`}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200"
                >
                  <p className="font-semibold text-slate-100">{proof.fileName || "Comprobante"}</p>
                  {proof.uploadedAt && (
                    <p className="text-xs text-slate-400">
                      Subido: {new Date(proof.uploadedAt).toLocaleString("es-ES")}
                    </p>
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
        </Section>
        )}

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
          {lavoriEntregas.length > 0 && (
            <LavoriEntregasPanel
              reference={order.reference}
              entregas={lavoriEntregas}
              paper={order.deliveryType === "paper"}
            />
          )}
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
              <p className="mt-3 border-t border-emerald-500/20 pt-3 text-xs text-slate-400">
                ¿Reenviar al cliente?{" "}
                <a href="#comunicacion" className="font-semibold text-cyan-400 hover:underline">
                  Escribir al cliente ↓
                </a>{" "}
                (el mensaje de entrega sale ya escrito).
              </p>
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
            alreadyDelivered={workflowState === "CERRADO" || order.deliveryState === "TRADUCIDO"}
          />
        </Section>

        {/* SECCIÓN 2 — Documentos del cliente: UN solo listado (miniaturas +
            desglose por documento con original/traducción/coste) + subida.
            La lista plana duplicada de los mismos archivos se retiró. */}
        <Section id="docs" title="Documentos del cliente">
          {sourceDocs.length === 0 && docItems.length === 0 && (
            <p className="text-sm text-slate-400">No hay documentos fuente guardados en este pedido.</p>
          )}
          <FileThumbnails
            files={sourceDocs.filter((d) => d.url).map((d) => ({ name: d.name, url: d.url as string }))}
          />
          <OrderDocumentItems reference={order.reference} items={docItems} />
          <div className="mt-4 border-t border-slate-700/50 pt-4">
            <SourceDocumentUpload reference={order.reference} />
          </div>
        </Section>

        {/* SECCIÓN 3 — Traductor: colaborador (broadcast/encargo directo) con la
            asignación manual FR plegada dentro. Antes eran dos secciones que
            competían y el texto libre parecía obligatorio incluso auto-asignado. */}
        <Section id="asignar" title="Traductor">
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
          ) : order.assignedTo ? (
            <p className="text-sm text-slate-300">
              Asignado a <strong className="text-slate-100">{order.assignedTo}</strong>
              {order.dueDate ? ` · fecha límite ${new Date(order.dueDate).toLocaleDateString("es-ES")}` : ""}
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Sin colaborador asignado{" "}
              <span className="text-slate-500">(FR lo traduce Juan; otros idiomas se auto-asignan al pago).</span>
            </p>
          )}
          <div className="mt-4">
            <CollaboratorAssignmentPanel reference={order.reference} langPair={order.langPair} assignments={collabAssignments} />
          </div>
          <details className="mt-4 border-t border-slate-700/50 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
              Asignación manual y fecha límite (carril FR — avisa al cliente «en proceso»)
            </summary>
            <div className="mt-3">
              <AssignOrderForm
                reference={order.reference}
                currentAssignedTo={order.assignedTo}
                currentDueDate={dueDateInput}
              />
            </div>
          </details>
        </Section>

        {/* SECCIÓN 4 — Finanzas. Plegada hasta la entrega (conciliación, IRPF y
            cierre no pintan nada en un pedido recién pagado); los avisos del
            snapshot quedan visibles en el pliegue para no ocultar un margen bajo. */}
        <section id="finanzas" className="scroll-mt-20 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-sm">
          <details open={isDeliveredStage}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-100">Finanzas</h2>
              {!isDeliveredStage && (
                <span className="text-xs text-slate-500">
                  conciliación, factura proveedor y cierre — se gestionan al entregar
                </span>
              )}
              {financeSnapshot.warnings.length > 0 && (
                <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-300">
                  {financeSnapshot.warnings.length} aviso{financeSnapshot.warnings.length === 1 ? "" : "s"}
                </span>
              )}
            </summary>
            <div className="mt-3">
              <OrderFinancePanel
                reference={order.reference}
                amountCents={order.amountCents}
                snapshot={financeSnapshot}
              />
              <p className="mt-3 text-xs">
                <a href="/zona-traductor/facturas" className="font-semibold text-cyan-400 hover:underline">
                  Gestionar facturas →
                </a>
              </p>
            </div>
          </details>
        </section>

        {/* SECCIÓN — Comunicación: UN compositor (email con adjuntos + SMS opcional
            + WhatsApp) y las plantillas copy-first. El segundo formulario y su
            endpoint /send-client-message se retiraron (P2.6). */}
        <Section id="comunicacion" title="Comunicación con el cliente">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            Escribir al cliente
          </p>
          <div className="mt-3">
            <ClientMessageComposer
              reference={order.reference}
              clientEmail={order.clientEmail}
              clientPhoneDigits={clientPhoneDigits}
              defaultSubject={clientMessageSubject}
              defaultMessage={whatsappResendText}
              hasDeliveryFiles={deliveredFiles.length > 0}
            />
          </div>
          <div className="mt-6 border-t border-slate-700/50 pt-6">
            <TranslatorNotifyForm
              reference={order.reference}
              defaultClientEmail={order.clientEmail}
              acquisitionSource={acquisitionSource}
              defaultDownloadUrl={artifacts.finalDeliveryFileUrl || undefined}
              quotePreviewUrl={artifacts.quotePreviewFileUrl || undefined}
              paymentLink={trackedLinks.paymentUrl}
              statusLink={trackedLinks.statusUrl}
              deliveryNotifiedAt={deliveryNotification?.sentAt || null}
              deliveryNotifiedTo={deliveryNotification?.toEmail || null}
              canonicalStage={actionStage}
            />
          </div>
        </Section>

        {/* SECCIÓN 5 — Cliente y mensajes (lo que NUNCA se veía) */}
        <Section id="cliente" title="Mensajes enviados al cliente">
          <ClientMessagesSection messages={messages} />
        </Section>

        {/* SECCIÓN — Datos fiscales, envío postal y timeline, plegados por defecto */}
        <section id="datos" className="scroll-mt-20 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-sm">
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-slate-100">Datos y actividad</summary>
            <div className="mt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Datos de facturación
              </p>
              {order.billing ? (
                <div className="mt-2 space-y-1 text-sm text-slate-300">
                  <p>Nombre fiscal: <strong className="text-slate-100">{order.billing.fiscalName}</strong></p>
                  <p>NIF: <strong className="text-slate-100">{order.billing.nif}</strong></p>
                  <p>Dirección: {order.billing.address}</p>
                  <p>Ciudad: {order.billing.city} {order.billing.postalCode}</p>
                  <p>País: {order.billing.country}</p>
                  <p>Email: {order.billing.email}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Sin datos de facturación.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Datos de envío postal
              </p>
              {order.shipping ? (
                <div className="mt-2 space-y-1 text-sm text-slate-300">
                  <p>Nombre: <strong className="text-slate-100">{order.shipping.name}</strong></p>
                  <p>Teléfono: {order.shipping.phone}</p>
                  <p>Dirección: {order.shipping.address}</p>
                  <p>Ciudad: {order.shipping.city} ({order.shipping.province})</p>
                  <p>CP: {order.shipping.postalCode}</p>
                  <p>País: {order.shipping.country}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Sin datos de envío postal.</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Timeline de eventos
            </p>
            {order.events.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Sin eventos registrados.</p>
            ) : (
              <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
                {order.events.map((evt: any) => (
                  <li key={evt.id} className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                    <span className="shrink-0 text-xs text-slate-500">
                      {new Date(evt.createdAt).toLocaleString("es-ES")}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{evt.type}</span>
                    <span className="text-slate-300">{evt.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
            </div>
          </details>
        </section>

        {/* SECCIÓN final — Control: cerrar/archivar/eliminar + gates */}
        <Section id="control" title="Control">
          <OrderLifecyclePanel
            reference={order.reference}
            isArchived={isArchived}
            canonicalStage={actionStage}
            gates={gates}
            canClose={gates.closeReady}
          />
        </Section>
      </div>
      </main>
    </div>
  );
}
