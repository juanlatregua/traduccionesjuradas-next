import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acheter un bien immobilier en Espagne : quels documents traduire ?",
  description:
    "Vous achetez un logement en Espagne ? NIE, prêt, notaire : voici les documents que les acheteurs français doivent faire traduire (traduction assermentée français-espagnol). Devis immédiatement.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/fr/acheter-bien-immobilier-espagne" },
  openGraph: { locale: "fr_FR", title: "Acheter un bien en Espagne : documents à traduire" },
};

const POUR_LACHAT = [
  ["Justificatifs de revenus", "Avis d’imposition, fiches de paie, contrat de travail — demandés par la banque pour le prêt hypothécaire."],
  ["Relevés et attestation bancaire", "Pour l’ouverture de compte et le dossier de financement."],
  ["Acte de mariage / contrat de mariage", "Le notaire en a besoin pour faire figurer le régime matrimonial dans l’acte (escritura). Point souvent oublié qui bloque la signature."],
  ["Procuration (poder)", "Si vous achetez à distance et donnez procuration à un tiers ou à un avocat en Espagne."],
];

const APRES_LACHAT = [
  ["Acte de vente (escritura de compraventa)", "Pour vos démarches et votre déclaration en France."],
  ["Nota simple registrale", "Justificatif de propriété au registre foncier espagnol."],
];

export default function AcheterImmobilierPage() {
  return (
    <main className="min-h-screen bg-parchment">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-bleu">Acheteurs français en Espagne</p>
        <h1 className="mt-2 font-baskerville text-3xl font-bold text-encre sm:text-4xl">
          Acheter un bien immobilier en Espagne : quels documents traduire ?
        </h1>
        <p className="mt-4 text-lg text-sepia">
          Pour acheter en Espagne, il faut un <strong>NIE</strong> (numéro d’identification d’étranger), passer
          devant notaire et signer l’acte (<em>escritura</em>). Plusieurs documents français doivent être présentés
          en <strong>traduction assermentée français-espagnol</strong>. Voici lesquels.
        </p>

        <h2 className="mt-10 font-baskerville text-2xl text-encre">Avant l’achat (français → espagnol)</h2>
        <ul className="mt-4 space-y-3">
          {POUR_LACHAT.map(([t, d]) => (
            <li key={t} className="rounded-xl border border-cream bg-card p-4 shadow-paper">
              <p className="font-semibold text-encre">{t}</p>
              <p className="mt-1 text-sm text-sepia">{d}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 font-baskerville text-2xl text-encre">Après l’achat (espagnol → français)</h2>
        <ul className="mt-4 space-y-3">
          {APRES_LACHAT.map(([t, d]) => (
            <li key={t} className="rounded-xl border border-cream bg-card p-4 shadow-paper">
              <p className="font-semibold text-encre">{t}</p>
              <p className="mt-1 text-sm text-sepia">{d}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-xl border border-bleu/20 bg-bleu/[0.04] p-5">
          <p className="text-sm text-encre">
            <strong>Bon à savoir (fiscalité).</strong> Si le vendeur est non-résident, l’acheteur retient
            <strong> 3 %</strong> du prix et le verse au fisc espagnol (modèle 211). Et une fois propriétaire
            non-résident, vous devrez déclarer chaque année via le <Link href="/fr/declaration-non-resident-espagne" className="text-bleu underline">modèle 210 (IRNR)</Link>.
            Informations générales — vérifiez votre cas avec un conseiller.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border-2 border-bleu/30 bg-gradient-to-br from-bleu/[0.08] to-or/[0.08] p-6 text-center">
          <p className="font-baskerville text-xl font-bold text-encre">Recevez votre devis immédiatement</p>
          <p className="mt-1 text-sm text-sepia">Déposez vos documents — prix fixe et délai immédiats. Traducteur assermenté MAEC nº 3850.</p>
          <Link href="/traduction-assermentee" className="mt-4 inline-block rounded-xl bg-bleu px-6 py-3 font-semibold text-white hover:bg-bleu-light">
            Déposer mes documents →
          </Link>
        </div>

        <p className="mt-8 text-xs text-graphite">
          Sources officielles : <a href="https://www.notariado.org" className="text-bleu underline" rel="noopener noreferrer" target="_blank">Notariado</a> ·
          <a href="https://sede.agenciatributaria.gob.es" className="text-bleu underline" rel="noopener noreferrer" target="_blank"> Agencia Tributaria</a>.
          Ces informations sont générales et ne constituent pas un conseil juridique ou fiscal.
        </p>
      </section>
    </main>
  );
}
