import type { ReactNode } from "react";
import FunnelStepper from "@/components/FunnelStepper";
import { getSessionLocale } from "@/lib/session";
import { funnelT } from "@/lib/i18n/funnel";

export default async function FunnelLayout({ children }: { children: ReactNode }) {
  const t = funnelT[await getSessionLocale()].layout;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <section className="rounded-3xl border border-cream bg-card p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          {t.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-sepia">{t.subtitle}</p>
        <FunnelStepper />
      </section>

      <div className="mt-6">{children}</div>
    </main>
  );
}
