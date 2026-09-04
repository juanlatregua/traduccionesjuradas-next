import type { Metadata } from "next";
import { clientVisibleDeliveryFiles } from "@/lib/client-delivery";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyOrderToken, buildSignedOrderUrl } from "@/lib/order-token";
import { getWorkflowState, type WorkflowState } from "@/lib/workflow";
import { checkRateLimit } from "@/lib/rate-limit";
import { EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Estado de tu pedido — Traducciones Juradas",
  robots: { index: false, follow: false },
};

type Props = {
  params: { reference: string };
  searchParams: { token?: string };
};

type Lang = "es" | "fr";

/* ------------------------------------------------------------------ */
/*  i18n — el cliente francófono recibe el SMS en francés (lib/sms-     */
/*  templates) y al pinchar el enlace aterriza aquí: la página sigue    */
/*  su idioma (Order.clientLocale), no lo deja en español.              */
/* ------------------------------------------------------------------ */

type Strings = {
  steps: string[];
  rateLimited: string;
  tracking: string;
  title: string;
  reference: string;
  createdOn: string;
  cardBudget: string;
  cardPayment: string;
  cardTranslation: string;
  estimatedDelivery: string;
  pay: { PAID: string; FAILED: string; REFUNDED: string; PENDING: string };
  delivery: { delivered: string; inProgress: string; done: string; pending: string };
  pendingPaymentBanner: string;
  payNow: string;
  proofBanner: string;
  inProgressBanner: string;
  readyBanner: string;
  download: string;
  history: string;
  timeline: {
    created: string;
    paid: string;
    proof: string;
    started: string;
    delivered: string;
    closed: string;
    deliveryNotif: string;
  };
  doubts: string;
  contactUs: string;
  whatsappText: (ref: string) => string;
  mailSubject: (ref: string) => string;
};

