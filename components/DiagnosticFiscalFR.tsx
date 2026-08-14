"use client";

import { useState } from "react";
import Link from "next/link";
import { buildIcs, type IcsEvent } from "@/lib/ics";

// Diagnostic fiscal France-Espagne : state machine sans LLM (même patron que
// le chat UGE de test-uge). Règles et dates vérifiées au 14/08/2026 contre
// BOE/impots.gouv.fr/BOFiP; re-vérifier chaque janvier (Loi de finances / BOE).

type Reponses = {
  res?: string;
  her?: string;
  pat?: string[];
  seuil?: string;
  usage?: string;
  decl?: string;
  pension?: string;
  m720?: string;
};

type Question = {
  id: keyof Reponses;
  texte: string;
  multi?: boolean;
  cond?: (r: Reponses) => boolean;
  opts: [string, string][];
};

const aDesBiens = (r: Reponses) => (r.pat ?? []).some((v) => v !== "rien");

const QUESTIONS: Question[] = [
  {
    id: "res",
    texte: "Vivez-vous en Espagne plus de 183 jours par an ?",
    opts: [["oui", "Oui"], ["arrive", "Pas encore — j'arrive cette année"], ["non", "Non"]],
  },
  {
    id: "her",
    texte: "Avez-vous reçu — ou attendez-vous — un héritage avec des biens en France ?",
    opts: [["non", "Non"], ["encours", "Succession en cours"], ["recu", "Héritage reçu depuis 2024"]],
  },
  {
    id: "pat",
    texte: "Qu'avez-vous en France aujourd'hui ? (plusieurs choix possibles)",
    multi: true,
    opts: [
      ["immo", "Un bien immobilier"],
      ["comptes", "Des comptes bancaires"],
      ["av", "Assurance-vie ou titres"],
      ["rien", "Rien de tout ça"],
    ],
  },
  {
    id: "seuil",
    texte: "Un de ces blocs (comptes / titres et assurance-vie / immobilier) dépassait-il 50 000 € au 31 décembre ?",
    cond: (r) => aDesBiens(r) || r.her !== "non",
    opts: [["oui", "Oui"], ["non", "Non"], ["nsp", "Je ne sais pas"]],
  },
  {
    id: "usage",
    texte: "Ce bien en France, il est… ?",
    cond: (r) => (r.pat ?? []).includes("immo"),
    opts: [["loue", "Loué"], ["vide", "Vide"], ["secondaire", "C'est ma résidence secondaire"]],
  },
  {
    id: "decl",
    texte: "Les loyers, vous les déclarez… ?",
    cond: (r) => r.usage === "loue",
    opts: [
      ["fr", "En France seulement"],
      ["deux", "Dans les deux pays"],
      ["nulle", "Nulle part encore"],
      ["debut", "Je viens de commencer à louer"],
    ],
  },
  {
    id: "pension",
    texte: "Percevez-vous une pension française ?",
    opts: [["non", "Non"], ["privee", "Oui, une pension privée"], ["publique", "Oui, une pension de la fonction publique"]],
  },
  {
    id: "m720",
    texte: "Le « modelo 720 », vous l'avez déjà déposé ?",
    cond: (r) => aDesBiens(r) || r.her !== "non",
    opts: [["oui", "Oui, déjà déposé"], ["non", "Non, jamais"], ["quoi", "C'est quoi ?"]],
  },
];

type Piege = { n: "rouge" | "ambre" | "info"; or?: boolean; t: string; d: string };

