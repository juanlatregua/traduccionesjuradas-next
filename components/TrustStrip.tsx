import { GOOGLE_RATING } from "@/lib/google-rating";
import type { Locale } from "@/lib/i18n/locales";

const T: Record<Locale, { credential: string; reviews: string; price: string }> = {
  es: { credential: "Traductor jurado N.º 3850 · MAEC", reviews: "reseñas Google", price: "Precio cerrado antes de pagar" },
  fr: { credential: "Traducteur assermenté n° 3850 · MAEC", reviews: "avis Google", price: "Prix ferme avant paiement" },
  en: { credential: "Sworn translators authorised by the MAEC", reviews: "Google reviews", price: "Fixed quote before you pay" },
  de: { credential: "Vom MAEC ermächtigte Übersetzer", reviews: "Google-Bewertungen", price: "Festpreis vor der Zahlung" },
  pt: { credential: "Tradutores jurados habilitados pelo MAEC", reviews: "avaliações no Google", price: "Preço fechado antes de pagar" },
};

export function TrustStrip({ lang = "es" }: { lang?: Locale }) {
  const t = T[lang];
  return (
    <div className="bg-bleu text-cream/90 text-xs sm:text-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center sm:gap-4">
        <span className="hidden sm:inline">{t.credential}</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          {GOOGLE_RATING.stars.toString().replace(".", ",")} <span className="text-or" aria-hidden="true">★</span> {GOOGLE_RATING.reviews} {t.reviews}
        </span>
        <span aria-hidden="true">·</span>
        <span>{t.price}</span>
      </div>
    </div>
  );
}
