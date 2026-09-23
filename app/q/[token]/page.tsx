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
import QuoteBalancePayButton from "@/components/QuoteBalancePayButton";
import QuoteFeedbackForm from "@/components/QuoteFeedbackForm";
import QuoteDocumentsViewer from "@/components/QuoteDocumentsViewer";
import { checkRateLimit } from "@/lib/rate-limit";
import { pickPublicLang, publicDict, statusLabel, localeFor } from "@/lib/quote-public-i18n";

type Props = {
  params: { token: string };
  searchParams: {
    paid?: string;
    canceled?: string;
    fb?: string;
    pago?: string;
    paso?: string;
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
      paidAt: true,
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
      if (searchParams?.paso) qs.set("paso", String(searchParams.paso));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      redirect(`https://www.traduccionesjuradas.net/q/${encodeURIComponent(params.token)}${suffix}`);
    }
    notFound();
  }

  if (quote.tokenExpiresAt && quote.tokenExpiresAt < new Date() && quote.status !== "EXPIRED" && !quote.paidAt) {
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
      pdfLang: true,
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
      balanceAmount: true,
      balanceDueAt: true,
      balancePaidAt: true,
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
          pageStart: true,
          pageEnd: true,
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
  const balance = decimalToNumber(refreshed.balanceAmount);
  // Al visor (client component) no viaja la URL del blob: una clave opaca que
  // conserva la extensión para elegir la vista previa. Los ficheros se sirven
  // por /api/q/[token]/document, que saca la URL de la BD.
  const extOf = (u: string) =>
    (u.split(/[?#]/)[0].split("/").pop() || "").match(/\.([a-z0-9]{1,5})$/i)?.[1].toLowerCase() || "bin";
  const fileKeys = Array.from(new Set(refreshed.lines.map((l) => l.sourceFileUrl).filter((u): u is string => !!u)));
  const docLines = refreshed.lines.map((l) => ({
    id: l.id,
    description: l.description,
    pageStart: l.pageStart,
    pageEnd: l.pageEnd,
    sourceFileUrl: l.sourceFileUrl ? `doc-${fileKeys.indexOf(l.sourceFileUrl)}.${extOf(l.sourceFileUrl)}` : null,
  }));

  // Idioma del cliente: el mismo que Juan eligió para el PDF (Quote.pdfLang).
  // Antes esta página salía siempre en español aunque el PDF fuera en inglés.
  const lang = pickPublicLang(refreshed.pdfLang);
  const t = publicDict(lang);
  const loc = localeFor(lang);

  return (
    <main className="min-h-screen bg-parchment px-4 py-10" lang={lang}>
      <section className="mx-auto max-w-5xl rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          {t.quote} {refreshed.quoteNumber}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-encre">{t.swornTranslation}</h1>
        <p className="mt-1 text-sm text-sepia">
          {t.status}: <strong>{statusLabel(status, lang)}</strong> · {t.validUntil}{" "}
          <strong>{refreshed.validUntil.toLocaleDateString(loc)}</strong>
        </p>

        {searchParams?.paid === "1" && (
          <p className="mt-3 rounded-xl border border-cream bg-cream px-3 py-2 text-sm text-bleu">
            {t.paidOk}
          </p>
        )}
        {searchParams?.canceled === "1" && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t.canceled}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-cream p-4">
            <h2 className="text-lg font-semibold text-encre">{t.detail}</h2>
            <p className="text-sm text-sepia">
              {t.client}: <strong>{t.clientProtected}</strong>
            </p>
            <p className="text-sm text-sepia">
              {t.languages}: <strong>{refreshed.sourceLang}</strong> → <strong>{refreshed.targetLang}</strong>
            </p>
            <p className="text-sm text-sepia">
              {t.delivery}:{" "}
              <strong>
                {refreshed.deliveryType === "PAPER_SHIP" ? t.deliveryPaper : t.deliveryDigital}
              </strong>
            </p>
            {refreshed.holderNames && refreshed.holderNames.trim() && (
              <p className="text-sm text-sepia">
                {t.holders}: <strong>{refreshed.holderNames}</strong>
              </p>
            )}
            {refreshed.translatorName && (
              <p className="rounded-xl border border-cream bg-cream/60 px-3 py-2 text-sm text-encre">
                🖋 {t.translatorIntro} <strong>{refreshed.translatorName}</strong>, {t.translatorSworn}
                {refreshed.translatorMaec ? <> {t.translatorNumber} <strong>{refreshed.translatorMaec}</strong></> : null}{" "}
                {t.translatorAppointed}{" "}
                <a href="/red-de-traductores-jurados" className="font-semibold text-bleu hover:underline">
                  {t.ourNetwork}
                </a>
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-cream">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream text-sepia">
                  <tr>
                    <th className="px-3 py-2">{t.colDescription}</th>
                    <th className="px-3 py-2 text-right">{t.colQty}</th>
                    <th className="px-3 py-2 text-right">{t.colPrice}</th>
                    <th className="px-3 py-2 text-right">{t.colTotal}</th>
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
                              {t.viewDocument}
                            </a>
                            <span className="text-graphite"> · </span>
                            <a
                              href={`/api/q/${params.token}/document?line=${encodeURIComponent(line.id)}&download=1`}
                              className="font-semibold text-bleu hover:underline"
                            >
                              {t.download}
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
            <h2 className="text-base font-semibold text-encre">{t.summary}</h2>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.subtotal}</span>
              <strong>{formatMoney(subtotal)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.discount}</span>
              <strong>- {formatMoney(discountAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.shipping}</span>
              <strong>{formatMoney(shippingAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.vat}</span>
              <strong>{formatMoney(vatAmount)}</strong>
            </p>
            <p className="flex items-center justify-between border-t border-cream pt-2 text-base text-encre">
              <span>{t.total}</span>
              <strong>{formatMoney(total)}</strong>
            </p>
            {refreshed.deliveryType === "PAPER_SHIP" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {t.paperIncluded}
              </p>
            )}
            {balance > 0 && (
              <div className="space-y-2 rounded-lg border border-bleu/30 bg-cream/40 p-3 text-sm text-encre">
                <p className="flex items-center justify-between">
                  <span>
                    Segundo pago
                    {refreshed.balanceDueAt ? ` (${refreshed.balanceDueAt.toLocaleDateString("es-ES", { day: "numeric", month: "long" })})` : ""}
                  </span>
                  <strong>{formatMoney(balance)}</strong>
                </p>
                {refreshed.balancePaidAt ? (
                  <p className="font-semibold text-emerald-700">Pagado. Presupuesto pagado en su totalidad.</p>
                ) : refreshed.paidAt ? (
                  <QuoteBalancePayButton token={params.token} amountLabel={formatMoney(balance)} />
                ) : (
                  <p className="text-xs text-sepia">Se paga después del primer pago, con este mismo enlace.</p>
                )}
              </div>
            )}
            <QuotePublicPayButton
              token={params.token}
              isPayable={isPayable}
              quoteNumber={refreshed.quoteNumber}
              totalLabel={formatMoney(total)}
              autoStartCard={searchParams?.pago === "tarjeta"}
              openProof={searchParams?.paso === "justificante"}
              paymentMethods={refreshed.paymentMethods}
              lang={lang}
            />
          </aside>
        </div>

        {fileKeys.length > 0 && (
          <section className="mt-6 rounded-2xl border border-cream p-4">
            <QuoteDocumentsViewer lines={docLines} token={params.token} title={t.yourDocuments} />
          </section>
        )}

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
          <h2 className="text-base font-semibold text-encre">{t.pdfTitle}</h2>
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
                {t.pdfOpen}
              </a>
            </div>
          ) : (
            <p className="mt-2 text-sm text-sepia">
              {t.pdfPending}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
