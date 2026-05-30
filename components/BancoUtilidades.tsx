// components/BancoUtilidades.tsx — "Banco de utilidades" del home, lang-aware.
// Server component: lee lib/i18n/utilidades.ts y se renderiza en el home ES (/)
// y en el FR (/traduction-assermentee) con el lang correspondiente. Adaptar a
// otro idioma = añadir su columna al diccionario, no tocar este componente.

import Link from "next/link";
import type { ReactNode } from "react";
import { UTILIDADES, utilidadesT, type UtilLang } from "@/lib/i18n/utilidades";

const ICONS: Record<string, ReactNode> = {
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M12 11a2 2 0 0 1 2 2c0 1.3-2 1.5-2 3" /><path d="M12 18h.01" />
    </svg>
  ),
  checklist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M9 11l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M12 22s8-4.5 8-11.8A8 8 0 0 0 4 10.2C4 17.5 12 22 12 22z" /><path d="m9 11 2 2 4-4" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M2 7a2 2 0 0 1 2-2h6l2 2h8v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" /><polygon points="14.5 10 13 14 9 15.5 10.5 11.5" />
    </svg>
  ),
  track: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
};

export default function BancoUtilidades({ lang, puertaHref }: { lang: UtilLang; puertaHref?: string }) {
  const t = utilidadesT[lang];
  const puerta = puertaHref ?? (lang === "fr" ? "/traduction-assermentee#hero-fr" : "#hero");

  return (
    <section id="utilidades" className="border-y border-cream bg-card py-14">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
          {t.heading}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-sepia">{t.sub}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UTILIDADES.map((u) => {
            const href = u.href === "PUERTA" ? puerta : u.href;
            return (
              <Link
                key={u.key}
                href={href}
                className="group flex flex-col rounded-2xl border border-cream bg-parchment p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-or hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-or-light/60 text-or-dark">
                  {ICONS[u.icon]}
                </span>
                <h3 className="mt-3 font-baskerville text-lg font-bold text-encre">{u.title[lang]}</h3>
                <p className="mt-1 flex-1 text-sm text-sepia">{u.desc[lang]}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-bleu group-hover:underline">
                  {u.cta[lang]}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-4 w-4 transition group-hover:translate-x-0.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Puente → la jurada */}
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl bg-encre px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="max-w-2xl text-sm text-cream sm:text-base">{t.bridge}</p>
          <Link
            href={puerta}
            className="shrink-0 rounded-xl bg-or px-5 py-2.5 text-sm font-semibold text-encre shadow-sm transition hover:bg-or-dark hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-or focus-visible:ring-offset-2 focus-visible:ring-offset-encre"
          >
            {t.bridgeCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