function evaluer(r: Reponses): Piege[] {
  const pieges: Piege[] = [];
  const seuil = r.seuil === "oui" || r.seuil === "nsp";

  if (seuil && r.m720 !== "oui") {
    pieges.push({
      n: "rouge",
      t: "Le 720 fantôme",
      d: "Un bloc dépasse (ou pourrait dépasser) 50 000 € et le modelo 720 n'a pas été déposé avant le 31 mars. Depuis l'arrêt de la CJUE de 2022, régulariser volontairement coûte peu ; attendre un contrôle coûte le double — et la France transmet vos données automatiquement (DAC/CRS).",
    });
  }
  if (r.usage === "loue" && (r.decl === "fr" || r.decl === "nulle" || r.decl === "debut")) {
    pieges.push({
      n: "rouge",
      t: "« Je paie déjà en France »",
      d:
        "L'erreur nº 1 du profil : les loyers français doivent AUSSI figurer dans votre déclaration espagnole (revenus mondiaux). La convention de 1995 évite la double imposition par une déduction — pas par le silence." +
        (r.decl === "nulle" ? " Et côté français, la déclaration de non-résident est également due." : ""),
    });
  }
  if (r.her === "encours") {
    pieges.push({
      n: "ambre",
      t: "Les 6 mois qui courent",
      d: "La déclaration de succession française doit être déposée dans les 6 mois du décès (12 si décès hors de France). Passé ce délai : 0,20 %/mois + majoration de 10 % dès le 13ᵉ mois.",
    });
  }
  if (r.her === "recu") {
    pieges.push({
      n: "ambre",
      t: "Succession à vérifier",
      d: "Héritage reçu : vérifiez que la déclaration de succession française a bien été déposée dans les délais, et que le modelo 720 espagnol de l'année suivante a suivi.",
    });
  }
  if (r.her !== "non" && r.her !== undefined) {
    pieges.push({
      n: "ambre",
      or: true,
      t: "Le double impôt évitable",
      d: "L'Espagne et la France ont une convention successorale de 1963 (l'une des trois seules de l'Espagne) : les immeubles français et — si le défunt vivait en France — les comptes et assurances-vie se taxent en France SEULEMENT. Beaucoup paient l'impôt espagnol en trop : il est récupérable pendant 4 ans.",
    });
  }
  if (r.usage === "loue") {
    pieges.push({
      n: "ambre",
      or: true,
      t: "Le 17,2 % payé en trop",
      d: "Affilié·e à la sécurité sociale espagnole, vous ne devez que le prélèvement de solidarité de 7,5 % sur vos loyers — pas les 17,2 % de prélèvements sociaux complets. Vérifiez vos avis : la différence se réclame.",
    });
    pieges.push({
      n: "info",
      or: true,
      t: "Le taux minimum sans option",
      d: "La France applique d'office 20 % (30 % au-delà de 29 579 €, seuil revenus 2025, indexé chaque année). Si votre taux moyen mondial est inférieur, l'option « taux moyen » réduit la note — il faut justifier vos revenus mondiaux (documents espagnols traduits).",
    });
  }
  if (r.usage === "vide" || r.usage === "secondaire") {
    pieges.push({
      n: "ambre",
      t: "Le patrimoine invisible",
      d: "Un bien vide en France ne génère rien côté français… mais l'Espagne impute un revenu fictif dans votre IRPF (art. 85 LIRPF : 1,1 % sur 50 % de la valeur d'acquisition). Et selon les valeurs : IFI français (> 1,3 M€ d'immobilier français) ou impôt sur la fortune espagnol.",
    });
  }
  if (r.pension === "privee") {
    pieges.push({
      n: "info",
      t: "Pension privée : imposable en Espagne seulement",
      d: "Art. 18 de la convention de 1995. Si votre caisse française retient encore l'impôt à la source, cette retenue se conteste — avec un certificat de résidence fiscale espagnol (à faire traduire).",
    });
  }
  if (r.pension === "publique") {
    pieges.push({
      n: "info",
      t: "Pension publique : imposable en France seulement",
      d: "Art. 19 de la convention (sauf nationalité espagnole). Elle compte cependant pour le calcul du taux espagnol — à déclarer correctement des deux côtés.",
    });
  }
  return pieges;
}

function echeancesDe(r: Reponses): [string, string, string, string][] {
  const immo = (r.pat ?? []).includes("immo");
  const seuil = r.seuil === "oui" || r.seuil === "nsp";
  const rows: [string, string, string, string][] = [];
  if (r.her !== "non" && r.her !== undefined) {
    rows.push(["fr", "Déclaration de succession", "Décès + 6 mois", "2705-SD (via le notaire)"]);
    rows.push([
      "es",
      "Impôt succession espagnol — seulement si biens en Espagne ou défunt résident espagnol (convention 1963)",
      "6 mois (+6 de prorogation)",
      "Modelo 650",
    ]);
  }
  if (seuil) rows.push(["es", "Déclaration des biens à l'étranger", "1 janv → 31 mars", "Modelo 720"]);
  rows.push(["es", "Déclaration IRPF — revenus mondiaux", "avril → 30 juin", "Modelo 100"]);
  if (r.usage === "loue")
    rows.push(["fr", "Déclaration des loyers (non-résident) — prélèvement 7,5 %, pas 17,2 %", "mai → juin", "2042 case 4BE (≤ 15 000 €) ou 2044"]);
  if (r.usage === "vide" || r.usage === "secondaire")
    rows.push(["es", "« Imputation » du bien non loué, dans l'IRPF", "avec la Renta", "Modelo 100"]);
  if (immo) rows.push(["fr", "Taxe foncière", "15 octobre", "Avis (aucune démarche)"]);
  if (r.seuil === "oui")
    rows.push(["es", "Impôt sur la fortune — si vous dépassez les minima (varie selon la région)", "avec la Renta", "Modelo 714"]);
  return rows;
}

