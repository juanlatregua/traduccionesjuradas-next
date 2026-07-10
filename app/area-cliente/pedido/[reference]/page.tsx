import type { Metadata } from "next";
import { clientVisibleDeliveryFiles } from "@/lib/client-delivery";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import { getSourceDocumentsFromEvents } from "@/lib/order-source-documents";
import {
  getAc,
  acIntl,
  getDeliveryStateLabel,
  getPaymentStateLabel,
} from "@/lib/i18n/area-cliente";
import OrderClientPanel from "@/components/OrderClientPanel";
import AutoRefresh from "@/components/AutoRefresh";
import { getWorkflowState } from "@/lib/workflow";

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
  return getSourceDocumentsFromEvents(events)
    .filter((d) => d.url)
    .map((d) => ({
      fileUrl: String(d.url),
      fileName: d.name,
      uploadedAt: d.uploadedAt || "",
    }));
}

export default async function PedidoPage({ params }: PedidoPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/acceso?callbackUrl=" + encodeURIComponent(`/area-cliente/pedido/${params.reference}`));
  }

  const order = await getOrderDetail(params.reference, session.user.email);
  if (!order) notFound();

  const lang = order.clientLocale;
  const t = getAc(lang).pedido;
  const tc = getAc(lang).common;
  const intl = acIntl(lang);

  const invoiceEvents = order.events.filter((e) => e.type.startsWith("invoice"));
  const proofEvents = order.events.filter((e) => e.type === "payment.proof_uploaded");
  const sourceDocuments = getSourceDocuments(order.events);
  const hasProofUploaded = proofEvents.length > 0;
  const workflowState = getWorkflowState(order);
  const paymentVerificationLabel =
    order.paymentStatus === "PAID"
      ? t.paymentVerified
      : hasProofUploaded
      ? t.paymentProofPending
      : t.paymentPending;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AutoRefresh intervalMs={20000} idleMs={30000} />
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          {t.eyebrowReference(order.reference)}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-sepia">
          {t.dateAndPair(order.createdAt.toISOString().slice(0, 10), order.langPair || "—")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">{t.cardQuote}</p>
            <p className="mt-1 text-sm font-semibold text-encre">
              {formatMoney(order.amountCents)}
            </p>
          </div>
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">{tc.payment}</p>
            <p className="mt-1 text-sm font-semibold text-encre">{getPaymentStateLabel(order.paymentStatus, lang)}</p>
          </div>
          <div className="rounded-2xl border border-cream bg-parchment p-3">
            <p className="text-xs uppercase tracking-wide text-graphite">{tc.status}</p>
            <p className="mt-1 text-sm font-semibold text-encre">{getDeliveryStateLabel(order.deliveryState, lang)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-sepia">
          {t.paymentVerification}: <span className="font-semibold">{paymentVerificationLabel}</span>
        </p>
        {workflowState === "PENDIENTE_REVISION" && (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t.noticeUnderReview}
          </p>
        )}
        {workflowState === "PRESUPUESTO_ENVIADO" && (
          <p className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
            {t.noticeQuoteSent}
          </p>
        )}
        {order.dueDate && (
          <p className="mt-1 text-sm text-sepia">
            {t.eta}:{" "}
            <span className="font-semibold">
              {order.dueDate.toLocaleDateString(intl, {
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
        <h2 className="text-lg font-semibold text-encre">{t.detailTitle}</h2>
        <div className="mt-4 space-y-1 text-sm text-sepia">
          <p><span className="font-semibold">{t.concept}:</span> {order.title}</p>
          {order.langPair && <p><span className="font-semibold">{tc.languages}:</span> {order.langPair}</p>}
          {order.words && <p><span className="font-semibold">{t.words}:</span> {order.words}</p>}
          {order.pagesLabel && <p><span className="font-semibold">{t.scope}:</span> {order.pagesLabel}</p>}
          {/* El traductor/colaborador asignado NO se muestra al cliente (confidencial,
              uso interno de la zona traductor). */}
        </div>
        <p className="mt-3 text-sm font-semibold text-encre">{tc.total}: {formatMoney(order.amountCents)}</p>
      </section>

      <OrderClientPanel
        reference={order.reference}
        lang={lang}
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
        <h2 className="text-lg font-semibold text-encre">{t.sourceDocTitle}</h2>
        {sourceDocuments.length === 0 ? (
          <p className="mt-2 text-sm text-sepia">
            {t.sourceDocEmpty}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sourceDocuments.map((doc, idx) => (
              <li key={`${doc.fileUrl}-${idx}`} className="rounded-2xl border border-cream bg-parchment px-3 py-2 text-sm text-sepia">
                <p>
                  <span className="font-semibold">
                    {doc.uploadedAt ? doc.uploadedAt.slice(0, 16).replace("T", " ") : t.noDate}
                  </span>{" "}
                  · {doc.fileName}
                </p>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-xs font-semibold text-bleu hover:underline"
                >
                  {t.seeDocument}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">{t.proofTitle}</h2>
        {proofEvents.length === 0 ? (
          <p className="mt-2 text-sm text-sepia">
            {t.proofEmpty}
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
                      {t.seeProof}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">{t.timelineTitle}</h2>
        <ol className="mt-3 space-y-2 text-sm text-sepia">
          <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
            {t.timelineCreated(order.createdAt.toISOString().slice(0, 16).replace("T", " "))}
          </li>
          {hasProofUploaded && (
            <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
              {t.timelineProof(proofEvents[0].createdAt.toISOString().slice(0, 16).replace("T", " "))}
            </li>
          )}
          {order.paidAt && (
            <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
              {t.timelinePaid(order.paidAt.toISOString().slice(0, 16).replace("T", " "))}
            </li>
          )}
          {order.dueDate && (
            <li className="rounded-2xl border border-cream bg-parchment px-3 py-2">
              {t.timelineEta(order.dueDate.toLocaleDateString(intl))}
            </li>
          )}
          {order.deliveryState === "TRADUCIDO" && (
            <li className="rounded-2xl border border-cream bg-cream px-3 py-2 font-semibold text-bleu">
              {t.timelineDone}
            </li>
          )}
        </ol>
      </section>

      {order.billing?.requested && (
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">{t.invoiceTitle}</h2>
          <p className="mt-2 text-sm text-sepia">
            {t.invoiceBillingData(order.billing.fiscalName || "", order.billing.nif || "")}
          </p>
          <a
            href={`/api/orders/${order.reference}/invoice-pdf`}
            className="mt-3 inline-flex rounded-2xl bg-encre px-4 py-2 text-sm font-semibold text-white hover:bg-bleu-dark"
          >
            {t.invoiceDownload}
          </a>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">
          {(() => {
            const n = clientVisibleDeliveryFiles(order).length;
            return n > 1 ? t.filesTitleMany(n) : t.filesTitleOne;
          })()}
        </h2>
        {(() => {
          // Fuente única con gate de pago (no entregar sin cobrar).
          const list = clientVisibleDeliveryFiles(order);
          if (list.length === 0) {
            return (
              <p className="mt-2 text-sm text-sepia">
                {t.filesEmpty}
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
                  ⬇ {f.filename || (list.length > 1 ? t.fileTranslationN(i + 1) : t.fileDownloadOne)}
                </a>
              ))}
            </div>
          );
        })()}
      </section>

      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">{t.historyTitle}</h2>
        {order.events.length === 0 ? (
          <p className="mt-2 text-sm text-sepia">{t.historyEmpty}</p>
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
          {tc.backClientArea}
        </Link>
      </section>
    </main>
  );
}
