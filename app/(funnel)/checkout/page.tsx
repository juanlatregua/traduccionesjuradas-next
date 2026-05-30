import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import CheckoutPaymentActions from "@/components/funnel/CheckoutPaymentActions";
import { TrackEvent } from "@/components/TrackEvent";
import { authOptions } from "@/lib/auth";
import { getSessionOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordFunnelStep } from "@/lib/funnel-analytics";
import { PURPOSE_REGULARIZACION_2026 } from "@/lib/session-pricing";
import { funnelT, type FunnelLang } from "@/lib/i18n/funnel";
import { resolveLocale } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "Pago seguro | Traducción jurada",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const session = await getSessionOrRedirect("CHECKOUT");
  if (session.docs.length < 1) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { step: "UPLOAD" },
    });
    redirect("/upload?reason=missing_doc");
  }
  if (session.totalCents <= 0) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: { step: "REVIEW" },
    });
    redirect("/review");
  }

  await recordFunnelStep(session, "checkout");

  const auth = await getServerSession(authOptions);
  const authEmail = auth?.user?.email?.trim().toLowerCase() || null;
  if (authEmail && (session.authState !== "AUTHENTICATED" || session.userId !== authEmail)) {
    await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        authState: "AUTHENTICATED",
        userId: authEmail,
      },
    });
  }

  const isRegularizacion2026 = session.purpose === PURPOSE_REGULARIZACION_2026;
  const lang: FunnelLang = resolveLocale(session.clientLocale);
  const t = funnelT[lang].checkout;

  return (
    <>
      <TrackEvent name="checkout_started" />
      {isRegularizacion2026 && (
        <div className="mb-4 rounded-2xl border border-bleu/30 bg-bleu/5 p-4 text-sm text-encre">
          <p className="font-semibold text-bleu">{t.regularizacionTitle}</p>
          <p className="mt-1 text-sepia">{t.regularizacionBody}</p>
        </div>
      )}
      <CheckoutPaymentActions
        reference={session.reference}
        totalCents={session.totalCents}
        currency={session.currency}
        authState={authEmail ? "AUTHENTICATED" : session.authState}
        lang={lang}
      />
    </>
  );
}
