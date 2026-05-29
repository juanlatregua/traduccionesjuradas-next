import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Déclaration de non-résident en Espagne (modèle 210 / IRNR)",
  description:
    "Propriétaire français d’un bien en Espagne ? Vous êtes redevable de l’IRNR (modèle 210). Taux, revenu imputé, location, convention France-Espagne et documents à traduire. Devis immédiatement.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/fr/declaration-non-resident-espagne" },
  openGraph: { locale: "fr_FR", title: "Déclaration de non-résident en Espagne (modèle 210)" },
};

export default function DeclarationNonResidentPage() {
  return (
    <main className="min-h-screen bg-parchment">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-bleu">Propriétaires non-résidents</p>
        <h1 className="mt-2 font-baskerville text-3xl font-bold text-encre sm:text-4xl">
          Déclaration de non-résident en Espagne (modèle 210 / IRNR)
        </h1>
        <p className="mt-4 text-lg text-sepia">
          Si vous possédez un bien en Espagne sans y résider fiscalement, vous êtes redevable de l’
          <strong>impôt sur le revenu des non-résidents (IRNR)</strong>, déclaré avec le <strong>modèle 210</strong>.
          Voici l’essentiel et les documents qui doivent parfois être traduits (traduction assermentée).
        </p>

        <h2 className="mt-10 font-baskerville text-2xl text-encre">Bien non loué : revenu imputé</h2>
        <p className="mt-3 text-sepia">
          Même sans le louer, l’Espagne impute un revenu : <strong>2 % de la valeur cadastrale</strong>
          (<strong>1,1 %</strong> si elle a été révisée au cours des 10 dernières années), imposé à <strong>19 %</strong>
          pour les résidents de l’UE/EEE (dont la France). À déclarer du <strong>1ᵉʳ janvier au 31 décembre de
          l’année suivante</strong> (les revenus 2025 se déclarent en 2026).
        </p>

        <h2 className="mt-8 font-baskerville text-2xl text-encre">Bien loué : revenus locatifs</h2>
        <p className="mt-3 text-sepia">
          Les loyers sont imposés à <strong>19 %</strong> (UE/EEE). Avantage des résidents UE/EEE : vous pouvez
          <strong> déduire les charges</strong> liées au bien (IBI, charges de copropriété, assurance, intérêts
          d’emprunt, amortissement…), ce qui réduit fortement la base.
        </p>

        <h2 className="mt-8 font-baskerville text-2xl text-encre">Et en France ? La double imposition</h2>
        <p className="mt-3 text-sepia">
          La <strong>convention fiscale France-Espagne</strong> évite que vous soyez imposé deux fois : vous
          déclarez aussi ces revenus en France, qui applique un mécanisme d’élimination de la double imposition.
          Pour cela, des justificatifs espagnols doivent souvent être présentés en français.
        </p>

        <h2 className="mt-8 font-baskerville text-2xl text-encre">Documents à faire traduire</h2>
        <ul className="mt-3 space-y-3">
          <li className="rounded-xl border border-cream bg-card p-4 shadow-paper">
            <p className="font-semibold text-encre">Espagnol → français</p>
            <p className="mt-1 text-sm text-sepia">Justificatifs d’impôt payé en Espagne (modèle 210), reçus, attestations — pour votre déclaration française.</p>
          </li>
          <li className="rounded-xl border border-cream bg-card p-4 shadow-paper">
            <p className="font-semibold text-encre">Français → espagnol</p>
            <p className="mt-1 text-sm text-sepia">Documents français demandés par votre conseiller ou l’administration espagnole.</p>
          </li>
        </ul>

        <div className="mt-8 rounded-xl border border-or/40 bg-or/[0.06] p-5">
          <p className="text-sm text-encre">
            ⚠ <strong>Avertissement.</strong> Ces informations sont générales et peuvent évoluer. Elles ne
            constituent pas un conseil fiscal. Vérifiez votre situation auprès d’un conseiller et des sources
            officielles avant toute déclaration.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border-2 border-bleu/30 bg-gradient-to-br from-bleu/[0.08] to-or/[0.08] p-6 text-center">
          <p className="font-baskerville text-xl font-bold text-encre">Traduisez vos justificatifs immédiatement</p>
          <p className="mt-1 text-sm text-sepia">Déposez vos documents — prix fixe et délai immédiats. Traducteur assermenté MAEC nº 3850.</p>
          <Link href="/traduction-assermentee" className="mt-4 inline-block rounded-xl bg-bleu px-6 py-3 font-semibold text-white hover:bg-bleu-light">
            Déposer mes documents →
          </Link>
        </div>

        <p className="mt-8 text-xs text-graphite">
          Sources officielles :{" "}
          <a href="https://sede.agenciatributaria.gob.es/Sede/no-residentes/irnr-sin-establecimiento-permanente.html" className="text-bleu underline" rel="noopener noreferrer" target="_blank">Agencia Tributaria — IRNR / modèle 210</a> ·
          <a href="https://www.impots.gouv.fr" className="text-bleu underline" rel="noopener noreferrer" target="_blank"> impots.gouv.fr</a> ·
          convention fiscale France-Espagne. Informations générales, non contractuelles.
        </p>
      </section>
    </main>
  );
}
