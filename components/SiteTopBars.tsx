"use client";

// components/SiteTopBars.tsx — Barras bajo el header. ES: TrustStrip + promo
// Regularización 2026. FR: barra de confianza francesa (sin la promo española).

import Link from "next/link";
import { TrustStrip } from "@/components/TrustStrip";
import { useUiLang } from "@/lib/i18n/use-ui-lang";

export default function SiteTopBars() {
  const lang = useUiLang();

  if (lang === "fr") {
    return (
      <div className="border-b border-bleu/15 bg-cream/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-2 text-center text-xs text-graphite sm:text-sm">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-or" />Traducteur assermenté MAEC nº 3850</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-vert" />Prix fixe immédiat</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-bleu" />Livraison 24-72 h</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <TrustStrip />
      <div className="border-b border-bleu/20 bg-bleu/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs text-encre sm:text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-bleu">
            <span className="inline-block h-2 w-2 rounded-full bg-bleu" />
            Regularización extraordinaria 2026
          </span>
          <span className="text-sepia">
            Plazo improrrogable <strong>30-jun-2026</strong> · 25 €/doc · entrega 24h
          </span>
          <Link href="/regularizacion-2026" className="font-semibold text-bleu underline-offset-2 hover:underline">
            Ver guía →
          </Link>
        </div>
      </div>
    </>
  );
}
