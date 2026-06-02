// components/LectorPage.tsx — Cuerpo lang-aware del lector de requerimientos.
// Server Component: hero + widget (client) + cuerpo AEO (trámites) + FAQ
// visible + disclaimer. Lo usan las 5 páginas localizadas (igual patrón que
// HomeV2). El cuerpo estático va ANTES y DESPUÉS del widget porque es lo que
// las IAs/Google citan (el widget es client e invisible para ellas).

import LectorRequerimientos from "@/components/ia/LectorRequerimientos";
import { lectorT } from "@/lib/i18n/lector";
import { LECTOR_TRAMITES, FAQ_LECTOR } from "@/lib/i18n/lector-schema";
import type { Locale } from "@/lib/i18n/locales";

export default function LectorPage({ lang }: { lang: Locale }) {
  const t = lectorT[lang];
  const tramites = LECTOR_TRAMITES[lang];
  const faq = FAQ_LECTOR[lang];

  return (
    <main className="bg-parchment">
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-6 text-center sm:pt-16">
        <h1 className="text-balance font-baskerville text-3xl font-bold leading-tight text-encre sm:text-4xl">
          {t.h1}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-sepia sm:text-lg">{t.heroSub}</p>
      </section>

      {/* Widget */}
      <section className="px-4 pb-10">
        <LectorRequerimientos lang={lang} />
      </section>

      {/* Cuerpo AEO: trámites frecuentes */}
      <section className="border-t border-cream bg-card py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre">{t.procedureLabel}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {tramites.map((tr) => (
              <div key={tr.title} className="rounded-2xl border border-cream bg-parchment p-5 shadow-sm">
                <h3 className="font-baskerville text-lg font-bold text-encre">{tr.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-sepia">{tr.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ visible (también JSON-LD en la página) */}
      <section className="py-12">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre">FAQ</h2>
          <dl className="mt-8 space-y-5">
            {faq.map((qa) => (
              <div key={qa.question} className="rounded-2xl border border-cream bg-card p-5 shadow-sm">
                <dt className="font-baskerville text-base font-bold text-encre">{qa.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-sepia">{qa.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Disclaimer legal */}
      <section className="border-t border-cream py-8">
        <p className="mx-auto max-w-3xl px-4 text-center text-xs leading-relaxed text-graphite">
          {t.footerDisclaimer}
        </p>
      </section>
    </main>
  );
}
