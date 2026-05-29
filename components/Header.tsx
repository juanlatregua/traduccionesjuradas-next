"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SiteSearch from "@/components/SiteSearch";
import HeaderFr from "@/components/HeaderFr";
import { useUiLang } from "@/lib/i18n/use-ui-lang";
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

export function Header({ searchIndex }: { searchIndex: SearchEntry[] }) {
  const uiLang = useUiLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [translatorDropdownOpen, setTranslatorDropdownOpen] = useState(false);
  const [docsDropdownOpen, setDocsDropdownOpen] = useState(false);

  const translatorRef = useRef<HTMLDivElement>(null);
  const docsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on Escape or outside click
  const closeAllDropdowns = useCallback(() => {
    setTranslatorDropdownOpen(false);
    setDocsDropdownOpen(false);
  }, []);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        closeAllDropdowns();
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (translatorRef.current && !translatorRef.current.contains(e.target as Node)) {
        setTranslatorDropdownOpen(false);
      }
      if (docsRef.current && !docsRef.current.contains(e.target as Node)) {
        setDocsDropdownOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeAllDropdowns]);

  const closeMenu = () => {
    setMenuOpen(false);
    closeAllDropdowns();
  };

  if (uiLang === "fr") {
    return <HeaderFr searchIndex={searchIndex} />;
  }

  return (
    <header className="sticky top-0 z-40 overflow-visible border-b-2 border-or bg-parchment/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:flex sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-3 sm:flex sm:flex-1 sm:items-center">
          {/* LOGO */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo />
          </Link>

          {/* BUSCADOR (lupa + ⌘K) */}
          <div className="ml-2 sm:ml-4">
            <SiteSearch index={searchIndex} />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:hidden">
            <Link
              href="/area-cliente"
              aria-label="Área cliente"
              className="inline-flex h-9 items-center rounded-xl border border-cream px-2 text-[11px] font-semibold text-sepia shadow-sm"
            >
              Cliente
            </Link>
            <Link
              href="/zona-traductor"
              aria-label="Zona traductor"
              className="inline-flex h-9 items-center rounded-xl border border-cream px-2 text-[11px] font-semibold text-sepia shadow-sm"
            >
              Traductor
            </Link>
          </div>

          {/* TOGGLE MOBILE */}
          <button
            type="button"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-cream px-3 py-2 text-xs font-semibold text-sepia shadow-sm sm:hidden"
          >
            <span className="relative flex h-4 w-4 flex-col items-center justify-center" aria-hidden="true">
              <span
                className={`absolute block h-[2px] w-4 bg-sepia transition-transform duration-200 ${
                  menuOpen ? "rotate-45" : "-translate-y-[5px]"
                }`}
              />
              <span
                className={`absolute block h-[2px] w-4 bg-sepia transition-opacity duration-200 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute block h-[2px] w-4 bg-sepia transition-transform duration-200 ${
                  menuOpen ? "-rotate-45" : "translate-y-[5px]"
                }`}
              />
            </span>
            {menuOpen ? "Cerrar" : "Menú"}
          </button>
        </div>

        {/* NAV */}
        <nav
          id="primary-navigation"
          className={`mt-3 ${menuOpen ? "flex" : "hidden"} w-full flex-col gap-3 rounded-2xl border border-cream bg-card px-4 py-4 text-sm font-medium text-sepia shadow-lg sm:mt-0 sm:flex sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-sm sm:shadow-none sm:text-sepia`}
        >
          <Link href="/presupuesto-instantaneo" className="sm:hidden font-bold text-or hover:text-or-dark" onClick={closeMenu}>
            Presupuesto instantáneo
          </Link>
          <Link href="/expediente" className="sm:hidden font-semibold text-bleu hover:text-bleu-light" onClick={closeMenu}>
            Subir expediente (4+ docs)
          </Link>
          <Link href="/traductores-jurados" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Idiomas
          </Link>
          <Link href="/documentos-oficiales" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Documentos oficiales
          </Link>
          <Link href="/area-cliente" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Consultar pedido
          </Link>
          <Link href="/area-cliente" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Área cliente
          </Link>
          <Link href="/zona-traductor" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Zona traductor
          </Link>
          <Link href="/preguntas-frecuentes" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Preguntas frecuentes
          </Link>
          <Link href="/blog" className="sm:hidden hover:text-bleu" onClick={closeMenu}>
            Blog
          </Link>

          {/* CÓMO FUNCIONA */}
          <Link href="/proceso" className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            Cómo funciona
          </Link>

          {/* ===== TRADUCTOR JURADO (DESPLEGABLE) ===== */}
          <div className="relative hidden sm:block" ref={translatorRef}>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-bleu focus:outline-none focus-visible:text-bleu"
              aria-haspopup="true"
              aria-expanded={translatorDropdownOpen}
              onClick={() => {
                setTranslatorDropdownOpen((prev) => !prev);
                setDocsDropdownOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTranslatorDropdownOpen((prev) => !prev);
                  setDocsDropdownOpen(false);
                }
              }}
            >
              <span>Traductor jurado</span>
              <span className="text-[10px]">▼</span>
            </button>

            <div
              className={`absolute right-0 top-full w-72 max-h-[60vh] overflow-y-auto rounded-2xl border border-cream bg-card p-3 text-xs text-sepia shadow-lg transition ${
                translatorDropdownOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              {/* Idiomas principales */}
              <p className="mb-2 text-[11px] font-semibold text-graphite">
                Idiomas principales
              </p>

              <div className="space-y-1">
                <Link
                  href="/traductor-jurado-frances"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Traductor jurado de francés
                </Link>
                <Link
                  href="/traductor-jurado-aleman"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Traductor jurado de alemán
                </Link>
                <Link
                  href="/traductor-jurado-ingles"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Traductor jurado de inglés
                </Link>
              </div>

              {/* Otros idiomas */}
              <p className="mt-3 text-[11px] font-semibold text-graphite">
                Otros idiomas
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                <Link
                  href="/traductor-jurado-neerlandes"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Neerlandés
                    </Link>
                    <Link
                      href="/traductor-jurado-italiano"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Italiano
                    </Link>
                    <Link
                      href="/traductor-jurado-portugues"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Portugués
                    </Link>
                    <Link
                      href="/traductor-jurado-rumano"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Rumano
                    </Link>
                    <Link
                      href="/traductor-jurado-catalan"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Catalán
                    </Link>
                    <Link
                      href="/traductor-jurado-sueco"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Sueco
                    </Link>
                    <Link
                      href="/traductor-jurado-noruego"
                      className="rounded-lg px-2 py-1 hover:bg-cream"
                      onClick={closeMenu}
                    >
                      Noruego
                    </Link>
                  </div>
            </div>
          </div>

          {/* ===== DOCUMENTOS OFICIALES (DESPLEGABLE) ===== */}
          <div className="relative hidden sm:block" ref={docsRef}>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-bleu focus:outline-none focus-visible:text-bleu"
              aria-haspopup="true"
              aria-expanded={docsDropdownOpen}
              onClick={() => {
                setDocsDropdownOpen((prev) => !prev);
                setTranslatorDropdownOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDocsDropdownOpen((prev) => !prev);
                  setTranslatorDropdownOpen(false);
                }
              }}
            >
              <span>Documentos oficiales</span>
              <span className="text-[10px]">▼</span>
            </button>

            <div
              className={`absolute left-0 top-full w-72 max-h-[60vh] overflow-y-auto rounded-2xl border border-cream bg-card p-3 text-xs text-sepia shadow-lg transition ${
                docsDropdownOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <p className="mb-2 text-[11px] font-semibold text-graphite">
                Más consultados
              </p>

              <div className="space-y-1">
                <Link
                  href="/documentos-oficiales/certificados-registro-civil"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Certificados del Registro Civil
                </Link>
                <Link
                  href="/documentos-oficiales/antecedentes-penales"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Antecedentes penales
                </Link>
                <Link
                  href="/teletrabajo"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Documentos para teletrabajar en España
                </Link>
                <Link
                  href="/documentos-oficiales/documentos-mercantiles"
                  className="block rounded-lg px-2 py-1 hover:bg-cream"
                  onClick={closeMenu}
                >
                  Documentos mercantiles y empresariales
                </Link>
              </div>

              <p className="mt-3 text-[11px] text-graphite">
                Ver listado completo en{" "}
                <Link
                  href="/documentos-oficiales"
                  className="font-semibold text-bleu-light hover:underline"
                >
                  Documentos oficiales
                </Link>
                .
              </p>
            </div>
          </div>

          <Link href="/preguntas-frecuentes" className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            Preguntas frecuentes
          </Link>

          <Link href="/blog" className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            Blog
          </Link>

          <Link href="/precios-traduccion-jurada" className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            Precios
          </Link>

          <Link href="/area-cliente" className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            Área cliente
          </Link>

          <Link href="/zona-traductor" className="hidden hover:text-bleu sm:inline" onClick={closeMenu}>
            Zona traductor
          </Link>

          {/* CTA EXPEDIENTE (varios documentos) — solo desktop, junto al CTA principal */}
          <Link
            href="/expediente"
            className="hidden rounded-2xl border border-bleu px-4 py-2 text-center text-sm font-semibold text-bleu hover:bg-bleu hover:text-white sm:inline-block"
            onClick={closeMenu}
          >
            Subir expediente
          </Link>

          {/* CTA PRESUPUESTO INSTANTÁNEO */}
          <Link
            href="/presupuesto-instantaneo"
            className="w-full rounded-xl bg-or px-4 py-2 text-center text-sm font-semibold text-encre shadow-sm hover:bg-or-dark hover:text-white sm:w-auto sm:rounded-2xl"
            onClick={closeMenu}
          >
            Presupuesto instantáneo
          </Link>
        </nav>
      </div>
    </header>
  );
}
