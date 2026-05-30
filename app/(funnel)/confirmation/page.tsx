import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrackEvent } from "@/components/TrackEvent";
import { getSessionOrRedirect } from "@/lib/session";
import { recordFunnelStep } from "@/lib/funnel-analytics";
import { funnelT } from "@/lib/i18n/funnel";
import { resolveLocale } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "Confirmación de pago | Traducción jurada",
  robots: { index: false, follow: false },
};

type ConfirmationPageProps = {
  searchParams?: {
    paid?: string;
  };
};

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const session = await getSessionOrRedirect();
  const hasCompletedMarker = searchParams?.paid === "1";

  if (!session.isPaid && !hasCompletedMarker) {
    redirect("/checkout");
  }

  await recordFunnelStep(session, "confirmation");

  const t = funnelT[resolveLocale(session.clientLocale)].confirmation;

  return (
    <section className="rounded-3xl border border-cream bg-card p-5 shadow-sm sm:p-7">
      <TrackEvent name="payment_completed" />
      {session.isPaid ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">{t.paidEyebrow}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-encre sm:text-2xl">
            {t.paidTitle}
          </h2>
          <p className="mt-2 text-sm text-sepia">{t.paidBody(session.reference)}</p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{t.pendingEyebrow}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-encre sm:text-2xl">
            {t.pendingTitle}
          </h2>
          <p className="mt-2 text-sm text-sepia">{t.pendingBody}</p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link href="/checkout" className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream">
          {t.backToCheckout}
        </Link>
        <Link href="/area-cliente" className="rounded-2xl bg-bleu px-4 py-2 font-semibold text-white hover:bg-bleu-dark">
          {t.toClientArea}
        </Link>
      </div>
    </section>
  );
}

