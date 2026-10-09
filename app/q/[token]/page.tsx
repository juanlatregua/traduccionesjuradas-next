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
  calculateEtaDate,
  type QuoteStatus,
} from "@/lib/quotes";
import QuoteProofCta from "@/components/QuoteProofCta";
import { resolvePaymentAccounts } from "@/lib/payment-labels";
import QuotePublicPayButton from "@/components/QuotePublicPayButton";
import QuoteBalancePayButton from "@/components/QuoteBalancePayButton";
import QuoteFeedbackForm from "@/components/QuoteFeedbackForm";
import QuoteDocumentsViewer from "@/components/QuoteDocumentsViewer";
import QuoteJourney from "@/components/QuoteJourney";
import { billingLockState, getSavedQuoteBilling } from "@/lib/quote-billing";
import { billingLocked, COMPLETION_EVENT, completionBlobPrefix, isPendingCompletion, isWhatsappPlaceholder, payPhase, pickBillingPrefill } from "@/lib/q-journey";
import { checkRateLimit } from "@/lib/rate-limit";
import { pickPublicLang, publicDict, statusLabel, localeFor } from "@/lib/quote-public-i18n";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { buildWhatsAppLinkFromText, EMAIL } from "@/lib/contact";

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

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const row = await prisma.quote
    .findUnique({ where: { publicToken: params.token }, select: { pdfLang: true, quoteNumber: true } })
    .catch(() => null);
  const title = row ? `${publicDict(pickPublicLang(row.pdfLang)).pageTitle} ${row.quoteNumber}` : "Presupuesto";
  return { title, robots: { index: false, follow: false } };
}

