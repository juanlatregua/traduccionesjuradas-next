// components/HomeV2.tsx — Home "banco de utilidades" (mockup aprobado), lang-aware.
// Server component que renderiza el home ES (/) y FR (/traduction-assermentee)
// desde lib/i18n/home.ts. Reusa PuertaClient (la puerta real), BancoUtilidades,
// SelloMinisterio y el catálogo de nav.ts. Adaptar a otro idioma = diccionario.

import Link from "next/link";
import { ShieldCheck, Check, ArrowRight } from "lucide-react";
import PuertaClient from "@/app/presupuesto-instantaneo/PuertaClient";
import BancoUtilidades from "@/components/BancoUtilidades";
import { SelloMinisterio } from "@/components/SelloMinisterio";
import { HOME, type HomeLang } from "@/lib/i18n/home";
import { TRANSLATOR_DROPDOWN, DOCS_DROPDOWN } from "@/lib/i18n/nav";

export default function HomeV2({ lang }: { lang: HomeLang }) {
  const h = HOME;
  const heroId = lang === "fr" ? "hero-fr" : "hero";
  const idiomas = TRANSLATOR_DROPDOWN.groups.flatMap((g) => g.items);
  const docs = DOCS_DROPDOWN.groups.flatMap((g) => g.items);

  return (
    <>
      {/* ───── HERO: pitch + puerta (2 columnas) ───── */}
      <section id={heroId} className="border-b border-cream bg-parchment">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.04fr_.96fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-or px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-encre">
                {h.hero.eyebrow[lang]}
              </span>
              <h1 className="mt-4 font-baskerville text-3xl font-bold leading-tight tracking-tight text-encre sm:text-4xl lg:text-[2.9rem]">
                {h.hero.h1pre[lang]} <em className="not-italic text-or-dark">{h.hero.h1em[lang]}</em>.
              </h1>
              <p className="mt-4 max-w-md text-base text-graphite sm:text-lg">{h.hero.lede[lang]}</p>
              <ul className="mt-6 grid gap-3">
                {h.hero.promise.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px]">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-or-light/60 text-or-dark">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span><b className="text-encre">{p.b[lang]}</b> {p.t[lang]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-graphite">
                <span className="text-or-dark" aria-label="4,8/5">★★★★★</span>
                <span><b className="text-encre">{h.hero.ratingNote[lang]}</b></span>
                <span className="hidden h-4 w-px bg-bleu/15 sm:block" aria-hidden="true" />
                <span>{h.hero.priceLine[lang]}</span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-graphite">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-or-dark" aria-hidden="true" />
                <span>{h.hero.credit[lang]}</span>
              </p>
            </div>

            <div className="lg:pt-2">
              <PuertaClient purpose={null} lang={lang} />
            </div>
          </div>
        </div>
      </section>

      {/* ───── Banco de utilidades ───── */}
      <BancoUtilidades lang={lang} />

      {/* ───── Catálogo: idiomas + documentos ───── */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-or-dark">{h.catalog.kicker[lang]}</p>
            <h2 className="mt-2 font-baskerville text-2xl font-bold text-encre sm:text-3xl">{h.catalog.h2[lang]}</h2>
            <p className="mt-2 text-sm text-sepia">{h.catalog.sub[lang]}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-cream bg-card p-6 shadow-sm">
              <h3 className="font-baskerville text-lg font-bold text-encre">{h.catalog.idiomas[lang]}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {idiomas.map((it) => (
                  <Link key={it.href} href={it.href} className="rounded-lg border border-bleu/12 bg-parchment px-3 py-2 text-sm font-medium text-encre transition hover:border-or hover:bg-or-light/50">
                    {it.label[lang]}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-sm"><Link href="/traductores-jurados" className="font-semibold text-bleu-light hover:underline">{h.catalog.idiomasMore[lang]}</Link></p>
            </div>
            <div className="rounded-2xl border border-cream bg-card p-6 shadow-sm">
              <h3 className="font-baskerville text-lg font-bold text-encre">{h.catalog.documentos[lang]}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {docs.map((it) => (
                  <Link key={it.href} href={it.href} className="rounded-lg border border-bleu/12 bg-parchment px-3 py-2 text-sm font-medium text-encre transition hover:border-or hover:bg-or-light/50">
                    {it.label[lang]}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-sm"><Link href="/documentos-oficiales" className="font-semibold text-bleu-light hover:underline">{h.catalog.docsMore[lang]}</Link></p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Founder / autoridad ───── */}
      <section className="bg-cream py-14">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid items-center gap-8 rounded-3xl border border-cream bg-card p-8 shadow-sm sm:grid-cols-[auto_1fr]">
            <div className="mx-auto h-32 w-32 sm:mx-0">
              <SelloMinisterio className="!h-32 !w-32" />
            </div>
            <div>
              <p className="font-baskerville text-xl italic leading-relaxed text-encre sm:text-2xl">“{h.founder.quote[lang]}”</p>
              <p className="mt-3 text-sm text-graphite">{h.founder.role[lang]}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Reseñas ───── */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-9 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-or-dark">{h.reviews.kicker[lang]}</p>
            <h2 className="mt-2 font-baskerville text-2xl font-bold text-encre sm:text-3xl">{h.reviews.h2[lang]}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {h.reviews.items.map((r, i) => (
              <div key={i} className="rounded-2xl border border-cream bg-card p-6 shadow-sm">
                <div className="text-or-dark" aria-label="5/5">★★★★★</div>
                <p className="mt-3 text-[15px] text-sepia">“{r.text[lang]}”</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-or-light/60 font-baskerville font-bold text-or-dark" aria-hidden="true">{r.who.charAt(0)}</span>
                  <span className="text-sm"><b className="block text-encre">{r.who}</b><span className="text-graphite">{r.date[lang]}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Guías (AEO) ───── */}
      <section className="bg-cream py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-or-dark">{h.guides.kicker[lang]}</p>
            <h2 className="mt-2 font-baskerville text-2xl font-bold text-encre sm:text-3xl">{h.guides.h2[lang]}</h2>
            <p className="mt-2 text-sm text-sepia">{h.guides.sub[lang]}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {h.guides.items.map((g) => (
              <Link key={g.href} href={g.href} className="group flex flex-col rounded-2xl border border-cream bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-or hover:shadow-md">
                <h3 className="font-baskerville text-lg font-bold text-encre">{g.title[lang]}</h3>
                <p className="mt-1 flex-1 text-sm text-sepia">{g.desc[lang]}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-bleu group-hover:underline">
                  {h.guides.read[lang]}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-7 text-center">
            <Link href="/blog" className="inline-flex rounded-xl border border-bleu/25 px-5 py-2.5 text-sm font-semibold text-bleu transition hover:bg-bleu hover:text-white">
              {h.guides.more[lang]}
            </Link>
          </p>
        </div>
      </section>

      {/* ───── CTA final ───── */}
      <section className="bg-encre py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-baskerville text-2xl font-bold text-white sm:text-3xl">{h.finalCta.h2[lang]}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[17px] text-cream">{h.finalCta.p[lang]}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={`#${heroId}`} className="rounded-xl bg-or px-5 py-3 text-sm font-semibold text-encre shadow-sm transition hover:bg-or-dark hover:text-white">{h.finalCta.primary[lang]}</a>
            <a href="#utilidades" className="rounded-xl border border-white/35 px-5 py-3 text-sm font-semibold text-cream transition hover:bg-white/10">{h.finalCta.secondary[lang]}</a>
          </div>
          <p className="mt-5 text-xs text-cream/70">{h.finalCta.micro[lang]}</p>
        </div>
      </section>
    </>
  );
}
