import type { Metadata } from "next";
import Link from "next/link";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";
import { HOME_FAQ, HOME_HOWTO } from "@/lib/i18n/home-schema";
import { LOCALE_ABS, HREFLANG_ALTERNATES, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "Traduction assermentée français-espagnol en 60 secondes",
  description:
    "Traduction assermentée officielle (traducteur assermenté MAEC n° 3850). Déposez votre document, recevez prix et délai immédiatement, payez en ligne. Spécialiste français ↔ espagnol.",
  alternates: { canonical: LOCALE_ABS.fr, languages: HREFLANG_ALTERNATES },
  openGraph: {
    title: "Traduction assermentée français-espagnol",
    description:
      "Prix fermé et délai immédiats. Traducteur assermenté officiel (MAEC n° 3850) pour vos démarches en Espagne et en France.",
    locale: "fr_FR",
    url: LOCALE_ABS.fr,
  },
};

export default function TraductionAssermenteePage() {
  return (
    <div lang="fr" className="min-h-screen bg-parchment">
      <SchemaBreadcrumbs id="breadcrumbs-home-fr" items={[{ name: LOCALE_HOME_LABEL.fr, url: LOCALE_ABS.fr }]} />
      <SchemaPerson id="schema-person-home-fr" />
      <SchemaFAQ items={HOME_FAQ.fr} id="schema-faq-home-fr" />
      <SchemaHowTo id="schema-howto-home-fr" name={HOME_HOWTO.fr.name} description={HOME_HOWTO.fr.description} steps={HOME_HOWTO.fr.steps} />

      {/* Home v2 "banque d'utilités" en français (mismo componente que el ES) */}
      <HomeV2 lang="fr" />

      {/* Cas fréquents — contenido FR-nativo (guías propias en /fr/*) */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            Cas fréquents des clients français
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/fr/acheter-bien-immobilier-espagne" className="group rounded-2xl border border-cream bg-card p-6 shadow-paper transition hover:border-bleu hover:shadow-md">
              <span className="text-2xl" aria-hidden="true">🏠</span>
              <h3 className="mt-3 font-baskerville text-lg font-bold text-encre">Acheter un bien en Espagne</h3>
              <p className="mt-1 text-sm text-sepia">NIE, prêt, notaire : quels documents faire traduire (acte de mariage, revenus, procuration…).</p>
              <p className="mt-3 text-sm font-semibold text-bleu group-hover:underline">Voir le guide →</p>
            </Link>
            <Link href="/fr/declaration-non-resident-espagne" className="group rounded-2xl border border-cream bg-card p-6 shadow-paper transition hover:border-bleu hover:shadow-md">
              <span className="text-2xl" aria-hidden="true">🧾</span>
              <h3 className="mt-3 font-baskerville text-lg font-bold text-encre">Déclaration de non-résident (modèle 210)</h3>
              <p className="mt-1 text-sm text-sepia">IRNR, revenu imputé, location, convention France-Espagne et justificatifs à traduire.</p>
              <p className="mt-3 text-sm font-semibold text-bleu group-hover:underline">Voir le guide →</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