function langName(code: string, loc: string) {
  try {
    return new Intl.DisplayNames([loc], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}

function resolveIp() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

const LINK_PREVIEW_UA =
  /WhatsApp|TelegramBot|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|Applebot|preview/i;

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

  // Vista previa del enlace (WhatsApp, Telegram…): se registra, pero no es que el cliente lo haya abierto.
  if (ua && LINK_PREVIEW_UA.test(ua)) return;

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
    const rlLang = pickPublicLang(headers().get("accept-language")?.split(",")[0]?.split("-")[0]);
    return (
      <main className="min-h-screen bg-parchment px-4 py-10" lang={rlLang}>
        <section role="alert" className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          {publicDict(rlLang).rateLimited}
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
      customerEmail: true,
      expedienteRef: true,
      customer: {
        select: { fiscalName: true, companyName: true, nif: true, address: true, city: true, postalCode: true, country: true },
      },
      deliveryTerm: true,
      vatRate: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { reference: true, paymentStatus: true, billing: { select: { fiscalName: true, nif: true, address: true, city: true, postalCode: true, country: true, email: true } } },
      },
      // «Pendiente de completar»: el cliente añadió documentos y no se ha reenviado desde entonces.
      stripeEvents: { where: { eventType: COMPLETION_EVENT }, select: { processedAt: true } },
      messageLogs: {
        where: { type: { in: ["PAY_LINK", "RESEND_PAY_LINK"] }, sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { sentAt: true },
      },
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
  const money = (value: number) => new Intl.NumberFormat(loc, { style: "currency", currency: "EUR" }).format(value);
  const phase = payPhase({ paidAt: refreshed.paidAt, paidParam: searchParams?.paid === "1", balance, balancePaidAt: refreshed.balancePaidAt });
  const paid = phase === "paid" || phase === "partial";
  const confirming = phase === "confirming";
  const partial = phase === "partial";
  const vatIncluded = Number(refreshed.vatRate) > 0;
  const etaDate = calculateEtaDate({ from: refreshed.paidAt ?? new Date(), deliveryType: refreshed.deliveryType });
  const etaText = refreshed.deliveryTerm?.trim() || etaDate.toLocaleDateString(loc, { day: "numeric", month: "long" });
  const orderRef = (refreshed.orders.find((o) => o.paymentStatus === "PAID") ?? refreshed.orders[0])?.reference ?? null;
  let trackUrl: string | null = null;
  if (orderRef) {
    try {
      trackUrl = buildSignedOrderUrl(orderRef, "estado");
    } catch (err) {
      console.error("[q/token] track url failed", err);
    }
  }

  // Recorrido guiado (documentos → facturación → pago) mientras el presupuesto se puede pagar.
  const showJourney = isPayable && !paid;
  let journeyProps: Omit<React.ComponentProps<typeof QuoteJourney>, "children"> | null = null;
  if (showJourney) {
    const totalCents = Math.round((total + balance) * 100);
    const saved = await getSavedQuoteBilling(refreshed.id).catch(() => null);
    const customer = isWhatsappPlaceholder(refreshed.customerEmail) ? null : refreshed.customer;
    const base = { saved, orderBilling: refreshed.orders[0]?.billing, customer, clientEmail: refreshed.customerEmail };
    const lock = await billingLockState(refreshed.id).catch(() => null);
    let prefill = pickBillingPrefill(base);
    if (prefill.source === "empty") {
      const analyses = await prisma.documentAnalysis
        .findMany({
          where: {
            OR: [
              ...(refreshed.expedienteRef ? [{ sessionToken: `exp:${refreshed.expedienteRef}` }] : []),
              ...(isWhatsappPlaceholder(refreshed.customerEmail) ? [] : [{ clientEmail: refreshed.customerEmail }]),
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { analysisJson: true },
        })
        .catch(() => []);
      prefill = pickBillingPrefill({ ...base, analyses: analyses.map((a) => a.analysisJson) });
    }
    journeyProps = {
      token: params.token,
      lang,
      docLines,
      uploadPrefix: completionBlobPrefix(refreshed.id),
      initialPending: isPendingCompletion(
        refreshed.stripeEvents.map((e) => e.processedAt),
        refreshed.messageLogs[0]?.sentAt
      ),
      initialBilling: prefill.fields,
      billingSource: prefill.source,
      suggestion: prefill.suggestion,
      billingLocked: !!lock && billingLocked({ paidAt: refreshed.paidAt, ...lock }),
      hasOrder: !!lock?.orderId,
      billingSaved: prefill.source === "saved",
      totalCents,
    };
  }

  const contact = (
    <p className="mt-3 text-sm text-sepia">
        {t.paidContact}{" "}
        <a href={`mailto:${EMAIL}`} className="font-semibold text-bleu underline">{EMAIL}</a>
        {" · "}
        <a
          href={buildWhatsAppLinkFromText(refreshed.quoteNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-bleu underline"
        >
          WhatsApp
        </a>
      </p>
  );

  const payBlocks = (
    <>
        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-cream p-4">
            <h2 className="text-lg font-semibold text-encre">{t.detail}</h2>
            <p className="text-sm text-sepia">
              {t.client}: <strong>{t.clientProtected}</strong>
            </p>
            <p className="text-sm text-sepia">
              {t.languages}: <strong>{langName(refreshed.sourceLang, loc)}</strong> → <strong>{langName(refreshed.targetLang, loc)}</strong>
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
                <span aria-hidden="true">🖋</span> {t.translatorIntro} <strong>{refreshed.translatorName}</strong>, {t.translatorSworn}
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
                          <span className="ml-2 whitespace-nowrap text-xs">
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
                      <td className="px-3 py-2 text-right">{money(decimalToNumber(line.unitPrice))}</td>
                      <td className="px-3 py-2 text-right">{money(decimalToNumber(line.lineTotal))}</td>
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
              <strong>{money(subtotal)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.discount}</span>
              <strong>- {money(discountAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.shipping}</span>
              <strong>{money(shippingAmount)}</strong>
            </p>
            <p className="flex items-center justify-between text-sm text-sepia">
              <span>{t.vat}</span>
              <strong>{money(vatAmount)}</strong>
            </p>
            <p className="flex items-center justify-between border-t border-cream pt-2 text-base text-encre">
              <span>{t.total}</span>
              <strong>{money(total)}</strong>
            </p>
            {refreshed.deliveryType === "PAPER_SHIP" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {t.paperIncluded}
              </p>
            )}
            {balance > 0 && (
              <div id="segundo-pago" className="scroll-mt-4 space-y-2 rounded-lg border border-bleu/30 bg-cream/40 p-3 text-sm text-encre">
                <p className="flex items-center justify-between">
                  <span>
                    {t.secondPayment}
                    {refreshed.balanceDueAt ? ` (${refreshed.balanceDueAt.toLocaleDateString(loc, { day: "numeric", month: "long" })})` : ""}
                  </span>
                  <strong>{money(balance)}</strong>
                </p>
                {refreshed.balancePaidAt ? (
                  <p className="font-semibold text-emerald-700">{t.paidFull}</p>
                ) : refreshed.paidAt ? (
                  <QuoteBalancePayButton token={params.token} amountLabel={money(balance)} lang={lang} />
                ) : (
                  <p className="text-xs text-sepia">{t.secondPayLater}</p>
                )}
              </div>
            )}
            {!paid && (
              <div id="pago" className="scroll-mt-4">
                <QuotePublicPayButton
                  token={params.token}
                  isPayable={isPayable}
                  quoteNumber={refreshed.quoteNumber}
                  totalLabel={money(total)}
                  autoStartCard={searchParams?.pago === "tarjeta"}
                  paymentMethods={refreshed.paymentMethods}
                  lang={lang}
                />
              </div>
            )}
            <p className="text-xs text-graphite">{t.writeYourLang}</p>
          </aside>
        </div>
    </>
  );

  return (
    <main className="min-h-screen bg-parchment px-4 py-10" lang={lang}>
      <section className="mx-auto max-w-5xl rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          {t.quote} {refreshed.quoteNumber}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-encre">{t.swornTranslation}</h1>
        <p className="mt-1 text-sm text-sepia">
          {t.status}: <strong>{partial ? t.firstPaid : paid ? t.paidTitle : statusLabel(status, lang)}</strong> · {t.validUntil}{" "}
          <strong>{refreshed.validUntil.toLocaleDateString(loc)}</strong>
        </p>

        {searchParams?.canceled === "1" && !paid && (
          <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t.canceled}
          </p>
        )}

        {paid ? (
          <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-encre" aria-labelledby="paid-title">
            <h2 id="paid-title" className="text-lg font-semibold text-emerald-900">
              <span aria-hidden="true">✓ </span>
              {partial ? t.firstPaid : t.paidTitle}
            </h2>
            <p role="status" className="mt-1 text-sm text-sepia">{t.paidOk}</p>
            {partial && (
              <p className="mt-1 text-sm font-semibold text-encre">
                {t.remaining}: {money(balance)} ·{" "}
                <a href="#segundo-pago" className="text-bleu underline">{t.goSecond}</a>
              </p>
            )}
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {[t.paidStepReceived, t.paidStepProgress, t.paidStepDelivery].map((label, i) => (
                <li
                  key={label}
                  aria-current={i === 1 ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    i === 0 ? "border-emerald-300 bg-white font-semibold text-emerald-800" : i === 1 ? "border-bleu bg-white font-semibold text-bleu" : "border-cream bg-white text-sepia"
                  }`}
                >
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream text-xs font-bold">
                    {i === 0 ? "✓" : i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-encre">
              {t.paidEta}: <strong>{refreshed.deliveryTerm?.trim() || etaDate.toLocaleDateString(loc, { day: "numeric", month: "long", year: "numeric" })}</strong>
            </p>
            {trackUrl && (
              <a
                href={trackUrl}
                className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-bleu px-4 py-2.5 text-sm font-semibold text-white hover:bg-bleu-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu focus-visible:ring-offset-2"
              >
                {t.followOrder}
              </a>
            )}
            {contact}
          </section>
        ) : (
          <>
          {confirming && (
            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-encre" aria-labelledby="confirming-title">
              <h2 id="confirming-title" className="text-lg font-semibold text-amber-900">{t.confirming}</h2>
              <p role="status" className="mt-1 text-sm text-sepia">{t.confirmingHelp}</p>
              {contact}
              {isPayable && (
                <p className="mt-3 text-sm text-sepia">
                  <a href="#pago" className="font-semibold text-bleu underline">{t.retryPay}</a>
                </p>
              )}
            </section>
          )}
          {isPayable && (
            <section className="mt-4 rounded-2xl border border-bleu/30 bg-cream/50 p-4" aria-label={t.summary}>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-graphite">{balance > 0 ? t.firstPayment : vatIncluded ? t.totalVatIncl : t.total}</p>
                  <p className="text-2xl font-bold text-encre">{money(total)}</p>
                  {balance > 0 && (
                    <p className="text-xs text-sepia">
                      {t.secondPayment}: {money(balance)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-graphite">{t.etaLabel}</p>
                  <p className="text-base font-semibold text-encre">{etaText}</p>
                  {!refreshed.deliveryTerm?.trim() && <p className="text-xs text-sepia">{t.etaFromPayment}</p>}
                </div>
                <a
                  href="#pago"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-bleu px-5 py-3 text-sm font-semibold text-white hover:bg-bleu-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu focus-visible:ring-offset-2"
                >
                  {t.payNowCta}
                </a>
              </div>
              {resolvePaymentAccounts(refreshed.paymentMethods).length > 0 && (
                <QuoteProofCta token={params.token} lang={lang} focus={searchParams?.paso === "justificante"} />
              )}
            </section>
          )}
          </>
        )}

        {journeyProps ? <QuoteJourney {...journeyProps}>{payBlocks}</QuoteJourney> : payBlocks}

        {!journeyProps && fileKeys.length > 0 && (
          <section className="mt-6 rounded-2xl border border-cream p-4">
            <QuoteDocumentsViewer lines={docLines} token={params.token} title={t.yourDocuments} lang={lang} />
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
              lang={lang}
            />
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-cream p-4">
          <h2 className="text-base font-semibold text-encre">{t.pdfTitle}</h2>
          {refreshed.pdfUrl ? (
            <div className="mt-3 space-y-3">
              <iframe
                src={refreshed.pdfUrl}
                title={t.pdfTitle}
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
