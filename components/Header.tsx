"use client";

// components/Header.tsx — Header ÚNICO, bilingüe (es|fr). Sustituye al par
// Header/HeaderFr divergente: la navegación vive en lib/i18n/nav.ts y este
// componente la renderiza en el idioma de la ruta (useUiLang). Los desplegables
// (idiomas, documentos) y su a11y (teclado/foco/Escape) son idénticos en ambos.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SiteSearch from "@/components/SiteSearch";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useUiLang } from "@/lib/i18n/use-ui-lang";
import {
  t,
  TRANSLATOR_DROPDOWN,
  DOCS_DROPDOWN,
  NAV_PROCESO,
  NAV_PRECIOS,
  NAV_FAQ,
  NAV_BLOG,
  NAV_AREA,
  NAV_ZONA,
  NAV_EXPEDIENTE,
  NAV_CTA,
  type NavDropdown,
  type NavLang,
} from "@/lib/i18n/nav";
import type { SearchEntry } from "@/lib/search/match";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/brand/isotipo.svg"
        alt="Traducciones Juradas"
        width={40}
        height={40}
        className="h-10 w-10 sm:hidden"
        priority
      />
      <Image
        src="/brand/logo-horizontal.svg"
        alt="Traducciones Juradas"
        width={360}
        height={74}
        className="hidden h-12 w-auto max-w-none sm:block lg:h-14"
        priority
      />
      <div className="leading-tight sm:hidden">
        <span className="block text-sm font-semibold text-sepia">Traducciones Juradas</span>
      </div>
    </div>
  );
}

