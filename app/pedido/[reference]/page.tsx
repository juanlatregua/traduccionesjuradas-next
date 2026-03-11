import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyOrderToken, buildSignedOrderUrl } from "@/lib/order-token";
import { getWorkflowState, type WorkflowState } from "@/lib/workflow";
import { getPaymentStateLabel } from "@/lib/client-area";
import { checkRateLimit } from "@/lib/rate-limit";
import { WHATSAPP_LINK, EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Estado de tu pedido — Traducciones Juradas",
  robots: { index: false, follow: false },
};

type Props = {
  params: { reference: string };
  searchParams: { token?: string };
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

const CLIENT_STEPS = [
  "Presupuesto",
  "Pago",
  "En traducción",
  "Entregado",
  "Cerrado",
] as const;

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

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2)} €`;
}

function getDeliveryLabel(state: WorkflowState) {
  switch (state) {
    case "TRADUCIDO_ENTREGADO":
      return "Traducción entregada";
    case "EN_TRADUCCION":
    case "PAGO_VALIDADO":
      return "En proceso";
    case "CERRADO":
      return "Completado";
    default:
      return "Pendiente";
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
  workflowState: WorkflowState,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({ label: "Pedido creado", date: order.createdAt });

  if (order.paidAt) {
    entries.push({ label: "Pago confirmado", date: order.paidAt });
  }

  const proofEvent = order.events.find(
    (e) => e.type === "payment.proof_uploaded",
  );
  if (proofEvent && !order.paidAt) {
    entries.push({
      label: "Justificante de pago recibido",
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
      entries.push({ label: "Traducción iniciada", date: event.createdAt });
    }
    if (to === "TRADUCIDO_ENTREGADO") {
      entries.push({ label: "Traducción entregada", date: event.createdAt });
    }
    if (to === "CERRADO") {
      entries.push({ label: "Pedido cerrado", date: event.createdAt });
    }
  }

  const deliveryNotif = order.events.find(
    (e) => e.type === "notification.delivery_ready.sent",
  );
  if (deliveryNotif) {
    entries.push({
      label: "Notificación de entrega enviada",
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
          Has superado el límite de consultas. Espera unos minutos e inténtalo
          de nuevo.
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
      dueDate: true,
      finalDeliveryFileUrl: true,
      translatedFileUrl: true,
      finalFilename: true,
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

  const workflowState = getWorkflowState({
    paymentStatus: order.paymentStatus || "",
    deliveryState: order.deliveryState,
    events: order.events,
  });

  const currentStep = workflowToStep(workflowState);
  const paymentLabel = getPaymentStateLabel(order.paymentStatus || "");
  const deliveryLabel = getDeliveryLabel(workflowState);
  const timeline = buildTimeline(order, workflowState);

  // Delivery file URL
  const deliveryFileUrl =
    String(order.finalDeliveryFileUrl || "").trim() ||
    String(order.translatedFileUrl || "").trim();

  // Payment URL (signed)
  const paymentUrl = buildSignedOrderUrl(reference, "pagar");

  // WhatsApp link with reference pre-filled
  const whatsappText = `Hola, tengo una consulta sobre mi pedido ${reference}.`;
  const whatsappUrl = `https://wa.me/34951333614?text=${encodeURIComponent(whatsappText)}`;

  return (
    <main className="min-h-screen bg-parchment px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            Seguimiento de pedido
          </p>
          <h1 className="mt-1 text-2xl font-bold text-encre">
            Estado de tu pedido
          </h1>
          <p className="mt-1 text-sm text-sepia">
            Referencia: <strong>{order.reference}</strong> · Creado el{" "}
            {formatDate(order.createdAt)}
          </p>
          {order.title && (
            <p className="mt-0.5 text-sm text-sepia">{order.title}</p>
          )}
        </section>

        {/* Stepper */}
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {CLIENT_STEPS.map((label, i) => {
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
              Presupuesto
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
              Pago
            </p>
            <p className="mt-2 text-xl font-bold text-encre">{paymentLabel}</p>
            {order.paidAt && (
              <p className="mt-1 text-xs text-sepia">
                {formatDate(order.paidAt)}
              </p>
            )}
          </div>

          {/* Traducción */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sepia">
              Traducción
            </p>
            <p className="mt-2 text-xl font-bold text-encre">
              {deliveryLabel}
            </p>
            {workflowState === "EN_TRADUCCION" && order.dueDate && (
              <p className="mt-1 text-xs text-sepia">
                Entrega estimada: {formatDate(order.dueDate)}
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
                  Tu pedido está pendiente de pago.
                </p>
                <a
                  href={paymentUrl}
                  className="mt-3 inline-block rounded-lg bg-bleu px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu/90"
                >
                  Pagar ahora
                </a>
              </div>
            )}

            {workflowState === "JUSTIFICANTE_SUBIDO" && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  Hemos recibido tu comprobante de pago. Estamos verificándolo.
                </p>
              </div>
            )}

            {workflowState === "EN_TRADUCCION" && order.dueDate && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  Tu traducción está en proceso. Entrega estimada:{" "}
                  <strong>{formatDate(order.dueDate)}</strong>.
                </p>
              </div>
            )}

            {workflowState === "TRADUCIDO_ENTREGADO" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-900">
                  Tu traducción está lista.
                </p>
                {deliveryFileUrl && (
                  <a
                    href={deliveryFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Descargar traducción
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-sepia">
              Historial
            </h2>
            <ol className="mt-4 space-y-3 border-l-2 border-cream pl-4">
              {timeline.map((entry, i) => (
                <li key={i} className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-bleu bg-white" />
                  <p className="text-sm font-medium text-encre">
                    {entry.label}
                  </p>
                  <p className="text-xs text-sepia">{formatDate(entry.date)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Contact */}
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sepia">
            ¿Tienes alguna duda?
          </h2>
          <p className="mt-2 text-sm text-sepia">
            Contacta con nosotros indicando tu referencia{" "}
            <strong>{order.reference}</strong>.
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
              href={`mailto:${EMAIL}?subject=${encodeURIComponent(`Consulta pedido ${order.reference}`)}`}
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