function docsDe(r: Reponses): string[] {
  const docs: string[] = [];
  if (r.her !== "non" && r.her !== undefined) {
    docs.push("Acte de décès — banques, notaire, administrations espagnoles");
    docs.push("Acte de notoriété — pour débloquer comptes et inscrire les biens");
    docs.push("Testament et acte de dépôt");
    docs.push("Déclaration de succession (2705) — preuve de valeur et de date pour l'AEAT");
    docs.push("Attestation immobilière / acte de partage — banque (origine des fonds) et registre");
  }
  if (r.usage === "loue") docs.push("Bail et avis d'imposition français — en cas de contrôle de l'AEAT");
  if ((r.pat ?? []).includes("comptes") || (r.pat ?? []).includes("av"))
    docs.push("Relevés bancaires / certificat de valeur de rachat — modelo 720");
  if (r.pension === "privee" || r.pension === "publique")
    docs.push("Certificat de résidence fiscale espagnol (AEAT) → vers le français, pour votre caisse");
  return docs;
}

// Next occurrence of a fixed annual deadline (month is 1-based).
function prochaine(mois: number, jour: number): Date {
  const now = new Date();
  const cette = new Date(now.getFullYear(), mois - 1, jour);
  return cette >= now ? cette : new Date(now.getFullYear() + 1, mois - 1, jour);
}

function icsDe(r: Reponses): IcsEvent[] {
  const immo = (r.pat ?? []).includes("immo");
  const seuil = r.seuil === "oui" || r.seuil === "nsp";
  const events: IcsEvent[] = [];
  if (seuil) {
    events.push({
      uid: "fiscal-fr-es-720@traduccionesjuradas.net",
      title: "ES · Modelo 720 — biens à l'étranger (date limite)",
      date: prochaine(3, 31),
      description: "Déclaration informative espagnole des biens à l'étranger. Diagnostic : traduccionesjuradas.net/fr/diagnostic-fiscal",
      alarmDaysBefore: 14,
    });
  }
  events.push({
    uid: "fiscal-fr-es-renta@traduccionesjuradas.net",
    title: "ES · Déclaration IRPF — date limite (revenus mondiaux)",
    date: prochaine(6, 30),
    description: "Renta espagnole avec vos revenus mondiaux (loyers français inclus). Diagnostic : traduccionesjuradas.net/fr/diagnostic-fiscal",
    alarmDaysBefore: 14,
  });
  if (r.usage === "loue") {
    events.push({
      uid: "fiscal-fr-es-declafr@traduccionesjuradas.net",
      title: "FR · Déclaration des revenus (non-résident) — date indicative",
      date: prochaine(5, 31),
      description: "Revenus fonciers français : 2042 case 4BE ou 2044. La date exacte varie selon la campagne — vérifiez sur impots.gouv.fr.",
      alarmDaysBefore: 14,
    });
  }
  if (immo) {
    events.push({
      uid: "fiscal-fr-es-tf@traduccionesjuradas.net",
      title: "FR · Taxe foncière — paiement",
      date: prochaine(10, 15),
      description: "Avis disponible fin août sur impots.gouv.fr ; majoration de 10 % en cas de retard.",
      alarmDaysBefore: 7,
    });
  }
  return events;
}

function telechargerIcs(events: IcsEvent[]) {
  if (!events.length || typeof window === "undefined") return;
  const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "echeances-fiscales-france-espagne.ics";
  a.click();
  URL.revokeObjectURL(url);
}

const DOC_SLUGS: Record<string, string> = {
  "Acte de décès": "acte_deces",
  "Acte de notoriété": "acte_notoriete",
  "Testament": "testament",
  "Déclaration de succession": "declaration_succession",
  "Attestation immobilière": "attestation_immobiliere",
  "Bail et avis": "bail_avis",
  "Relevés bancaires": "releves",
  "Certificat de résidence fiscale": "certificat_residence",
};

