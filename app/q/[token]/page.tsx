import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  decimalToNumber,
  hashValue,
  isQuotePayableStatus,
  normalizeQuoteStatus,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/quotes";
import QuotePublicPayButton from "@/components/QuotePublicPayButton";
import QuoteFeedbackForm from "@/components/QuoteFeedbackForm";
import { checkRateLimit } from "@/lib/rate-limit";

type Props = {
  params: { token: string };
  searchParams: {
    paid?: string;
    canceled?: string;
    fb?: string;
    pago?: string;
  };
};

export const metadata: Metadata = {
  title: "Presupuesto",
  robots: {
    index: false,
    follow: false,
  },
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function resolveIp() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

async function trackOpen(quote: { id: string; status: string }) {
  const ip = resolveIp();
  const ua = headers().get("user-agent") || null;
  const salt = process.env.NEXTAUTH_SECRET || "quote-open";
  const ipHash = hashValue(`${ip}:${salt}`);
  const now = new Date();

  await prisma.accessEvent.create({
    data: {
      quoteId: quote.id,
      type: "OPENED",
      at: now,
      userAgent: ua,
      ipHash,
    },
  });

  if (quote.status === "SENT") {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "OPENED",
        openedAt: now,
      },
    });
  }
}

export default async function PublicQuotePage({ params, searchParams }: Props) {
  const ip = resolveIp();
  const rl = await checkRateLimit({
    key: `quote-public:${params.token}:${ip}`,
    limit: 90,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return (
      <main className="min-h-screen bg-parchment px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          Has superado el límite de consultas para este enlace. Espera unos minutos e inténtalo de nuevo.
        </section>
      </main>
    );
  }

  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    select: {
      id: true,
      status: true,
      tokenExpiresAt: true,
    },
  });
  if (!quote) {
    const host = headers().get("host") || "";
    if (host.includes("vercel.app")) {
      const qs = new URLSearchParams();
      if (searchParams?.paid) qs.set("paid", String(searchParams.paid));
      if (searchParams?.canceled) qs.set("canceled", String(searchParams.canceled));
      if (searchParams?.fb) qs.set("fb", String(searchParams.fb));
      if (searchParams?.pago) qs.set("pago", String(searchParams.pago));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      redirect(`https://www.traduccionesjuradas.net/q/${encodeURIComponent(params.token)}${suffix}`);
    }
    notFound();
  }

  if (quote.tokenExpiresAt && quote.tokenExpiresAt < new Date() && quote.status !== "EXPIRED") {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "EXPIRED", expiredAt: new Date() },
    });
  }

  await trackOpen({
    id: quote.id,
    status: quote.status,
  }).catch((err) => console.error("[q/token] open tracking failed", err));

  const refreshed = await prisma.quote.findUnique({
    where: { id: quote.id },
    select: {
      paymentMethods: true,
      id: true,
      quoteNumber: true,
      status: true,
      validUntil: true,
      sourceLang: true,
      targetLang: true,
      deliveryType: true,
      holderNames: true,
      translatorName: true,
      translatorMaec: true,
      lostReason: true,
      paidAt: true,
      pdfUrl: true,
      subtotal: true,
      discountAmount: true,
      shippingAmount: true,
      vatAmount: true,
      total: true,
      lines: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          // El cliente tiene que poder ABRIR el documento de cada linea: leer
          // "Apostilla" dos veces sin poder comprobar a cual corresponde es la
          // duda que deja un presupuesto sin pagar (caso RODRIGO 2026-00074).
          sourceFileUrl: true,
        },
      },
    },
  });
  if (!refreshed) notFound();

  const status = normalizeQuoteStatus(refreshed.status);
  const isPayable = isQuotePayableStatus(status);
  const subtotal = decimalToNumber(refreshed.subtotal);
  const discountAmount = decimalToNumber(refreshed.discountAmount);
  const shippingAmount = decimalToNumber(refreshed.shippingAmount);
  const vatAmount = decimalToNumber(refreshed.vatAmount);
  const total = decimalToNumber(refreshed.total);

  return (
    <main className="min-h-screen bg-parchment px-4 py-10">
      <section className="mx-auto max-w-5xl rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Presupuesto {refreshed.quoteNumber}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-encre">Traducción jurada</h1>
        <p className="mt-1 text-sm text-sepia">
          Estado: <strong>{QUOTE_STATUS_LABELS[status as QuoteStatus]}</strong> · Validez hasta{" "}
          <strong>{refreshed.validUntil.toLocaleDateString("es-ES")}</strong>
        </p>

        {searchParams?.paid === "1" && (
          <p className="mt-3 rounded-xl border border-cream bg-cream px-3 py-2 text-sm text-bleu">
            Pago recibido correctamente. Te hemos enviado confirmación por email.
          </p>
        )}
        {searchParams?.canceled === "1" && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-cream p-4">
            <h2 className="text-lg font-semibold text-encre">Detalle</h2>
            <p className="text-sm text-sepia">
              Cliente: <strong>Datos protegidos</strong>
            </p>
            <p className="text-sm text-sepia">
              Idiomas: <strong>{refreshed.sourceLang}</strong> → <strong>{refreshed.targetLang}</strong>
            </p>
            <p className="text-sm text-sepia">
              Entrega:{" "}
              <strong>
                {refreshed.deliveryType === "PAPER_SHIP" ? "Papel con envío 24/48h" : "PDF digital firmado"}
              </strong>
            </p>
            {refreshed.holderNames && refreshed.holderNames.trim() && (
              <p className="text-sm text-sepia">
                Titulares: <strong>{refreshed.holderNames}</strong>
              </p>
            )}
            {refreshed.translatorName && (
              <p className="rounded-xl border border-cream bg-cream/60 px-3 py-2 text-sm text-encre">
                🖋 Su traducción la realiza <strong>{refreshed.translatorName}</strong>, traductor/a-intérprete
                jurado/a{refreshed.translatorMaec ? <> nº <strong>{refreshed.translatorMaec}</strong></> : null} nombrado/a
                por el Ministerio de Asuntos Exteriores.{" "}
                <a href="/red-de-traductores-jurados" className="font-semibold text-bleu hover:underline">
                  Conozca nuestra red directa →
                </a>
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-cream">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream text-sepia">
                  <tr>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshed.lines.map((line) => (
                    <tr key={line.id} className="border-t border-cream">
                      <td className="px-3 py-2">
                        {line.description}
                        {line.sourceFileUrl && (
                          <span className="ml-2 whitespace-nowrap text-[11px]">
                            <a
                              href={`/api/q/${params.token}/document?line=${encodeURIComponent(line.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-bleu hover:underline"
                            >
                              ver documento
                            </a>
                            <span className="text-graphite"> · </span>
                            <a
                              href={`/api/q/${params.token}/document?line=${encodeURIComponent(line.id)}&download=1`}
                              className="font-semibold text-bleu hover:underline"
                            >
                              descargar
                            </a>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{decimalToNumber(line.quantity)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(decimalToNumber(line.unitPrice))}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(decimalToNumber(line.lineTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-3 rounded-2xl border border-cream p-4">
            <h2 className="text-base font-semibold text-encre">Resumen</h2>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>Descuento</span>
              <strong>- {formatMoney(discountAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>Envío</span>
              <strong>{formatMoney(shippingAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>IVA</span>
              <strong>{formatMoney(vatAmount)}</strong>
            </p>
            <p className="flex items-center justify-between border-t border-cream pt-2 text-base text-encre">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </p>
            {refreshed.deliveryType === "PAPER_SHIP" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                El envío en papel (12 € + IVA) está incluido en el total.
              </p>
            )}
            <QuotePublicPayButton
              token={params.token}
              isPayable={isPayable}
              quoteNumber={refreshed.quoteNumber}
              totalLabel={formatMoney(total)}
              autoStartCard={searchParams?.pago === "tarjeta"}
              paymentMethods={refreshed.paymentMethods}
            />
          </aside>
        </div>

        {/* Solo en EXPIRED (o llegando desde el email con ?fb): en un presupuesto
            vigente el "¿por qué no siguió?" competiría con el botón de pagar. */}
        {!refreshed.paidAt && (status === "EXPIRED" || (searchParams?.fb && ["SENT", "OPENED", "ACCEPTED"].includes(status))) && (
          <section className="mt-6 rounded-2xl border border-cream p-4">
            <QuoteFeedbackForm
              token={params.token}
              preselect={searchParams?.fb || null}
              alreadySent={refreshed.lostReason != null}
            />
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-cream p-4">
          <h2 className="text-base font-semibold text-encre">PDF del presupuesto</h2>
          {refreshed.pdfUrl ? (
            <div className="mt-3 space-y-3">
              <iframe
                src={refreshed.pdfUrl}
                title="PDF presupuesto"
                className="h-72 w-full rounded-xl border border-cream"
              />
              <a
                href={refreshed.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-bleu/40 px-3 py-2 text-sm font-semibold text-bleu hover:bg-cream"
              >
                Abrir / descargar PDF completo
              </a>
            </div>
          ) : (
            <p className="mt-2 text-sm text-sepia">
              El PDF final se mostrará en cuanto el presupuesto sea confirmado por el equipo.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
