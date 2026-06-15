import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { getOrderPublic } from "@/lib/orders";
import { funnelT } from "@/lib/i18n/funnel";
import { LOCALE_HOME, resolveLocale } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "Pago confirmado | Traducciones Juradas",
  description: "Pago confirmado correctamente. Te contactamos para iniciar tu traduccion jurada.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PagoExitoPage({
  searchParams,
}: {
  searchParams?: { ref?: string | string[] };
}) {
  const reference = Array.isArray(searchParams?.ref) ? searchParams?.ref[0] : searchParams?.ref;

  const order = reference
    ? await getOrderPublic(reference).catch(() => null)
    : null;

  // El idioma sigue al cliente: leemos el locale capturado en la puerta para
  // que quien pagó en francés no aterrice en español tras Stripe.
  const lang = resolveLocale(order?.clientLocale);
  const t = funnelT[lang].confirmation;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          {t.paidEyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          {t.paidTitle}
        </h1>
        {reference && <p className="mt-3 text-sm text-sepia">{t.paidBody(reference)}</p>}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href="/area-cliente"
            className="rounded-2xl bg-encre px-4 py-2 font-semibold text-white hover:bg-encre"
          >
            {t.toClientArea}
          </Link>
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-bleu px-4 py-2 font-semibold text-white hover:bg-bleu-dark"
          >
            {t.sendDocsEmail}
          </a>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-cream px-4 py-2 font-semibold text-encre hover:bg-cream"
          >
            {t.sendDocsWhatsapp}
          </a>
          <Link href={LOCALE_HOME[lang]} className="font-semibold text-bleu underline-offset-2 hover:underline">
            {t.backHome}
          </Link>
        </div>
      </section>
    </main>
  );
}
