import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { readVerifiedOtpToken, STAFF_OTP_VERIFIED_COOKIE } from "@/lib/staff-otp";
import { prisma } from "@/lib/prisma";
import { getWorkflowState, getWorkflowStateLabel } from "@/lib/workflow";
import TranslationWorkspacePanel from "@/components/TranslationWorkspacePanel";
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
  PAID: "bg-emerald-100 text-emerald-800",
};
const DELIVERY_CLS: Record<string, string> = {
  TRADUCIDO: "bg-emerald-100 text-emerald-800",
  EN_PROCESO: "bg-bleu/10 text-bleu",
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
      className="scroll-mt-20 rounded-3xl border border-sepia/30 bg-parchment/70 p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-encre">{title}</h2>
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
    },
  });
  if (!order) redirect("/zona-traductor");

  const workflowState = getWorkflowState(order);
  const sourceDocs = getSourceDocuments(order.events);
  const deliveredFiles = getDeliveredFiles(order);
  const messages = getClientMessages(order.events);
  const assignment = order.collaboratorAssignments?.[0] || null;

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
  const whatsappResendHref =
    clientPhoneDigits && whatsappResendText
      ? `https://wa.me/${clientPhoneDigits}?text=${encodeURIComponent(whatsappResendText)}`
      : null;

  return (
    <main className="min-h-screen bg-cream px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Cabecera */}
        <div className="rounded-3xl border border-sepia/30 bg-white p-6 shadow-sm">
          <a href="/zona-traductor" className="text-xs font-semibold text-bleu hover:underline">
            ← Volver a zona traductor
          </a>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-encre">
                Pedido <span className="font-mono text-bleu">{order.reference}</span>
              </h1>
              <p className="mt-1 text-sm text-encre/70">
                {order.title} · {order.langPair || "—"} · {order.clientEmail}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md bg-sepia/20 px-2 py-1 text-encre">
                {getWorkflowStateLabel(workflowState)}
              </span>
              <span className={`rounded-md px-2 py-1 ${PAY_CLS[order.paymentStatus] || "bg-amber-100 text-amber-800"}`}>
                Pago: {order.paymentStatus}
              </span>
              <span className={`rounded-md px-2 py-1 ${DELIVERY_CLS[order.deliveryState] || "bg-sepia/20 text-encre"}`}>
                Entrega: {order.deliveryState}
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-encre/70 sm:grid-cols-2 lg:grid-cols-4">
            <p>ETA: <strong className="text-encre">{order.dueDate ? new Date(order.dueDate).toLocaleDateString("es-ES") : "—"}</strong></p>
            <p>Importe: <strong className="text-encre">{(order.amountCents / 100).toFixed(2)} EUR</strong></p>
            <p>Asignado: <strong className="text-encre">{order.assignedTo || "—"}</strong></p>
            <p>Teléfono: <strong className="text-encre">{order.clientPhone || "—"}</strong></p>
          </div>
          {order.clientNotes && (
            <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-amber-800">Observaciones del cliente</p>
              <p className="mt-1 whitespace-pre-line text-sm text-encre/80">{order.clientNotes}</p>
            </div>
          )}
        </div>

        {/* SECCIÓN 1 — Subir / ver traducciones (lo primero: el dolor de "dónde meto la traducción") */}
        <Section id="traduccion" title="Subir y entregar la traducción">
          {deliveredFiles.length > 0 ? (
            <div className="mb-4 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800">
                Traducciones subidas en este pedido ({deliveredFiles.length})
              </p>
              <ul className="mt-1.5 space-y-1">
                {deliveredFiles.map((f, i) => (
                  <li key={i} className="text-sm">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline">
                      ✓ {f.name}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-emerald-200 pt-3">
                <p className="text-xs font-semibold text-emerald-800">Reenviar al cliente</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {whatsappResendHref ? (
                    <a
                      href={whatsappResendHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Reenviar por WhatsApp (traducciones + reseña)
                    </a>
                  ) : (
                    <span className="text-xs text-encre/50">Sin teléfono del cliente para WhatsApp.</span>
                  )}
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-bleu hover:underline"
                  >
                    Enlace de reseña Google →
                  </a>
                </div>
                <p className="mt-1 text-[11px] text-encre/50">
                  Abre WhatsApp con el mensaje y los enlaces ya escritos. Útil para leads sin email real (@whatsapp.local).
                </p>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-encre/60">
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
            <p className="text-sm text-encre/60">No hay documentos fuente guardados en este pedido.</p>
          ) : (
            <ul className="space-y-1">
              {sourceDocs.map((d, i) => (
                <li key={i} className="text-sm">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline">
                      {d.name}
                    </a>
                  ) : (
                    <span className="text-encre/70">{d.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* SECCIÓN 3 — Colaborador */}
        <Section id="colab" title="Colaborador">
          {assignment ? (
            <div className="text-sm text-encre/80">
              <p>
                <strong className="text-encre">{assignment.collaborator.fullName}</strong> · {assignment.status}
              </p>
              {assignment.deliveredFileUrl && (
                <p className="mt-1">
                  Entrega del colaborador:{" "}
                  <a href={assignment.deliveredFileUrl} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline">
                    {assignment.deliveredFilename || "archivo"}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-encre/60">
              Sin colaborador asignado{" "}
              <span className="text-encre/50">(FR lo traduce Juan; otros idiomas se auto-asignan al pago).</span>
            </p>
          )}
        </Section>

        {/* SECCIÓN 4 — Finanzas */}
        <Section id="finanzas" title="Finanzas">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-sepia/30 bg-cream/60 p-3">
              <p className="text-xs uppercase tracking-wide text-encre/50">Importe</p>
              <p className="text-sm font-semibold text-encre">{(order.amountCents / 100).toFixed(2)} EUR</p>
            </div>
            <div className="rounded-xl border border-sepia/30 bg-cream/60 p-3">
              <p className="text-xs uppercase tracking-wide text-encre/50">Estado de pago</p>
              <p className="text-sm font-semibold text-encre">{order.paymentStatus}</p>
            </div>
            <div className="rounded-xl border border-sepia/30 bg-cream/60 p-3">
              <p className="text-xs uppercase tracking-wide text-encre/50">Factura</p>
              <a href="/zona-traductor/facturas" className="text-sm font-semibold text-bleu hover:underline">
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
  );
}
