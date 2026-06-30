import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyClientToken } from "@/lib/client-token";
import { getClientPortalData } from "@/lib/client-portal";
import { decimalToNumber } from "@/lib/quotes";
import {
  getAc,
  acIntl,
  getDeliveryStateLabel,
  getQuoteStatusLabel,
} from "@/lib/i18n/area-cliente";

export const metadata: Metadata = {
  title: "Cliente — zona",
  robots: { index: false, follow: false },
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

// Vista de un cliente final para SU INTERMEDIARIO (solo consulta). El intermediario
// se autentica igual que en /area-cliente (Google o magic-link). GATE anti-IDOR:
// el cliente destino DEBE colgar del intermediario autenticado (intermediaryId), si
// no, notFound(). Reusa getClientPortalData en modo lectura.
export default async function IntermediaryClientView({
  params,
  searchParams,
}: {
  params: { email: string };
  searchParams?: { email?: string; token?: string };
}) {
  // App Router ya decodifica el segmento; el decode extra es defensivo y va en
  // try/catch para no romper con un '%' literal en el email.
  let targetEmail: string;
  try {
    targetEmail = decodeURIComponent(params.email);
  } catch {
    targetEmail = params.email;
  }
  targetEmail = targetEmail.trim().toLowerCase();

  const session = await getServerSession(authOptions);
  const tokenEmail = (searchParams?.email || "").trim().toLowerCase();
  const token = (searchParams?.token || "").trim();

  let intermediaryEmail: string | null = null;
  if (session?.user?.email) intermediaryEmail = session.user.email.trim().toLowerCase();
  else if (tokenEmail && token && verifyClientToken(tokenEmail, token)) intermediaryEmail = tokenEmail;
  if (!intermediaryEmail) notFound();

  const ci = (v: string) => ({ equals: v, mode: "insensitive" as const });
  const intermediary = await prisma.customer.findFirst({
    where: { email: ci(intermediaryEmail) },
    select: { id: true },
  });
  if (!intermediary) notFound();

  const target = await prisma.customer.findFirst({
    where: { email: ci(targetEmail) },
    select: { id: true, name: true, companyName: true, email: true, intermediaryId: true },
  });
  // GATE: solo si el cliente destino cuelga de este intermediario.
  if (!target || target.intermediaryId !== intermediary.id) notFound();

  const data = await getClientPortalData(target.email);
  const orders = data?.orders || [];
  const quotes = data?.quotes || [];
  const invoices = data?.invoices || [];

  // El idioma de la vista lo marca el cliente final: lo tomamos de su pedido más
  // reciente (Order.clientLocale; orders viene ordenado por createdAt desc).
  const lang = orders[0]?.clientLocale;
  const t = getAc(lang).subcliente;
  const tc = getAc(lang).common;
  const intl = acIntl(lang);

  const backHref =
    session || !token
      ? "/area-cliente"
      : `/area-cliente?email=${encodeURIComponent(intermediaryEmail)}&token=${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link href={backHref} className="text-sm font-semibold text-bleu hover:underline">
        {t.back}
      </Link>

      <section className="mt-3 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">{t.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          {target.companyName || target.name || target.email}
        </h1>
        <p className="mt-1 text-sm text-sepia">{target.email} · {t.readOnly}</p>
      </section>

      {/* Pedidos + descargas */}
      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">{t.orders}</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-sepia">{t.noOrders}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-cream">
            <table className="w-full text-left text-sm">
              <thead className="bg-parchment text-xs uppercase tracking-wide text-graphite">
                <tr>
                  <th className="px-4 py-3">{tc.reference}</th>
                  <th className="px-4 py-3">{tc.date}</th>
                  <th className="px-4 py-3">{tc.description}</th>
                  <th className="px-4 py-3">{tc.amount}</th>
                  <th className="px-4 py-3">{tc.status}</th>
                  <th className="px-4 py-3">{tc.download}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const files = Array.isArray(o.deliveryFilesJson)
                    ? (o.deliveryFilesJson as Array<{ url?: string; filename?: string | null }>).filter((f) => f && f.url)
                    : o.translatedFileUrl
                      ? [{ url: o.translatedFileUrl, filename: o.finalFilename }]
                      : [];
                  return (
                    <tr key={o.reference} className="border-t border-cream align-top">
                      <td className="px-4 py-3 font-mono text-xs text-sepia">{o.reference}</td>
                      <td className="px-4 py-3 text-sepia">{o.createdAt.toLocaleDateString(intl, { timeZone: "Europe/Madrid" })}</td>
                      <td className="px-4 py-3 text-sepia">{o.title}</td>
                      <td className="px-4 py-3 text-sepia">{eur(o.amountCents)}</td>
                      <td className="px-4 py-3 text-sepia">{getDeliveryStateLabel(o.deliveryState, lang)}</td>
                      <td className="px-4 py-3">
                        {files.length === 0 ? (
                          <span className="text-xs text-graphite">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {files.map((f, i) => (
                              <a key={f.url} href={f.url as string} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-bleu hover:underline">
                                ⬇ {f.filename || (files.length > 1 ? tc.translationN(i + 1) : tc.download1)}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Presupuestos */}
      {quotes.length > 0 && (
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">{t.quotes}</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-cream">
            <table className="w-full text-left text-sm">
              <thead className="bg-parchment text-xs uppercase tracking-wide text-graphite">
                <tr>
                  <th className="px-4 py-3">{tc.invoiceNumberShort}</th>
                  <th className="px-4 py-3">{tc.languages}</th>
                  <th className="px-4 py-3">{tc.total}</th>
                  <th className="px-4 py-3">{tc.status}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-cream">
                    <td className="px-4 py-3 font-mono text-xs text-sepia">{q.quoteNumber}</td>
                    <td className="px-4 py-3 text-sepia">{q.sourceLang} → {q.targetLang}</td>
                    <td className="px-4 py-3 text-sepia">{decimalToNumber(q.total).toFixed(2)} EUR</td>
                    <td className="px-4 py-3 text-sepia">{getQuoteStatusLabel(q.paidAt ? "PAID" : q.status, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Facturas */}
      {invoices.length > 0 && (
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">{t.invoices}</h2>
          <ul className="mt-3 space-y-2 text-sm text-sepia">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream bg-parchment px-4 py-2">
                <span>
                  <span className="font-semibold text-encre">{inv.number}</span>
                  {inv.issuedAt ? ` · ${inv.issuedAt.toLocaleDateString(intl, { timeZone: "Europe/Madrid" })}` : ""}
                </span>
                <span className="font-semibold text-encre">
                  {eur(inv.totalCents)} {inv.paidAt ? getAc(lang).index.invoicePaid : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
