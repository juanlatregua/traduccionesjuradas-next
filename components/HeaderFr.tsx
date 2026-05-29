"use client";

// components/HeaderFr.tsx — Marco superior francés (compacto) para las rutas FR.
// Un visitante francés ve un header limpio en français, no el megamenú español.

import Link from "next/link";
import SiteSearch from "@/components/SiteSearch";
import type { SearchEntry } from "@/lib/search/match";

export default function HeaderFr({ searchIndex }: { searchIndex: SearchEntry[] }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-or bg-parchment/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/traduction-assermentee" className="flex shrink-0 items-center" aria-label="Traductions assermentées — accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal.svg" alt="Traductions assermentées" className="h-10 w-auto" />
        </Link>

        <div className="ml-2 hidden sm:block">
          <SiteSearch index={searchIndex} lang="fr" />
        </div>

        <nav className="ml-auto flex items-center gap-2 text-sm font-semibold">
          <a
            href="https://wa.me/34951333614"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center rounded-xl border border-cream px-3 py-2 text-sepia hover:text-bleu sm:inline-flex"
          >
            WhatsApp
          </a>
          <Link
            href="/area-cliente"
            className="rounded-xl border border-cream px-3 py-2 text-sepia hover:text-bleu"
          >
            Espace client
          </Link>
          <a
            href="#hero-fr"
            className="rounded-2xl bg-or px-4 py-2 text-encre shadow-sm hover:bg-or-dark hover:text-white"
          >
            Devis gratuit
          </a>
        </nav>
      </div>
    </header>
  );
}
