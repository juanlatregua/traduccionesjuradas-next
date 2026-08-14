import type { Metadata } from "next";
import DiagnosticFiscalFR from "@/components/DiagnosticFiscalFR";

export const metadata: Metadata = {
  title: "Diagnostic fiscal France-Espagne : vos obligations dans les deux pays",
  description:
    "Résident fiscal en Espagne avec un bien, un héritage ou une pension en France ? En 3 minutes : vos obligations, vos dates (modelo 720, IRPF, succession) et les documents à traduire.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/fr/diagnostic-fiscal" },
  openGraph: { locale: "fr_FR", title: "Diagnostic fiscal France-Espagne" },
};

const JALONS: { pays: "fr" | "es"; date: string; quoi: string }[] = [
  { pays: "es", date: "31 mars", quoi: "Modelo 720 — biens à l'étranger" },
  { pays: "es", date: "avril → 30 juin", quoi: "Déclaration IRPF (revenus mondiaux)" },
  { pays: "fr", date: "mai → juin", quoi: "Déclaration des revenus français (non-résident)" },
  { pays: "fr", date: "15 octobre", quoi: "Taxe foncière" },
  { pays: "fr", date: "Décès + 6 mois", quoi: "Déclaration de succession" },
];

export default function DiagnosticFiscalPage() {
  return (
    <main className="min-h-screen bg-parchment">
      <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-bleu">Français résidents en Espagne</p>
        <h1 className="mt-2 font-baskerville text-3xl font-bold text-encre sm:text-4xl">
          Vous vivez en Espagne. Votre patrimoine, lui, est resté en France.
        </h1>
        <p className="mt-4 text-lg text-sepia">
          Loyers, héritage, comptes, pension : chaque bien français crée des obligations{" "}
          <strong>dans les deux pays</strong> — avec des calendriers qui se croisent. Les autres publient des
          guides ; ici, vous obtenez <strong>ce qui s&apos;applique à vous</strong> : vos obligations, vos dates,
          vos documents. Gratuit, 3 minutes, sans inscription.
        </p>

        {/* Calendrier croisé */}
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
            Le calendrier croisé — un an, deux pays
          </p>
          <div className="mt-2 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3">
              {JALONS.map((j) => (
                <div
                  key={j.date + j.quoi}
                  className={`min-w-[10.5rem] rounded-xl border border-cream bg-card p-3 shadow-paper ${
                    j.pays === "fr" ? "border-t-4 border-t-bleu" : "border-t-4 border-t-or"
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${
                      j.pays === "fr" ? "bg-bleu/[0.12] text-bleu" : "bg-or/[0.15] text-or"
                    }`}
                  >
                    {j.pays.toUpperCase()}
                  </span>{" "}
                  <span className="font-semibold tabular-nums text-encre">{j.date}</span>
                  <p className="mt-1 text-sm text-sepia">{j.quoi}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DiagnosticFiscalFR />

        <div className="mt-8 rounded-xl border border-or/40 bg-or/[0.06] p-5">
          <p className="text-sm text-encre">
            ⚠ <strong>Avertissement.</strong> Ce diagnostic vous informe et vous organise ; il ne constitue pas
            un conseil fiscal et ne remplace ni votre conseiller ni les administrations. Les règles et dates ont
            été vérifiées au 14/08/2026 (les valeurs marquées ✻ restent à confirmer) et la fiscalité change
            chaque année : vérifiez votre situation auprès d&apos;un professionnel avant toute décision.
          </p>
        </div>

        <p className="mt-8 text-xs text-graphite">
          Sources officielles :{" "}
          <a
            href="https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/folletos/folletos-residentes-rentas-extranjeras/francia.html"
            className="text-bleu underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Agencia Tributaria — résidents avec revenus de France
          </a>{" "}
          ·{" "}
          <a
            href="https://www.impots.gouv.fr/international-particulier/je-ne-reside-pas-en-france-mais-jai-des-interets-en-france"
            className="text-bleu underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            impots.gouv.fr — non-résidents
          </a>{" "}
          ·{" "}
          <a
            href="https://www.boe.es/buscar/doc.php?id=BOE-A-1997-12729"
            className="text-bleu underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Convention France-Espagne 1995 (BOE)
          </a>{" "}
          ·{" "}
          <a
            href="https://www.boe.es/buscar/doc.php?id=BOE-A-1964-1"
            className="text-bleu underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Convention successorale de 1963 (BOE)
          </a>
        </p>
      </section>
    </main>
  );
}