const STRINGS: Record<Lang, Strings> = {
  es: {
    steps: ["Presupuesto", "Pago", "En traducción", "Entregado", "Cerrado"],
    rateLimited:
      "Has superado el límite de consultas. Espera unos minutos e inténtalo de nuevo.",
    tracking: "Seguimiento de pedido",
    title: "Estado de tu pedido",
    reference: "Referencia",
    createdOn: "Creado el",
    cardBudget: "Presupuesto",
    cardPayment: "Pago",
    cardTranslation: "Traducción",
    estimatedDelivery: "Entrega estimada",
    pay: {
      PAID: "Pagado",
      FAILED: "Fallido",
      REFUNDED: "Reembolsado",
      PENDING: "Pendiente de pago",
    },
    delivery: {
      delivered: "Traducción entregada",
      inProgress: "En proceso",
      done: "Completado",
      pending: "Pendiente",
    },
    pendingPaymentBanner: "Tu pedido está pendiente de pago.",
    payNow: "Pagar ahora",
    proofBanner: "Hemos recibido tu comprobante de pago. Estamos verificándolo.",
    inProgressBanner: "Tu traducción está en proceso. Entrega estimada:",
    readyBanner: "Tu traducción está lista.",
    download: "Descargar traducción",
    history: "Historial",
    timeline: {
      created: "Pedido creado",
      paid: "Pago confirmado",
      proof: "Justificante de pago recibido",
      started: "Traducción iniciada",
      delivered: "Traducción entregada",
      closed: "Pedido cerrado",
      deliveryNotif: "Notificación de entrega enviada",
    },
    doubts: "¿Tienes alguna duda?",
    contactUs: "Contacta con nosotros indicando tu referencia",
    whatsappText: (ref: string) =>
      `Hola, tengo una consulta sobre mi pedido ${ref}.`,
    mailSubject: (ref: string) => `Consulta pedido ${ref}`,
  },
  fr: {
    steps: ["Devis", "Paiement", "En traduction", "Livré", "Clôturé"],
    rateLimited:
      "Vous avez dépassé la limite de consultations. Patientez quelques minutes et réessayez.",
    tracking: "Suivi de votre commande",
    title: "État de votre commande",
    reference: "Référence",
    createdOn: "Créée le",
    cardBudget: "Devis",
    cardPayment: "Paiement",
    cardTranslation: "Traduction",
    estimatedDelivery: "Livraison estimée",
    pay: {
      PAID: "Payé",
      FAILED: "Échoué",
      REFUNDED: "Remboursé",
      PENDING: "En attente de paiement",
    },
    delivery: {
      delivered: "Traduction livrée",
      inProgress: "En cours",
      done: "Terminé",
      pending: "En attente",
    },
    pendingPaymentBanner: "Votre commande est en attente de paiement.",
    payNow: "Payer maintenant",
    proofBanner:
      "Nous avons reçu votre justificatif de paiement. Nous le vérifions.",
    inProgressBanner: "Votre traduction est en cours. Livraison estimée :",
    readyBanner: "Votre traduction est prête.",
    download: "Télécharger la traduction",
    history: "Historique",
    timeline: {
      created: "Commande créée",
      paid: "Paiement confirmé",
      proof: "Justificatif de paiement reçu",
      started: "Traduction commencée",
      delivered: "Traduction livrée",
      closed: "Commande clôturée",
      deliveryNotif: "Notification de livraison envoyée",
    },
    doubts: "Une question ?",
    contactUs: "Contactez-nous en indiquant votre référence",
    whatsappText: (ref: string) =>
      `Bonjour, j'ai une question concernant ma commande ${ref}.`,
    mailSubject: (ref: string) => `Question commande ${ref}`,
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveIp() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

function workflowToStep(state: WorkflowState): number {
  switch (state) {
    case "BORRADOR":
    case "PENDIENTE_REVISION":
    case "PRESUPUESTO_ENVIADO":
      return 0;
    case "PENDIENTE_PAGO":
    case "JUSTIFICANTE_SUBIDO":
      return 1;
    case "PAGO_VALIDADO":
    case "EN_TRADUCCION":
      return 2;
    case "TRADUCIDO_ENTREGADO":
      return 3;
    case "CERRADO":
      return 4;
  }
}

function formatDate(d: Date | string | null | undefined, lang: Lang) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(lang === "fr" ? "fr-FR" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2)} €`;
}

function paymentLabelFor(status: string, t: Strings) {
  if (status === "PAID") return t.pay.PAID;
  if (status === "FAILED") return t.pay.FAILED;
  if (status === "REFUNDED") return t.pay.REFUNDED;
  return t.pay.PENDING;
}

function getDeliveryLabel(state: WorkflowState, t: Strings) {
  switch (state) {
    case "TRADUCIDO_ENTREGADO":
      return t.delivery.delivered;
    case "EN_TRADUCCION":
    case "PAGO_VALIDADO":
      return t.delivery.inProgress;
    case "CERRADO":
      return t.delivery.done;
    default:
      return t.delivery.pending;
  }
}

type TimelineEntry = {
  label: string;
  date: Date;
};

function buildTimeline(
  order: {
    createdAt: Date;
    paidAt: Date | null;
    events: Array<{ type: string; payload: unknown; createdAt: Date }>;
  },
  t: Strings,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({ label: t.timeline.created, date: order.createdAt });

  if (order.paidAt) {
    entries.push({ label: t.timeline.paid, date: order.paidAt });
  }

  const proofEvent = order.events.find(
    (e) => e.type === "payment.proof_uploaded",
  );
  if (proofEvent && !order.paidAt) {
    entries.push({
      label: t.timeline.proof,
      date: proofEvent.createdAt,
    });
  }

  // Find workflow state change events
  for (const event of order.events) {
    if (event.type !== "workflow.state_changed") continue;
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) continue;
    const to = String(payload.to || "");
    if (to === "EN_TRADUCCION") {
      entries.push({ label: t.timeline.started, date: event.createdAt });
    }
    if (to === "TRADUCIDO_ENTREGADO") {
      entries.push({ label: t.timeline.delivered, date: event.createdAt });
    }
    if (to === "CERRADO") {
      entries.push({ label: t.timeline.closed, date: event.createdAt });
    }
  }

  const deliveryNotif = order.events.find(
    (e) => e.type === "notification.delivery_ready.sent",
  );
  if (deliveryNotif) {
    entries.push({
      label: t.timeline.deliveryNotif,
      date: deliveryNotif.createdAt,
    });
  }

  // Sort chronologically
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  return entries;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default async function PedidoPortalPage({
  params,
  searchParams,
}: Props) {
  const token = searchParams.token || "";
  const reference = decodeURIComponent(params.reference);

  // Rate limit
  const ip = resolveIp();
  const rl = await checkRateLimit({
    key: `pedido-portal:${ip}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return (
      <main className="min-h-screen bg-parchment px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          {STRINGS.es.rateLimited}
        </section>
      </main>
    );
  }

  // Token verification
  if (!token || !verifyOrderToken(reference, token)) {
    notFound();
  }

  // Fetch order
  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      reference: true,
      title: true,
      langPair: true,
      amountCents: true,
      currency: true,
      paymentStatus: true,
      status: true,
      deliveryState: true,
      // Carril de cobro aplazado: sin esto, clientVisibleDeliveryFiles exige PAID
      // y un cliente de crédito no vería su traducción (lib/credit-terms.ts).
      clientInvoice: { select: { status: true, docKind: true, dueDate: true, paidAt: true } },
      monthlyInvoice: { select: { status: true, docKind: true, annulledAt: true } },
      clientLocale: true,
      dueDate: true,
      finalDeliveryFileUrl: true,
      translatedFileUrl: true,
      finalFilename: true,
      deliveryFilesJson: true,
      createdAt: true,
      paidAt: true,
      events: {
        where: {
          type: {
            in: [
              "workflow.state_changed",
              "payment.proof_uploaded",
              "notification.delivery_ready.sent",
            ],
          },
        },
        orderBy: { createdAt: "desc" as const },
        take: 30,
        select: { type: true, payload: true, createdAt: true },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const lang: Lang = order.clientLocale === "fr" ? "fr" : "es";
  const t = STRINGS[lang];

  const workflowState = getWorkflowState({
    paymentStatus: order.paymentStatus || "",
    deliveryState: order.deliveryState,
    events: order.events,
  });

  const currentStep = workflowToStep(workflowState);
  const paymentLabel = paymentLabelFor(order.paymentStatus || "", t);
  const deliveryLabel = getDeliveryLabel(workflowState, t);
  const timeline = buildTimeline(order, t);

  // Traducciones descargables: fuente única con gate de pago (no entregar sin cobrar).
  const deliveryFiles = clientVisibleDeliveryFiles(order);

  // Payment URL (signed)
  const paymentUrl = buildSignedOrderUrl(reference, "pagar");

  // WhatsApp link with reference pre-filled
  const whatsappUrl = `https://wa.me/34951333614?text=${encodeURIComponent(t.whatsappText(reference))}`;

  return (
    <main className="min-h-screen bg-parchment px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            {t.tracking}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-encre">{t.title}</h1>
          <p className="mt-1 text-sm text-sepia">
            {t.reference}: <strong>{order.reference}</strong> · {t.createdOn}{" "}
            {formatDate(order.createdAt, lang)}
          </p>
          {order.title && (
            <p className="mt-0.5 text-sm text-sepia">{order.title}</p>
          )}
        </section>

        {/* Stepper */}
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {t.steps.map((label, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-bleu text-white"
                        : isDone
                          ? "bg-bleu/20 text-bleu"
                          : "bg-cream text-sepia/50"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-center text-[11px] leading-tight ${
                      isActive
                        ? "font-semibold text-bleu"
                        : isDone
                          ? "font-medium text-bleu/70"
                          : "text-sepia/50"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Status cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          {/* Presupuesto */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sepia">
              {t.cardBudget}
            </p>
            <p className="mt-2 text-xl font-bold text-encre">
              {formatMoney(order.amountCents)}
            </p>
            {order.langPair && (
              <p className="mt-1 text-xs text-sepia">
                {order.langPair.toUpperCase().replace("-", " → ")}
              </p>
            )}
          </div>

          {/* Pago */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sepia">
              {t.cardPayment}
            </p>
            <p className="mt-2 text-xl font-bold text-encre">{paymentLabel}</p>
            {order.paidAt && (
              <p className="mt-1 text-xs text-sepia">
                {formatDate(order.paidAt, lang)}
              </p>
            )}
          </div>

          {/* Traducción */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sepia">
              {t.cardTranslation}
            </p>
            <p className="mt-2 text-xl font-bold text-encre">
              {deliveryLabel}
            </p>
            {workflowState === "EN_TRADUCCION" && order.dueDate && (
              <p className="mt-1 text-xs text-sepia">
                {t.estimatedDelivery}: {formatDate(order.dueDate, lang)}
              </p>
            )}
          </div>
        </section>

        {/* Contextual banners */}
        {(workflowState === "PENDIENTE_PAGO" ||
          workflowState === "JUSTIFICANTE_SUBIDO" ||
          (workflowState === "EN_TRADUCCION" && order.dueDate) ||
          workflowState === "TRADUCIDO_ENTREGADO") && (
          <section className="space-y-3">
            {workflowState === "PENDIENTE_PAGO" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  {t.pendingPaymentBanner}
                </p>
                <a
                  href={paymentUrl}
                  className="mt-3 inline-block rounded-lg bg-bleu px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu/90"
                >
                  {t.payNow}
                </a>
              </div>
            )}

            {workflowState === "JUSTIFICANTE_SUBIDO" && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  {t.proofBanner}
                </p>
              </div>
            )}

            {workflowState === "EN_TRADUCCION" && order.dueDate && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  {t.inProgressBanner}{" "}
                  <strong>{formatDate(order.dueDate, lang)}</strong>.
                </p>
              </div>
            )}

            {workflowState === "TRADUCIDO_ENTREGADO" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-900">
                  {t.readyBanner}
                </p>
                {deliveryFiles.length > 0 && (
                  <div className="mt-3 flex flex-col items-start gap-2">
                    {deliveryFiles.map((f, i) => (
                      <a
                        key={f.url}
                        href={f.url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        {t.download}
                        {deliveryFiles.length > 1 ? ` ${i + 1}${f.filename ? ` · ${f.filename}` : ""}` : ""}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-sepia">
              {t.history}
            </h2>
            <ol className="mt-4 space-y-3 border-l-2 border-cream pl-4">
              {timeline.map((entry, i) => (
                <li key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-bleu bg-white" />
                  <p className="text-sm font-medium text-encre">
                    {entry.label}
                  </p>
                  <p className="text-xs text-sepia">{formatDate(entry.date, lang)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Contact */}
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sepia">
            {t.doubts}
          </h2>
          <p className="mt-2 text-sm text-sepia">
            {t.contactUs} <strong>{order.reference}</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              WhatsApp
            </a>
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent(t.mailSubject(order.reference))}`}
              className="inline-flex items-center gap-2 rounded-lg border border-bleu/30 bg-cream px-4 py-2 text-sm font-medium text-bleu hover:bg-bleu/10"
            >
              Email
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
