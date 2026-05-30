import type { Metadata } from "next";
import Link from "next/link";
import PuertaClient from "@/app/presupuesto-instantaneo/PuertaClient";
import { SelloMinisterio } from "@/components/SelloMinisterio";
import BancoUtilidades from "@/components/BancoUtilidades";

export const metadata: Metadata = {
  title: "Traduction assermentée français-espagnol en 60 secondes",
  description:
    "Traduction assermentée officielle (traducteur assermenté MAEC nº 3850). Déposez votre document, recevez prix et délai immédiatement, payez en ligne. Spécialiste français ↔ espagnol.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/traduction-assermentee" },
  openGraph: {
    title: "Traduction assermentée français-espagnol",
    description:
      "Prix fermé et délai immédiats. Traducteur assermenté officiel (MAEC nº 3850) pour vos démarches en Espagne et en France.",
    locale: "fr_FR",
    url: "https://www.traduccionesjuradas.net/traduction-assermentee",
  },
};

const STEPS = [
  { n: "1", t: "Déposez votre document", d: "PDF, photo ou scan. Plusieurs documents possibles." },
  { n: "2", t: "Diagnostic en 10 secondes", d: "Type, traduction assermentée requise, prix, délai et validité." },
  { n: "3", t: "Payez et recevez", d: "Paiement en ligne. On vous prévient par email quand c'est prêt." },
];

export default function TraductionAssermenteePage() {
  return (
    <div className="min-h-screen bg-parchment">
      <section id="hero-fr" className="border-b border-cream bg-parchment">
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-8 text-center sm:pt-14">
          <div className="flex justify-center">
            <SelloMinisterio className="!h-28 !w-28" />
          </div>
          <h1 className="mx-auto mt-5 max-w-2xl font-baskerville text-3xl font-bold tracking-tight text-encre sm:text-4xl">
            Votre traduction assermentée officielle{" "}
            <em className="text-or-dark not-italic">en 60 secondes</em>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-sepia sm:text-lg">
            Déposez votre document, recevez le prix fermé et le délai immédiatement, et payez en ligne.
            Spécialiste <strong>français ↔ espagnol</strong>.
          </p>

          <div className="mx-auto mt-10 max-w-xl text-left">
            <PuertaClient purpose={null} lang="fr" />
          </div>
        </div>
      </section>

      <BancoUtilidades lang="fr" />

      <section className="bg-cream py-12">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre">Comment ça marche</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-cream bg-card p-5 shadow-paper">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bleu/10 font-semibold text-bleu">
                  {s.n}
                </div>
                <p className="mt-3 font-semibold text-encre">{s.t}</p>
                <p className="mt-1 text-sm text-sepia">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-graphite">
            Une question ?{" "}
            <a href="https://wa.me/34951333614" className="text-bleu underline">Écrivez-nous sur WhatsApp</a>.
          </p>
        </div>
      </section>

      {/* Cas fréquents (FR) */}
      <section className="bg-parchment py-12">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre">Cas fréquents des clients français</h2>
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
