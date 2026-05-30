"use client";

// Selector de idioma (ES · FR · EN · DE · PT). Enlaza al home propio de cada
// idioma (LOCALE_HOME). Desplegable accesible: botón + menú con foco visible.
// El idioma activo se marca y no enlaza. Fuente de idiomas: locales.ts.

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Globe, Check } from "lucide-react";
import { useUiLang } from "@/lib/i18n/use-ui-lang";
import { LOCALES, LOCALE_HOME, LOCALE_LABEL, LOCALE_NATIVE } from "@/lib/i18n/locales";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const lang = useUiLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={lang === "fr" ? "Changer de langue" : lang === "en" ? "Change language" : lang === "de" ? "Sprache wechseln" : lang === "pt" ? "Mudar de idioma" : "Cambiar de idioma"}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-or px-2.5 text-[12px] font-bold text-bleu shadow-sm transition-colors hover:bg-or-light/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu"
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        {LOCALE_LABEL[lang]}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-cream bg-card py-1 shadow-lg"
        >
          {LOCALES.map((l) => {
            const active = l === lang;
            return (
              <Link
                key={l}
                href={LOCALE_HOME[l]}
                hrefLang={l}
                role="menuitem"
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-sm transition hover:bg-or-light/50 focus:outline-none focus-visible:bg-or-light/60 ${active ? "font-bold text-encre" : "text-sepia"}`}
              >
                <span>
                  <span className="font-semibold">{LOCALE_LABEL[l]}</span>
                  <span className="ml-2 text-graphite">{LOCALE_NATIVE[l]}</span>
                </span>
                {active && <Check className="h-4 w-4 text-or-dark" aria-hidden="true" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
