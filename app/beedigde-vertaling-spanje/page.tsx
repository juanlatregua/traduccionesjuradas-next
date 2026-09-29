import type { Metadata } from "next";
import Link from "next/link";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaService } from "@/components/SchemaService";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import { MAEC_TRADUCTORES_URL, PORTADAS_UPDATED } from "@/lib/i18n/respuesta-directa";
import { SITE_URL } from "@/lib/i18n/locales";

const URL_NL = `${SITE_URL}/beedigde-vertaling-spanje`;
const URL_ES = `${SITE_URL}/traductor-jurado-neerlandes`;
const HCCH_URL = "https://www.hcch.net/en/instruments/conventions/status-table/?cid=41";

export const metadata: Metadata = {
  title: "Beëdigde vertaling Nederlands-Spaans · officieel geldig in Spanje",
  description:
    "Beëdigde vertaling (traducción jurada) Nederlands-Spaans door een door het Spaanse MAEC benoemde vertaler. Uittreksel BRP, geboorteakte, diploma, VOG. Vanaf € 40 excl. btw per document.",
  alternates: {
    canonical: URL_NL,
    languages: { nl: URL_NL, "es-ES": URL_ES },
  },
  openGraph: {
    title: "Beëdigde vertaling Nederlands-Spaans",
    description: "Officieel geldig bij Spaanse instanties. Vaste prijs vóór betaling, vanaf € 40 excl. btw per document.",
    locale: "nl_NL",
    url: URL_NL,
  },
};

const FAQ = [
  {
    question: "Wat is een beëdigde vertaling voor Spanje en wie maakt die?",
    answer:
      "Een beëdigde vertaling (in het Spaans: traducción jurada) is een vertaling die is ondertekend en gestempeld door een traductor jurado, benoemd door het Spaanse ministerie van Buitenlandse Zaken (MAEC). Volgens het ministerie hebben zulke vertalingen een officieel karakter en mogen ze worden ingediend bij rechterlijke en administratieve instanties. Bij ons vertaalt een door het MAEC benoemde beëdigd vertaler Nederlands-Spaans.",
  },
  {
    question: "Wat kost een beëdigde vertaling Nederlands-Spaans?",
    answer:
      "Vanaf € 40 exclusief btw per document. De definitieve prijs hangt af van de omvang en het type document; je krijgt een vaste prijs in de offerte en betaalt pas nadat je die hebt ontvangen en geaccepteerd.",
  },
  {
    question: "Hoe lang duurt een beëdigde vertaling Nederlands-Spaans?",
    answer:
      "De beëdigd vertaler bevestigt de levertijd in de offerte, normaal gesproken dezelfde dag. De vertaling ontvang je als digitaal ondertekende pdf, of op papier per koerier als de instantie dat vraagt. Uitgebreide dossiers vragen meer tijd, afhankelijk van de omvang.",
  },
  {
    question: "Heb ik een apostille nodig voor mijn Nederlandse of Belgische document?",
    answer:
      "Dat hangt af van het document en van de instantie in Spanje. Nederland en België zijn beide partij bij het Apostilleverdrag van Den Haag (1961), net als Spanje. De apostille hoort bij het originele document, niet bij de vertaling, en wordt geplaatst door de bevoegde autoriteit in het land van uitgifte. Vraag bij de Spaanse instantie of zij een apostille verlangen. Lijst van verdragsstaten: " +
      HCCH_URL +
      ".",
  },
  {
    question: "Welke Nederlandse documenten laten mensen het vaakst vertalen voor Spanje?",
    answer:
      "Meestal een uittreksel uit de Basisregistratie Personen (BRP), een geboorteakte of huwelijksakte, een diploma met cijferlijst en een Verklaring omtrent het Gedrag (VOG). Ze worden gebruikt voor verblijf, huwelijk, nationaliteit, studie of werk in Spanje.",
  },
];

const DOCUMENTEN: [string, string][] = [
  ["Uittreksel BRP (Basisregistratie Personen)", "Verblijf, woonplaats, gezinssamenstelling"],
  ["Geboorteakte / huwelijksakte", "Huwelijk, nationaliteit, erfenis, verblijf"],
  ["Diploma en cijferlijst", "Studie of erkenning van je opleiding"],
  ["VOG (Verklaring omtrent het Gedrag)", "Verblijf of werk (Spaans: antecedentes penales)"],
];

const STAPPEN = [
  { name: "Upload je document", text: "Sla het document als pdf op of maak een foto met je telefoon en upload het via onze aanvraagpagina." },
  { name: "Ontvang je offerte", text: "De beëdigd vertaler bekijkt het document en bevestigt prijs en levertijd in een offerte." },
  { name: "Betaal en ontvang de vertaling", text: "Na betaling ontvang je de beëdigde vertaling als digitaal ondertekende pdf, of op papier per koerier." },
];

