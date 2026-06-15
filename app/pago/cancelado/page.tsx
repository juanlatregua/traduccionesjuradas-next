import type { Metadata } from "next";
import Link from "next/link";
import { getOrderPublic } from "@/lib/orders";
import { funnelT } from "@/lib/i18n/funnel";
import { LOCALE_HOME, resolveLocale } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "Pago cancelado | Traducciones Juradas",
  description: "Has cancelado el pago. Puedes retomarlo cuando quieras.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PagoCanceladoPage({
  searchParams,
}: {
  searchParams?: { ref?: string | string[] };
}) {
  const reference = Array.isArray(searchParams?.ref) ? searchParams?.ref[0] : searchParams?.ref;

  const order = reference
    ? await getOrderPublic(reference).catch(() => null)
    : null;

  // El idioma sigue al cliente, igual que en /pago/exito.
  const lang = resolveLocale(order?.clientLocale);
  const t = funnelT[lang].cancelled;

  return (
    <main lang={lang} className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-amber-200 bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          {t.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-3 text-sm text-sepia">{t.body}</p>
        {reference && (
          <p className="mt-3 text-xs text-graphite">
            {t.refLabel} <span className="font-mono">{reference}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {reference ? (
            <Link
              href={`/area-cliente/pedido/${reference}/pagar`}
              className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
            >
              {t.retry}
            </Link>
          ) : (
            <Link
              href={LOCALE_HOME[lang]}
              className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
            >
              {t.restart}
            </Link>
          )}
          <Link href={LOCALE_HOME[lang]} className="font-semibold text-bleu underline-offset-2 hover:underline">
            {t.orQuote}
          </Link>
        </div>
      </section>
    </main>
  );
}