/** Desplegable de escritorio dirigido por config, bilingüe y accesible. */
function Dropdown({
  dd,
  lang,
  id,
  open,
  onToggle,
  onClose,
}: {
  dd: NavDropdown;
  lang: NavLang;
  id: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative hidden sm:block">
      <button
        ref={btnRef}
        type="button"
        className="flex items-center gap-1 rounded-md px-1 py-1 hover:text-bleu focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
          if (e.key === "Escape") onClose();
        }}
      >
        <span>{t(dd.label, lang)}</span>
        <span className="text-[10px]" aria-hidden="true">▼</span>
      </button>

      {/* Panel: se monta solo al abrir → no deja foco-trampa al estar cerrado */}
      {open && (
        <div
          id={id}
          className={`absolute ${dd.align === "left" ? "left-0" : "right-0"} top-full z-50 mt-1 w-72 max-h-[60vh] overflow-y-auto rounded-2xl border border-cream bg-card p-3 text-xs text-sepia shadow-lg`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
              btnRef.current?.focus();
            }
          }}
        >
          {dd.groups.map((g, gi) => (
            <div key={gi} className={gi > 0 ? "mt-3" : ""}>
              <p className="mb-2 text-[11px] font-semibold text-graphite">{t(g.heading, lang)}</p>
              <div className={g.cols === 2 ? "grid grid-cols-2 gap-1 text-[11px]" : "space-y-1"}>
                {g.items.map((it) => (
                  <Link
                    key={it.href + t(it.label, lang)}
                    href={it.href}
                    className="block rounded-lg px-2 py-1 hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu"
                    onClick={onClose}
                  >
                    {t(it.label, lang)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {dd.foot && (
            <p className="mt-3 text-[11px] text-graphite">
              {t(dd.foot.text, lang)}{" "}
              <Link href={dd.foot.href} className="font-semibold text-bleu-light hover:underline" onClick={onClose}>
                {t(dd.foot.linkLabel, lang)}
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ searchIndex }: { searchIndex: SearchEntry[] }) {
  const lang = useUiLang() as NavLang;
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<null | "translator" | "docs">(null);
  const navRef = useRef<HTMLElement>(null);

  const closeDropdowns = useCallback(() => setOpenDropdown(null), []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    closeDropdowns();
  }, [closeDropdowns]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setOpenDropdown(null);
      }
    }
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const homeHref = lang === "fr" ? "/traduction-assermentee" : "/";
  const ctaHref = NAV_CTA.href[lang];

  // Enlaces simples (desktop): cómo funciona + (dropdowns) + precios/blog/faq
  const simpleAfter = [NAV_PRECIOS, NAV_FAQ, NAV_BLOG, NAV_AREA, NAV_ZONA];
  // Enlaces planos para el menú móvil
  const mobileLinks = [NAV_PROCESO, NAV_PRECIOS, NAV_FAQ, NAV_BLOG, NAV_AREA, NAV_ZONA];

  return (
    <header className="sticky top-0 z-40 overflow-visible border-b-2 border-or bg-parchment/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:flex sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-3 sm:flex sm:flex-1 sm:items-center">
          <Link href={homeHref} className="flex shrink-0 items-center gap-2" aria-label={lang === "fr" ? "Traductions assermentées — accueil" : "Traducciones Juradas — inicio"}>
            <Logo />
          </Link>

          <div className="ml-2 sm:ml-4">
            <SiteSearch index={searchIndex} lang={lang} />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              aria-label={menuOpen ? (lang === "fr" ? "Fermer le menu" : "Cerrar menú") : (lang === "fr" ? "Ouvrir le menu" : "Abrir menú")}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              onClick={() => setMenuOpen((p) => !p)}
              className="inline-flex h-11 min-h-[44px] items-center gap-2 rounded-xl border border-cream px-3 text-xs font-semibold text-sepia shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-bleu"
            >
              {menuOpen ? (lang === "fr" ? "Fermer" : "Cerrar") : (lang === "fr" ? "Menu" : "Menú")}
            </button>
          </div>
        </div>

        <nav
          id="primary-navigation"
          ref={navRef}
          aria-label={lang === "fr" ? "Navigation principale" : "Navegación principal"}
          className={`mt-3 ${menuOpen ? "flex" : "hidden"} w-full flex-col gap-3 rounded-2xl border border-cream bg-card px-4 py-4 text-sm font-medium text-sepia shadow-lg sm:mt-0 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-3 sm:gap-y-1.5 lg:gap-x-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
        >
          {/* CTA + hubs (móvil) */}
          <Link href={ctaHref} className="sm:hidden font-bold text-or hover:text-or-dark" onClick={closeMenu}>
            {t(NAV_CTA.label, lang)}
          </Link>
          <Link href={NAV_EXPEDIENTE.href} className="sm:hidden font-semibold text-bleu hover:text-bleu-light" onClick={closeMenu}>
            {t(NAV_EXPEDIENTE.label, lang)}
          </Link>
          <Link href={TRANSLATOR_DROPDOWN.foot!.href} className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            {t(TRANSLATOR_DROPDOWN.label, lang)}
          </Link>
          <Link href={DOCS_DROPDOWN.foot!.href} className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            {t(DOCS_DROPDOWN.label, lang)}
          </Link>
          {mobileLinks.map((it) => (
            <Link key={"m" + it.href} href={it.href} className="sm:hidden hover:text-bleu" onClick={closeMenu}>
              {t(it.label, lang)}
            </Link>
          ))}

          {/* DESKTOP */}
          <Link href={NAV_PROCESO.href} className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            {t(NAV_PROCESO.label, lang)}
          </Link>

          <Dropdown
            dd={TRANSLATOR_DROPDOWN}
            lang={lang}
            id="dd-translator"
            open={openDropdown === "translator"}
            onToggle={() => setOpenDropdown((p) => (p === "translator" ? null : "translator"))}
            onClose={closeDropdowns}
          />
          <Dropdown
            dd={DOCS_DROPDOWN}
            lang={lang}
            id="dd-docs"
            open={openDropdown === "docs"}
            onToggle={() => setOpenDropdown((p) => (p === "docs" ? null : "docs"))}
            onClose={closeDropdowns}
          />

          {simpleAfter.map((it) => (
            <Link key={"d" + it.href} href={it.href} className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
              {t(it.label, lang)}
            </Link>
          ))}

          <Link
            href={NAV_EXPEDIENTE.href}
            className="hidden rounded-2xl border border-bleu px-4 py-2 text-center text-sm font-semibold text-bleu hover:bg-bleu hover:text-white sm:inline-block"
            onClick={closeMenu}
          >
            {t(NAV_EXPEDIENTE.label, lang)}
          </Link>

          <span className="hidden sm:block">
            <LanguageSwitcher />
          </span>

          <Link
            href={ctaHref}
            className="w-full rounded-xl bg-or px-4 py-2 text-center text-sm font-semibold text-encre shadow-sm hover:bg-or-dark hover:text-white sm:w-auto sm:rounded-2xl"
            onClick={closeMenu}
          >
            {t(NAV_CTA.label, lang)}
          </Link>
        </nav>
      </div>
    </header>
  );
}
