"use client";

// Barra fina sobre el header: los 5 idiomas a la vista y en su propio idioma (un
// cliente extranjero no tiene que descubrir el selector) y los enlaces secundarios.
// Si el navegador está en otro idioma de la web, lo resalta. Nunca redirige.

import { useEffect, useState } from "react";
import Link from "next/link";
import { LOCALES, LOCALE_HOME, LOCALE_NATIVE, isLocale, type Locale } from "@/lib/i18n/locales";
import { t, NAV_AREA, NAV_FAQ, NAV_UI, NAV_ZONA, type NavLang } from "@/lib/i18n/nav";

export default function SiteUtilityBar({ lang }: { lang: NavLang }) {
  const [sugerido, setSugerido] = useState<Locale | null>(null);

  useEffect(() => {
    const delNavegador = navigator.language.slice(0, 2).toLowerCase();
    setSugerido(isLocale(delNavegador) && delNavegador !== lang ? delNavegador : null);
  }, [lang]);

  return (
    <div className="border-b border-cream bg-card text-[13px] text-sepia">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1">
        <nav aria-label={t(NAV_UI.languagesAria, lang)} className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {LOCALES.map((l) => {
            const activo = l === lang;
            const resaltado = l === sugerido;
            return (
              <Link
                key={l}
                href={LOCALE_HOME[l]}
                hrefLang={l}
                lang={l}
                aria-current={activo ? "true" : undefined}
                className={`inline-flex min-h-8 shrink-0 items-center rounded-md px-2 hover:text-bleu focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu ${
                  activo ? "font-bold text-encre" : resaltado ? "bg-or-light font-semibold text-encre" : ""
                }`}
              >
                {LOCALE_NATIVE[l]}
              </Link>
            );
          })}
        </nav>
        <nav aria-label={t(NAV_UI.secondaryAria, lang)} className="hidden shrink-0 items-center gap-4 lg:flex">
          {[NAV_FAQ, NAV_AREA, NAV_ZONA].map((it) => (
            <Link key={it.href} href={it.href} className="hover:text-bleu">
              {t(it.label, lang)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
