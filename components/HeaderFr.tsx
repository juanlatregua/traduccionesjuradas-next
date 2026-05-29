"use client";

// components/HeaderFr.tsx — Header francés con menú principal completo (traducido).
// Mantiene la navegación de la versión ES; las páginas de destino son por ahora
// las españolas donde aún no hay equivalente francés.

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import SiteSearch from "@/components/SiteSearch";
import type { SearchEntry } from "@/lib/search/match";

const NAV = [
  { href: "/proceso", label: "Comment ça marche" },
  { href: "/precios-traduccion-jurada", label: "Tarifs" },
  { href: "/documentos-oficiales", label: "Documents officiels" },
  { href: "/preguntas-frecuentes", label: "FAQ" },
  { href: "/blog", label: "Blog" },
];

export default function HeaderFr({ searchIndex }: { searchIndex: SearchEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-or bg-parchment/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/traduction-assermentee" className="flex shrink-0 items-center" aria-label="Traductions assermentées — accueil">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-horizontal.svg" alt="Traductions assermentées" className="h-10 w-auto" />
          </Link>

          <div className="ml-1 hidden sm:block">
            <SiteSearch index={searchIndex} lang="fr" />
          </div>

          {/* Menú desktop */}
          <nav className="ml-auto hidden items-center gap-4 text-sm font-medium text-sepia lg:flex" aria-label="Navigation principale">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-bleu">
                {item.label}
              </Link>
            ))}
            <Link href="/area-cliente" className="hover:text-bleu">Espace client</Link>
            <a
              href="https://wa.me/34951333614"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-bleu"
            >
              WhatsApp
            </a>
            <Link
              href="#hero-fr"
              className="rounded-2xl bg-or px-4 py-2 font-semibold text-encre shadow-sm hover:bg-or-dark hover:text-white"
            >
              Devis gratuit
            </Link>
          </nav>

          {/* Toggle móvil */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className="ml-auto inline-flex items-center justify-center rounded-xl border border-cream p-2 text-sepia lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Menú móvil */}
        {open && (
          <nav className="mt-3 flex flex-col gap-2 rounded-2xl border border-cream bg-card p-4 text-sm font-medium text-sepia lg:hidden" aria-label="Navigation principale">
            <div className="pb-2">
              <SiteSearch index={searchIndex} lang="fr" />
            </div>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-bleu" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/area-cliente" className="hover:text-bleu" onClick={() => setOpen(false)}>Espace client</Link>
            <a href="https://wa.me/34951333614" target="_blank" rel="noopener noreferrer" className="hover:text-bleu">WhatsApp</a>
            <Link
              href="#hero-fr"
              className="mt-1 rounded-xl bg-or px-4 py-2 text-center font-semibold text-encre hover:bg-or-dark hover:text-white"
              onClick={() => setOpen(false)}
            >
              Devis gratuit
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