export default function BeedigdeVertalingSpanjePage() {
  return (
    <main lang="nl" className="min-h-screen bg-parchment">
      <SchemaBreadcrumbs
        id="breadcrumbs-nl"
        items={[
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Beëdigde vertaling Spanje", url: URL_NL },
        ]}
      />
      <SchemaService
        id="schema-service-nl"
        serviceName="Beëdigde vertaling Nederlands-Spaans (traducción jurada)"
        serviceDescription="Beëdigde vertaling van Nederlandse en Belgische documenten voor gebruik in Spanje, door een door het Spaanse MAEC benoemde vertaler."
        serviceUrl={URL_NL}
      />
      <SchemaFAQ id="schema-faq-nl" items={FAQ} />
      <SchemaHowTo
        id="schema-howto-nl"
        name="Een beëdigde vertaling voor Spanje aanvragen"
        description="Upload je document, ontvang een offerte met vaste prijs en betaal online."
        steps={STAPPEN}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
        <h1 className="font-baskerville text-3xl font-bold text-encre sm:text-4xl">
          Beëdigde vertaling voor Spanje: officieel geldig bij Spaanse instanties
        </h1>
        <p className="mt-3 text-base font-medium leading-relaxed text-encre">
          Een beëdigde vertaling (<em>traducción jurada</em>) is de officiële vertaling van een document, ondertekend en
          gestempeld door een vertaler die door het Spaanse ministerie van Buitenlandse Zaken (MAEC) is benoemd. Voor
          Nederlands-Spaans betaal je vanaf € 40 excl. btw per document; de beëdigd vertaler bevestigt de definitieve prijs
          en de levertijd in de offerte, normaal gesproken dezelfde dag.
        </p>
        <p className="mt-3 text-xs text-sepia">
          <time dateTime={PORTADAS_UPDATED}>Bijgewerkt op 29 september 2026</time>
          {" · "}
          <a href={MAEC_TRADUCTORES_URL} className="underline" rel="noopener">
            Bron: MAEC, beëdigde vertalers en tolken
          </a>
        </p>
        <Link
          href="/presupuesto-instantaneo"
          className="mt-5 inline-block rounded-xl bg-bleu px-6 py-3 font-semibold text-white shadow-paper hover:opacity-90"
        >
          Offerte aanvragen
        </Link>

        <h2 className="mt-12 font-baskerville text-2xl font-bold text-encre">Wat is een beëdigde vertaling in Spanje?</h2>
        <p className="mt-3 text-sepia">
          In Spanje geeft het MAEC de titel <em>traductor jurado</em> aan vertalers. Hun vertalingen hebben volgens het
          ministerie een officieel karakter en kunnen worden ingediend bij rechterlijke en administratieve instanties. De
          vertaler bevestigt met een verklaring en zijn stempel dat de vertaling getrouw is. Welke vorm de instantie
          precies verlangt (pdf of papier, origineel erbij), verschilt per loket: vraag dat na bij de instantie die het
          document ontvangt.
        </p>

        <h2 className="mt-10 font-baskerville text-2xl font-bold text-encre">Welke documenten laat je meestal vertalen?</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-cream bg-card shadow-paper">
          <table className="w-full text-left text-sm text-sepia">
            <thead className="bg-cream text-encre">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Document</th>
                <th scope="col" className="px-4 py-2 font-semibold">Waarvoor in Spanje</th>
              </tr>
            </thead>
            <tbody>
              {DOCUMENTEN.map(([doc, waarvoor]) => (
                <tr key={doc} className="border-t border-cream">
                  <th scope="row" className="px-4 py-2 font-normal">{doc}</th>
                  <td className="px-4 py-2">{waarvoor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-sepia">
          Belgisch document (uittreksel uit het strafregister, akte uit Vlaanderen of Brussel)? Zie de{" "}
          <Link href="/traduccion-jurada-neerlandes-belgica" className="text-bleu underline">
            pagina over Belgische documenten
          </Link>{" "}
          (in het Spaans).
        </p>

        <h2 className="mt-10 font-baskerville text-2xl font-bold text-encre">Apostille: nodig of niet?</h2>
        <p className="mt-3 text-sepia">
          Nederland en België zijn, net als Spanje, partij bij het Apostilleverdrag van Den Haag van 1961 (zie de{" "}
          <a href={HCCH_URL} className="text-bleu underline" rel="noopener">
            statustabel van de HCCH
          </a>
          ). De apostille hoort bij het originele document en wordt geplaatst door de autoriteit in het land van
          uitgifte, niet door de vertaler. Controleer bij de Spaanse instantie welke eis voor jouw document geldt.
        </p>

        <h2 className="mt-10 font-baskerville text-2xl font-bold text-encre">Prijs en levertijd</h2>
        <p className="mt-3 text-sepia">
          Vanaf € 40 excl. btw per document. Je ontvangt een offerte met vaste prijs en levertijd voordat je betaalt. De
          vertaling komt als digitaal ondertekende pdf, of op papier per koerier.
        </p>

        <h2 className="mt-10 font-baskerville text-2xl font-bold text-encre">Zo vraag je een beëdigde vertaling aan</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sepia">
          {STAPPEN.map((s) => (
            <li key={s.name}>
              <strong className="text-encre">{s.name}.</strong> {s.text}
            </li>
          ))}
        </ol>
        <Link
          href="/presupuesto-instantaneo"
          className="mt-5 inline-block rounded-xl bg-bleu px-6 py-3 font-semibold text-white shadow-paper hover:opacity-90"
        >
          Naar de aanvraagpagina
        </Link>

        <h2 className="mt-12 font-baskerville text-2xl font-bold text-encre">Veelgestelde vragen</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((f) => (
            <details key={f.question} className="rounded-xl border border-cream bg-card p-4 shadow-paper">
              <summary className="cursor-pointer font-semibold text-encre">{f.question}</summary>
              <p className="mt-2 text-sm text-sepia">{f.answer}</p>
            </details>
          ))}
        </div>

        <p className="mt-10 text-sm text-sepia">
          Deze pagina in het Spaans:{" "}
          <Link href="/traductor-jurado-neerlandes" className="text-bleu underline">
            Traductor jurado de neerlandés
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
