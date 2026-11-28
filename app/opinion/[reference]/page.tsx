import type { Metadata } from "next";
import Image from "next/image";
import { getReviewUrl, greetingName } from "@/lib/delivery-message";
import { reviewLang, reviewPageModel, REVIEW_STRINGS } from "@/lib/order-review";
import { reviewDeps } from "@/lib/order-review-db";
import OpinionClient from "@/components/OpinionClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu opinión — Traducciones Juradas",
  robots: { index: false, follow: false },
};

type Props = {
  params: { reference: string };
  searchParams: { t?: string; r?: string };
};

export default async function OpinionPage({ params, searchParams }: Props) {
  const reference = decodeURIComponent(params.reference || "");
  const token = searchParams.t || "";
  const model = await reviewPageModel(reference, token, searchParams.r, reviewDeps);
  const lang = reviewLang(model.view === "thanks" ? model.order.clientLocale : null);
  const s = REVIEW_STRINGS[lang];
  const googleUrl = getReviewUrl();

  return (
    <main className="bg-parchment px-4 py-10" lang={lang}>
      <div className="mx-auto w-full max-w-md rounded-2xl border border-or/30 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-center gap-2">
          <Image src="/brand/isotipo.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-baskerville text-lg text-encre">Traducciones Juradas</span>
        </div>

        {model.view === "thanks" ? (
          <OpinionClient
            reference={reference}
            token={token}
            stars={model.stars}
            name={greetingName(model.order.clientName, model.order.clientEmail)}
            lang={lang}
            googleUrl={googleUrl}
          />
        ) : (
          <div className="mt-6 text-center">
            <h1 className="font-baskerville text-2xl text-encre">{s.invalidTitle}</h1>
            <p className="mt-3 text-sepia">{s.invalidText}</p>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full rounded-lg bg-encre px-4 py-3 text-center font-semibold text-white hover:bg-bleu-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-or focus-visible:ring-offset-2"
            >
              {s.googleButton}
            </a>
            <p className="mt-2 text-sm text-graphite">{s.googleHint}</p>
          </div>
        )}
      </div>
    </main>
  );
}
