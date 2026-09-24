// components/home/HomeHero.tsx — Portada nueva (maqueta aprobada 22-sep, Juan
// 24-sep): el asistente y la subida juntos encima del pliegue, con la opción de
// expediente grande. Server component, lang-aware (lib/i18n/home-hero.ts); lo
// interactivo vive en AsistentePanel y SubidaPanel. Sustituye al hero de HomeV2
// en las 5 portadas (slot `hero`).

import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import AsistentePanel from "@/components/home/AsistentePanel";
import SubidaPanelFromParams, { SubidaPanel } from "@/components/home/SubidaPanel";
import WhatsAppCta from "@/components/home/WhatsAppCta";
import { HOME } from "@/lib/i18n/home";
import { HOME_HERO, CHAT_LANGS } from "@/lib/i18n/home-hero";
import type { Locale } from "@/lib/i18n/locales";

export default function HomeHero({ lang = "es" }: { lang?: Locale }) {
  const t = HOME_HERO;
  // Sin asistente en este idioma, el panel izquierdo ya es WhatsApp: no se repite abajo.
  const hasChat = CHAT_LANGS.includes(lang);

  return (
    <section id={lang === "fr" ? "hero-fr" : "hero"} className="border-b border-cream bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-14">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 text-center sm:gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-or-dark sm:text-sm">{t.eyebrow[lang]}</p>
          <h1 className="font-baskerville text-[1.7rem] font-bold leading-tight text-encre sm:text-4xl lg:text-[3rem] lg:leading-[1.15]">
            {t.h1[lang]}
          </h1>
          <p className="text-base leading-relaxed text-graphite sm:text-lg lg:text-xl">{t.lede[lang]}</p>
        </div>

        <div className="mt-6 grid items-start gap-4 sm:mt-9 sm:gap-7 lg:grid-cols-2">
          <AsistentePanel lang={lang} />
          <Suspense fallback={<SubidaPanel source={null} lang={lang} />}>
            <SubidaPanelFromParams lang={lang} />
          </Suspense>
        </div>

        {hasChat && (
          <div className="mt-6 flex items-center justify-center gap-4 sm:mt-9">
            <span className="hidden h-px w-24 bg-or/40 sm:block" aria-hidden="true" />
            <WhatsAppCta lang={lang} />
            <span className="hidden h-px w-24 bg-or/40 sm:block" aria-hidden="true" />
          </div>
        )}

        <ul className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-graphite sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8">
          {t.trust.map((line) => (
            <li key={line.es}>{line[lang]}</li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-graphite">
          <span className="text-or-dark" aria-label={t.ratingAria[lang]}>★★★★★</span>
          <b className="text-encre">{HOME.hero.ratingNote[lang]}</b>
          <span className="hidden h-3 w-px bg-bleu/15 sm:inline-block" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-or-dark" aria-hidden="true" />
            {HOME.hero.credit[lang]}
          </span>
        </p>
      </div>
    </section>
  );
}
