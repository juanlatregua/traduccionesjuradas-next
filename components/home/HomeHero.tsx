// components/home/HomeHero.tsx — Portada nueva (maqueta aprobada 22-sep, Juan
// 24-sep): el asistente y la subida juntos encima del pliegue, con la opción de
// expediente grande. Server component, lang-aware (lib/i18n/home-hero.ts); lo
// interactivo vive en AsistentePanel y SubidaPanel. Sustituye al hero de HomeV2
// en las 5 portadas (slot `hero`).

import { Suspense } from "react";
import { Check, MessageCircle, ShieldCheck, Upload } from "lucide-react";
import AsistentePanel from "@/components/home/AsistentePanel";
import SubidaPanelFromParams, { SubidaPanel } from "@/components/home/SubidaPanel";
import WhatsAppCta from "@/components/home/WhatsAppCta";
import Link from "next/link";
import { HOME } from "@/lib/i18n/home";
import { TRANSLATOR_DROPDOWN, t as tx } from "@/lib/i18n/nav";
import { HOME_HERO, CHAT_LANGS } from "@/lib/i18n/home-hero";
import type { Locale } from "@/lib/i18n/locales";

export default function HomeHero({ lang = "es" }: { lang?: Locale }) {
  const t = HOME_HERO;
  // Sin asistente en este idioma, el panel izquierdo ya es WhatsApp: no se repite abajo.
  const hasChat = CHAT_LANGS.includes(lang);

  return (
    <section id={lang === "fr" ? "hero-fr" : "hero"} className="border-b border-cream bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
        {/* Interactuar antes que leer (Juan, 6-oct-2026): título compacto y los dos
            paneles arriba; la explicación (lede) pasa debajo de los paneles. */}
        <div className="mx-auto flex max-w-4xl flex-col gap-1.5 text-center">
          <p className="hidden text-xs font-bold uppercase tracking-[0.12em] text-or-dark sm:block">{t.eyebrow[lang]}</p>
          <h1 className="font-baskerville text-[1.4rem] font-bold leading-tight text-encre sm:text-[1.75rem] lg:text-[2.1rem]">
            {t.h1[lang]}
          </h1>
        </div>

        <ul className="mx-auto mt-3 flex max-w-4xl flex-col gap-1 text-sm font-semibold text-encre sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
          {t.destacados.map((linea) => (
            <li key={linea.es} className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-vert" aria-hidden="true" />
              {linea[lang]}
            </li>
          ))}
        </ul>

        {/* En el móvil los paneles van uno tras otro: las dos acciones, arriba y a la vista. */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
          <a href="#subir" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-or px-3 text-center text-sm font-bold text-encre">
            <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t.accionSubir[lang]}
          </a>
          <a href="#preguntar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-encre px-3 text-center text-sm font-bold text-parchment">
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t.accionPreguntar[lang]}
          </a>
        </div>

        <div className="mt-4 grid items-start gap-4 sm:mt-6 sm:gap-7 lg:grid-cols-2">
          <div id="subir" className="order-1 scroll-mt-24 lg:order-2">
            <Suspense fallback={<SubidaPanel source={null} lang={lang} />}>
              <SubidaPanelFromParams lang={lang} />
            </Suspense>
          </div>
          <div id="preguntar" className="order-2 scroll-mt-24 lg:order-1">
            <AsistentePanel lang={lang} />
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-base leading-relaxed text-graphite sm:mt-8 sm:text-lg">{t.lede[lang]}</p>

        {hasChat && (
          <div className="mt-6 flex items-center justify-center gap-4 sm:mt-9">
            <span className="hidden h-px w-24 bg-or/40 sm:block" aria-hidden="true" />
            <WhatsAppCta lang={lang} />
            <span className="hidden h-px w-24 bg-or/40 sm:block" aria-hidden="true" />
          </div>
        )}

        {/* Enlaces rastreables: el desplegable del header solo existe al abrirlo. */}
        <nav aria-label={tx(TRANSLATOR_DROPDOWN.label, lang)} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold">
          {TRANSLATOR_DROPDOWN.groups[0].items.map((it) => (
            <Link key={it.href} href={it.href} className="text-bleu hover:underline">
              {tx(it.label, lang)}
            </Link>
          ))}
        </nav>

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