function slugsDe(docs: string[]): string {
  return docs
    .map((d) => {
      const cle = Object.keys(DOC_SLUGS).find((k) => d.startsWith(k));
      return cle ? DOC_SLUGS[cle] : null;
    })
    .filter(Boolean)
    .join(",");
}

const EXEMPLE_ISABELLE: Reponses = {
  res: "oui",
  her: "recu",
  pat: ["immo", "comptes"],
  seuil: "oui",
  usage: "loue",
  decl: "fr",
  pension: "non",
  m720: "non",
};

export default function DiagnosticFiscalFR() {
  const [reponses, setReponses] = useState<Reponses>({});
  const [transcript, setTranscript] = useState<{ q: string; a: string }[]>([]);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [fini, setFini] = useState(false);
  const [exemple, setExemple] = useState(false);
  const [copie, setCopie] = useState(false);

  const actives = QUESTIONS.filter((q) => !q.cond || q.cond(reponses));
  const courante = fini ? undefined : actives.find((q) => reponses[q.id] === undefined);

  function repondre(q: Question, valeur: string | string[], libelle: string) {
    const suivantes = { ...reponses, [q.id]: valeur };
    setReponses(suivantes);
    setTranscript((t) => [...t, { q: q.texte, a: libelle }]);
    setMultiSel([]);
    const restantes = QUESTIONS.filter((x) => !x.cond || x.cond(suivantes)).filter(
      (x) => suivantes[x.id] === undefined,
    );
    if (restantes.length === 0) setFini(true);
  }

  function toggleMulti(v: string) {
    setMultiSel((sel) => {
      if (v === "rien") return ["rien"];
      const sans = sel.filter((x) => x !== "rien");
      return sans.includes(v) ? sans.filter((x) => x !== v) : [...sans, v];
    });
  }

  function recommencer() {
    setReponses({});
    setTranscript([]);
    setMultiSel([]);
    setFini(false);
    setExemple(false);
  }

  function voirExemple() {
    setReponses(EXEMPLE_ISABELLE);
    setTranscript([]);
    setExemple(true);
    setFini(true);
  }

  const pieges = fini ? evaluer(reponses) : [];
  const rouges = pieges.filter((p) => p.n === "rouge").length;
  const ambres = pieges.filter((p) => p.n === "ambre").length;
  const niveau = rouges ? "rouge" : ambres ? "ambre" : "vert";
  const verdictStyle =
    niveau === "rouge"
      ? "border-red-700/40 bg-red-700/[0.06] text-red-800"
      : niveau === "ambre"
        ? "border-or/60 bg-or/[0.08] text-encre"
        : "border-green-700/40 bg-green-700/[0.06] text-green-800";
  const titres: Record<string, string> = {
    rouge: "Feu rouge : des obligations vous attendent déjà",
    ambre: "Feu orange : des points à régler — et peut-être de l'argent à récupérer",
    vert: "Feu vert : situation simple, gardez le calendrier à l'œil",
  };

  return (
    <div className="mt-8 rounded-2xl border border-cream bg-card p-5 shadow-paper sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-baskerville text-2xl text-encre">Votre diagnostic</h2>
        {!fini && (
          <button type="button" onClick={voirExemple} className="text-sm font-semibold text-bleu underline">
            Voir un exemple (Isabelle) →
          </button>
        )}
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {transcript.map((t, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="max-w-[90%] self-start rounded-xl rounded-bl-sm bg-bleu/[0.08] px-3 py-2 text-sm text-encre">{t.q}</p>
              <p className="max-w-[90%] self-end rounded-xl rounded-br-sm bg-or/[0.12] px-3 py-2 text-sm font-semibold text-encre">{t.a}</p>
            </div>
          ))}
        </div>
      )}

      {exemple && fini && (
        <p className="mt-4 rounded-xl bg-bleu/[0.08] px-3 py-2 text-sm text-encre">
          <strong>Exemple — Isabelle :</strong> salariée en Espagne, a hérité en France en 2025 (un appartement et des
          comptes), loue l&apos;appartement depuis mai 2026, déclare les loyers en France seulement, n&apos;a jamais
          déposé de modelo 720.
        </p>
      )}

      {/* Question courante */}
      {courante && (
        <div className="mt-4">
          <p className="max-w-[90%] rounded-xl rounded-bl-sm bg-bleu/[0.08] px-3 py-2 text-encre">{courante.texte}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {courante.opts.map(([v, l]) =>
              courante.multi ? (
                <button
                  key={v}
                  type="button"
                  aria-pressed={multiSel.includes(v)}
                  onClick={() => toggleMulti(v)}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors ${
                    multiSel.includes(v) ? "border-bleu bg-bleu text-white" : "border-bleu bg-card text-bleu hover:bg-bleu/[0.08]"
                  }`}
                >
                  {l}
                </button>
              ) : (
                <button
                  key={v}
                  type="button"
                  onClick={() => repondre(courante, v, l)}
                  className="rounded-full border-2 border-bleu bg-card px-4 py-1.5 text-sm font-medium text-bleu transition-colors hover:bg-bleu/[0.08]"
                >
                  {l}
                </button>
              ),
            )}
            {courante.multi && (
              <button
                type="button"
                onClick={() => {
                  if (!multiSel.length) return;
                  const libelles = multiSel
                    .map((v) => courante.opts.find(([ov]) => ov === v)?.[1] ?? v)
                    .join(" + ");
                  repondre(courante, multiSel, libelles);
                }}
                className="rounded-full bg-bleu px-4 py-1.5 text-sm font-semibold text-white hover:bg-bleu-light"
              >
                Valider →
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-graphite">
            Question {transcript.length + 1} sur {actives.length} environ · aucune donnée n&apos;est envoyée : tout
            reste dans votre navigateur.
          </p>
        </div>
      )}

      {/* Résultat */}
      {fini && (
        <div className="mt-6">
          <div className={`rounded-xl border-2 p-4 ${verdictStyle}`}>
            <p className="font-baskerville text-xl font-bold">{titres[niveau]}</p>
            {reponses.res !== "oui" && (
              <p className="mt-1 text-sm">
                Attention : ce diagnostic suppose la résidence fiscale espagnole (plus de 183 jours/an). Votre
                situation d&apos;arrivée mérite une analyse spécifique.
              </p>
            )}
            <p className="mt-1 text-sm">
              {pieges.length} point(s) détecté(s){rouges ? ` · ${rouges} urgent(s)` : ""} · règles au 14/08/2026
            </p>
          </div>

          {pieges.length > 0 && (
            <div className="mt-5">
              <h3 className="font-baskerville text-xl text-encre">Vos points d&apos;attention</h3>
              <div className="mt-2 space-y-2">
                {pieges.map((p, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border border-cream border-l-4 bg-card p-3 shadow-paper ${
                      p.n === "rouge" ? "border-l-red-700" : p.n === "ambre" ? "border-l-or" : "border-l-bleu"
                    }`}
                  >
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-encre">
                      {p.t}
                      {p.or && (
                        <span className="rounded-full bg-or/[0.15] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-or">
                          € récupérable
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-sepia">{p.d}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="mt-6 font-baskerville text-xl text-encre">Vos échéances, les deux pays réunis</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse overflow-hidden rounded-xl border border-cream bg-card text-sm">
              <thead>
                <tr className="bg-parchment text-left text-xs uppercase tracking-wide text-graphite">
                  <th className="px-3 py-2">Pays</th>
                  <th className="px-3 py-2">Obligation</th>
                  <th className="px-3 py-2">Quand</th>
                </tr>
              </thead>
              <tbody>
                {echeancesDe(reponses).map((row, i) => (
                  <tr key={i} className="border-t border-cream align-top">
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${
                          row[0] === "fr" ? "bg-bleu/[0.12] text-bleu" : "bg-or/[0.15] text-or"
                        }`}
                      >
                        {row[0].toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-encre">
                      {row[1]}
                      <span className="block text-xs text-graphite">{row[3]}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums text-encre">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => telechargerIcs(icsDe(reponses))}
            className="mt-3 rounded-xl border-2 border-bleu px-4 py-2 text-sm font-semibold text-bleu hover:bg-bleu/[0.08]"
          >
            📅 Ajouter mes échéances à mon agenda (.ics)
          </button>
          <p className="mt-1 text-xs text-graphite">
            Rappels 1–2 semaines avant chaque date, dans votre propre calendrier. Aucune donnée envoyée.
          </p>

          {docsDe(reponses).length > 0 && (
            <div className="mt-6">
              <h3 className="font-baskerville text-xl text-encre">Documents à faire traduire (traduction assermentée)</h3>
              <p className="mt-1 text-sm text-sepia">
                Les administrations et banques espagnoles exigent des traductions assermentées de vos documents
                français — et inversement.
              </p>
              <ul className="mt-2 space-y-1.5">
                {docsDe(reponses).map((d, i) => (
                  <li key={i} className="rounded-lg border border-cream bg-card px-3 py-2 text-sm text-encre shadow-paper">
                    {d}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  const liste = docsDe(reponses)
                    .map((d) => "- " + d)
                    .join("\n");
                  navigator.clipboard
                    .writeText("Documents à traduire (diagnostic fiscal France-Espagne) :\n" + liste)
                    .then(() => {
                      setCopie(true);
                      setTimeout(() => setCopie(false), 3000);
                    })
                    .catch(() => {});
                }}
                className="mt-3 rounded-xl border border-cream px-4 py-2 text-sm font-medium text-sepia hover:bg-parchment"
              >
                {copie ? "✓ Liste copiée" : "Copier ma liste de documents"}
              </button>
              <p className="mt-1 text-xs text-graphite">
                Collez-la dans le dépôt de documents ou dans votre message — nous saurons exactement quoi préparer.
              </p>
            </div>
          )}

          {reponses.her !== "non" && reponses.her !== undefined && (
            <div className="mt-6">
              <h3 className="font-baskerville text-xl text-encre">Packs succession — prix fermé, zéro surprise</h3>
              <p className="mt-1 text-sm text-sepia">
                Le lot complet de votre succession traduit par un traducteur assermenté (MAEC nº 3850), à prix
                fermé connu d&apos;avance.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col rounded-2xl border border-cream bg-card p-5 shadow-paper">
                  <p className="font-baskerville text-lg font-bold text-encre">Pack Succession Essentiel</p>
                  <p className="mt-1 text-sm text-sepia">
                    Acte de décès + acte de notoriété + attestation immobilière (jusqu&apos;à 8 pages au total).
                  </p>
                  <p className="mt-3 font-baskerville text-3xl font-bold text-bleu">299&nbsp;€</p>
                  <Link
                    href="/traduction-assermentee?origen=diagnostic-fiscal&pack=succession-essentiel"
                    className="mt-4 inline-block rounded-xl bg-bleu px-4 py-2 text-center text-sm font-semibold text-white hover:bg-bleu-light"
                  >
                    Commander ce pack →
                  </Link>
                </div>
                <div className="flex flex-col rounded-2xl border-2 border-bleu/40 bg-card p-5 shadow-paper">
                  <p className="font-baskerville text-lg font-bold text-encre">Pack Succession Complet</p>
                  <p className="mt-1 text-sm text-sepia">
                    L&apos;Essentiel + testament + déclaration de succession (jusqu&apos;à 15 pages au total).
                  </p>
                  <p className="mt-3 font-baskerville text-3xl font-bold text-bleu">449&nbsp;€</p>
                  <Link
                    href="/traduction-assermentee?origen=diagnostic-fiscal&pack=succession-complet"
                    className="mt-4 inline-block rounded-xl bg-bleu px-4 py-2 text-center text-sm font-semibold text-white hover:bg-bleu-light"
                  >
                    Commander ce pack →
                  </Link>
                </div>
              </div>
              <p className="mt-2 text-xs text-graphite">
                Page supplémentaire : 20&nbsp;€. Déposez vos documents et indiquez le pack — nous confirmons le
                prix fermé avant tout paiement.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/traduction-assermentee?origen=diagnostic-fiscal${
                docsDe(reponses).length ? `&docs=${slugsDe(docsDe(reponses))}` : ""
              }`}
              className="rounded-xl bg-bleu px-5 py-2.5 font-semibold text-white hover:bg-bleu-light"
            >
              Devis de traduction assermentée →
            </Link>
            <Link
              href="/contacto"
              className="rounded-xl border-2 border-bleu px-5 py-2.5 font-semibold text-bleu hover:bg-bleu/[0.08]"
            >
              Poser une question
            </Link>
            <button
              type="button"
              onClick={recommencer}
              className="rounded-xl border border-cream px-5 py-2.5 font-medium text-sepia hover:bg-parchment"
            >
              Refaire le test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
