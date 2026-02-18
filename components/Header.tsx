"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500 shadow-md shadow-emerald-500/40">
        <span className="text-xs font-black tracking-tight text-white">
          TJ
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-slate-900">
          TraduccionesJuradas.Net
        </span>
        <span className="text-[11px] text-slate-500">
          Soluciones de Traducción Jurada
        </span>
      </div>
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on escape
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 overflow-visible border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:flex sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-3 sm:block sm:flex-1">
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>

          {/* TOGGLE MOBILE */}
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm sm:hidden"
          >
            <span className="flex flex-col gap-1" aria-hidden="true">
              <span className="block h-[2px] w-4 bg-slate-700" />
              <span className="block h-[2px] w-4 bg-slate-700" />
              <span className="block h-[2px] w-4 bg-slate-700" />
            </span>
            Menú
          </button>
        </div>

        {/* NAV */}
        <nav
          id="primary-navigation"
          className={`mt-3 ${menuOpen ? "flex" : "hidden"} w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-700 shadow-lg sm:mt-0 sm:flex sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-xs sm:shadow-none sm:text-slate-700`}
        >
          {/* CÓMO FUNCIONA */}
          <Link href="/proceso" className="hover:text-emerald-600" onClick={closeMenu}>
            Cómo funciona
          </Link>

          {/* ===== TRADUCTOR JURADO (DESPLEGABLE) ===== */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 hover:text-emerald-600 focus:outline-none focus-visible:text-emerald-600"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span>Traductor jurado</span>
              <span className="text-[10px]">▼</span>
            </button>

            <div className="pointer-events-none absolute right-0 top-full w-72 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              {/* Idiomas principales */}
              <p className="mb-2 text-[11px] font-semibold text-slate-500">
                Idiomas principales
              </p>

              <div className="space-y-1">
                <Link
                  href="/traductor-jurado-frances"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Traductor jurado de francés
                </Link>
                <Link
                  href="/traductor-jurado-aleman"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Traductor jurado de alemán
                </Link>
                <Link
                  href="/traductor-jurado-ingles"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Traductor jurado de inglés
                </Link>
              </div>

              {/* Otros idiomas */}
              <p className="mt-3 text-[11px] font-semibold text-slate-500">
                Otros idiomas
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                <Link
                  href="/traductor-jurado-neerlandes"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                      onClick={closeMenu}
                    >
                      Neerlandés
                    </Link>
                    <Link
                      href="/traductor-jurado-italiano"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                      onClick={closeMenu}
                    >
                      Italiano
                    </Link>
                    <Link
                      href="/traductor-jurado-portugues"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                      onClick={closeMenu}
                    >
                      Portugués
                    </Link>
                    <Link
                      href="/traductor-jurado-catalan"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                      onClick={closeMenu}
                    >
                      Catalán
                    </Link>
                    <Link
                      href="/traductor-jurado-sueco"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                      onClick={closeMenu}
                    >
                      Sueco
                    </Link>
                    <Link
                      href="/traductor-jurado-noruego"
                      className="rounded-lg px-2 py-1 hover:bg-slate-50"
                      onClick={closeMenu}
                    >
                      Noruego
                    </Link>
                  </div>
            </div>
          </div>

          {/* ===== DOCUMENTOS OFICIALES (DESPLEGABLE) ===== */}
          <div className="relative group">
            <Link
              href="/documentos-oficiales"
              className="flex items-center gap-1 hover:text-emerald-600 focus-visible:text-emerald-600"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span>Documentos oficiales</span>
              <span className="text-[10px]">▼</span>
            </Link>

            <div className="pointer-events-none absolute left-0 top-full w-72 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <p className="mb-2 text-[11px] font-semibold text-slate-500">
                Más consultados
              </p>

              <div className="space-y-1">
                <Link
                  href="/documentos-oficiales/certificados-registro-civil"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Certificados del Registro Civil
                </Link>
                <Link
                  href="/documentos-oficiales/antecedentes-penales"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Antecedentes penales
                </Link>
                <Link
                  href="/teletrabajo"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Documentos para teletrabajar en España
                </Link>
                <Link
                  href="/documentos-oficiales/documentos-mercantiles"
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                  onClick={closeMenu}
                >
                  Documentos mercantiles y empresariales
                </Link>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                Ver listado completo en{" "}
                <Link
                  href="/documentos-oficiales"
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Documentos oficiales
                </Link>
                .
              </p>
            </div>
          </div>

          <Link href="/preguntas-frecuentes" className="hover:text-emerald-600" onClick={closeMenu}>
            Preguntas frecuentes
          </Link>

          <Link href="/precios-traduccion-jurada" className="hover:text-emerald-600" onClick={closeMenu}>
            Precios
          </Link>

          <Link href="/area-cliente" className="hover:text-emerald-600" onClick={closeMenu}>
            Area cliente
          </Link>

          <Link href="/zona-traductor" className="hover:text-emerald-600" onClick={closeMenu}>
            Zona traductor
          </Link>

          {/* CTA PRESUPUESTO */}
          <Link
            href="/presupuesto"
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:w-auto sm:rounded-2xl sm:text-xs"
            onClick={closeMenu}
          >
            Solicitar presupuesto
          </Link>
        </nav>
      </div>
    </header>
  );
}
