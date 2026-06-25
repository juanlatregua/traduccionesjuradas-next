import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import {
  getDeliveryStateLabel,
  getPaymentStateLabel,
} from "@/lib/client-area";
import OrderClientPanel from "@/components/OrderClientPanel";
import AutoRefresh from "@/components/AutoRefresh";
import { getWorkflowState } from "@/lib/workflow";
import { findTranslatorProfile } from "@/lib/translators";

export const metadata: Metadata = {
  title: "Estado de pedido",
  description: "Seguimiento del pedido, presupuesto, pago e historial.",
  robots: {
    index: false,
    follow: false,
  },
};

type PedidoPageProps = {
  params: {
    reference: string;
  };
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function getSourceDocuments(events: Array<any>) {
  const submitted = events.find((e) => e.type === "presupuesto.submitted");
  const fromSubmitted = (() => {
    if (!submitted) return [];
    const payload = (submitted.payload || {}) as any;
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files.map((file: any) => ({
      fileUrl: String(file?.url || ""),
      fileName: String(file?.name || "Documento"),
      uploadedAt: String(file?.uploadedAt || submitted.createdAt?.toISOString?.() || ""),
    }));
  })();

  const fromOrderUpload = events
    .filter((e) => e.type === "order.source_document_uploaded")
    .map((event) => {
      const payload = (event.payload || {}) as any;
      return {
        fileUrl: String(payload.fileUrl || ""),
        fileName: String(payload.fileName || "Documento"),
        uploadedAt: String(payload.uploadedAt || event.createdAt?.toISOString?.() || ""),
      };
    });

  const seen = new Set<string>();
  return [...fromOrderUpload, ...fromSubmitted].filter((doc) => {
    if (!doc.fileUrl) return false;
    if (seen.has(doc.fileUrl)) return false;
    seen.add(doc.fileUrl);
    return true;
  });
}

export default async function PedidoPage({ params }: PedidoPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/acceso?callbackUrl=" + encodeURIComponent(`/area-cliente/pedido/${params.reference}`));
  }

  const order = await getOrderDetail(params.reference, session.user.email);
  if (!order) notFound();

  const invoiceEvents = order.events.filter((e) => e.type.startsWith("invoice"));
  const proofEvents = order.events.filter((e) => e.type === "payment.proof_uploaded");
  const sourceDocuments = getSourceDocuments(order.events);
  const hasProofUploaded = proofEvents.length > 0;
  const workflowState = getWorkflowState(order);
  const translatorProfile = findTranslatorProfile(order.assignedTo);
  const translatorName = order.assignedTo || translatorProfile?.fullName || null;
  const paymentVerificationLabel =
    order.paymentStatus === "PAID"
      ? "Pago confirmado"
      : hasProofUploaded
      ? "Comprobante enviado (pendiente de verificación)"
      : "Pendiente de pago";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AutoRefresh intervalMs={20000} idleMs={30000} />
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Referencia {order.reference}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          Estado de tu pedido
        </h1>
        <p className="mt-2 text-sm text-sepia">
          Fecha: {order.createdAt.toISOString().slice(0, 10)} · Combinación: {order.langPair || "—"}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">Presupuesto</p>
            <p className="mt-1 text-sm font-semibold text-encre">
              {formatMoney(order.amountCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">Pago</p>
            <p className="mt-1 text-sm font-semibold text-encre">{getPaymentStateLabel(order.paymentStatus)}</p>
          </div>
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">Estado</p>
            <p className="mt-1 text-sm font-semibold text-encre">{getDeliveryStateLabel(order.deliveryState)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-sepia">
          Verificación de pago: <span className="font-semibold">{paymentVerificationLabel}</span>
        </p>
        {workflowState === "PENDIENTE_REVISION" && (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tu pedido está en revisión interna para validar precio y plazo. Te enviaremos el enlace de pago en cuanto esté confirmado.
          </p>
        )}
        {workflowState === "PRESUPUESTO_ENVIADO" && (
          <p className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
            Ya hemos enviado tu presupuesto final. Puedes completar el pago desde la pantalla de pago del pedido.
          </p>
        )}
        {order.dueDate && (
          <p className="mt-1 text-sm text-sepia">
            Fecha estimada de entrega:{" "}
            <span className="font-semibold">
              {order.dueDate.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Detalle del pedido</h2>
        <div className="mt-4 space-y-1 text-sm text-sepia">
          <p><span className="font-semibold">Concepto:</span> {order.title}</p>
          {order.langPair && <p><span className="font-semibold">Idiomas:</span> {order.langPair}</p>}
          {order.words && <p><span className="font-semibold">Palabras:</span> {order.words}</p>}
          {order.pagesLabel && <p><span className="font-semibold">Alcance:</span> {order.pagesLabel}</p>}
          {translatorName && (
            <p>
              <span className="font-semibold">Traductor/a jurado/a asignado/a:</span> {translatorName}
              {translatorProfile?.swornNumber ? ` · Nº ${translatorProfile.swornNumber}` : ""}
            </p>
          )}
        </div>
        <p className="mt-3 text-sm font-semibold text-encre">Total: {formatMoney(order.amountCents)}</p>
      </section>

      <OrderClientPanel
        reference={order.reference}
        deliveryType={order.deliveryType}
        paymentStatus={order.paymentStatus}
        hasShipping={!!order.shipping}
        hasBilling={!!order.billing}
        billingRequested={order.billing?.requested || false}
        initialShipping={
          order.shipping
            ? {
                name: order.shipping.name,
                phone: order.shipping.phone,
                address: order.shipping.address,
                city: order.shipping.city,
                province: order.shipping.province,
                postalCode: order.shipping.postalCode,
                country: order.shipping.country,
              }
            : null
        }
        initialBilling={
          order.billing
            ? {
                requestInvoice: order.billing.requested,
                fiscalName: order.billing.fiscalName,
                nif: order.billing.nif,
                address: order.billing.address,
                city: order.billing.city,
                postalCode: order.billing.postalCode,
                country: order.billing.country,
                email: order.billing.email,
              }
            : null
        }
        invoiceEvents={invoiceEvents.map((e) => ({
          date: e.createdAt.toISOString().slice(0, 16).replace("T", " "),
          text: e.message,
        }))}
      />

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Documento original</h2>
        {sourceDocuments.length === 0 ? (
          <p className="mt-2 text-sm text-sepia">
            Aún no hay documento fuente adjunto en este pedido.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sourceDocuments.map((doc, idx) => (
              <li key={`${doc.fileUrl}-${idx}`} className="rounded-2xl border border-cream bg-parchment px-3 py-2 text-sm text-sepia">
                <p>
                  <span className="font-semibold">
                    {doc.uploadedAt ? doc.uploadedAt.slice(0, 16).replace("T", " ") : "Sin fecha"}
                  </span>{" "}
                  · {doc.fileName}
                </p>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-xs font-semibold text-bleu hover:underline"
                >
                  Ver documento
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Comprobante de pago</h2>
        {proofEvents.length === 0 ? (
          <p className="mt-2 text-sm text-sepia">
            Aún no hemos recibido ningún comprobante en este pedido.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proofEvents.map((event) => {
              const payload = (event.payload || {}) as any;
              const fileUrl = String(payload.fileUrl || "");
              const fileName = String(payload.fileName || "Comprobante");
              return (
                <li key={event.id} className="rounded-2xl border border-cream bg-parchment px-3 py-2 text-sm text-sepia">
                  <p>
                    <span className="font-semibold">
                      {event.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>{" "}
                    · {fileName}
                  </p>
                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-xs font-semibold text-bleu hover:underline"
                    >
                      Ver comprobante
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Agenda del pedido</h2>
        <ol className="mt-3 space-y-2 text-sm text-sepia">
          <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
            Pedido creado: {order.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </li>
          {hasProofUploaded && (
            <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
              Comprobante recibido: {proofEvents[0].createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </li>
          )}
          {order.paidAt && (
            <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
              Pago confirmado: {order.paidAt.toISOString().slice(0, 16).replace("T", " ")}
            </li>
          )}
          {order.dueDate && (
            <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
              ETA entrega: {order.dueDate.toLocaleDateString("es-ES")}
            </li>
          )}
          {order.deliveryState === "TRADUCIDO" && (
            <li className="rounded-2xl border border-cream bg-cream px-3 py-2 font-semibold text-bleu">
              Traducción finalizada
            </li>
          )}
        </ol>
      </section>

      {order.billing?.requested && (
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">Factura</h2>
          <p className="mt-2 text-sm text-sepia">
            Datos de facturación registrados a nombre de {order.billing.fiscalName} ({order.billing.nif}).
          </p>
          <a
            href={`/api/orders/${order.reference}/invoice-pdf`}
            className="mt-3 inline-flex rounded-2xl bg-encre px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark"
          >
            Descargar factura PDF
          </a>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">
          {(() => {
            const n = Array.isArray(order.deliveryFilesJson) ? order.deliveryFilesJson.length : order.translatedFileUrl ? 1 : 0;
            return n > 1 ? `Archivos traducidos (${n})` : "Archivo traducido";
          })()}
        </h2>
        {(() => {
          // Lista MULTI-archivo (deliveryFilesJson); fallback al campo único.
          const files = Array.isArray(order.deliveryFilesJson)
            ? (order.deliveryFilesJson as Array<{ url?: string; filename?: string | null }>).filter(
                (f) => f && typeof f.url === "string" && f.url
              )
            : [];
          const list =
            files.length > 0
              ? files
              : order.translatedFileUrl
                ? [{ url: order.translatedFileUrl, filename: order.finalFilename }]
                : [];
          if (list.length === 0) {
            return (
              <p className="mt-2 text-sm text-sepia">
                Aún no hay archivo disponible. Te avisaremos cuando el pedido pase a estado traducido.
              </p>
            );
          }
          return (
            <div className="mt-3 flex flex-col items-start gap-2">
              {list.map((f, i) => (
                <a
                  key={f.url}
                  href={f.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-2xl bg-bleu px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark"
                >
                  ⬇ {f.filename || (list.length > 1 ? `Traducción ${i + 1} (PDF)` : "Descargar PDF traducido")}
                </a>
              ))}
            </div>
          );
        })()}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Historial</h2>
        {order.events.length === 0 ? (
          <p className="mt-2 text-sm text-sepia">Sin eventos registrados.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-sepia">
            {order.events.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-cream bg-parchment px-3 py-2">
                <span className="font-semibold">{entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>{" "}
                · {entry.message}
              </li>
            ))}
          </ul>
        )}
        <Link href="/area-cliente" className="mt-4 inline-block text-sm font-semibold text-bleu hover:underline">
          Volver al área de cliente
        </Link>
      </section>
    </main>
  );
}
