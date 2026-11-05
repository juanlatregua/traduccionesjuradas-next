import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";
import Link from "next/link";
import { SchemaPerson } from "@/components/SchemaPerson";
import {
  PAGE_PRICE_EUR,
  FR_DOC_2P_EUR,
  FR_DOC_LONG_EUR,
  FR_DOC_LONG_WORDS,
  APOSTILLE_EXTRA_EUR,
  FR_BANK_DOC_EUR,
} from "@/lib/pricing-engine/page-pricing";
import { PER_WORD_RATE } from "@/lib/pricing-engine/languages";

const MAEC_URL =
  "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Oficina-de-Interpretacion-de-Lenguas/Paginas/Traduccion-e-interpretacion-jurada.aspx";

const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: n % 1 ? 2 : 0 })} €`;

const PRECIOS: { doc: string; precio: string }[] = [
  { doc: "Documento de 1 página (acte de naissance, mariage, casier judiciaire, diplôme…)", precio: eur(PAGE_PRICE_EUR) },
  { doc: "Documento de 2 páginas", precio: eur(FR_DOC_2P_EUR) },
  { doc: `Documento de hasta 2 páginas con más de ${FR_DOC_LONG_WORDS} palabras`, precio: eur(FR_DOC_LONG_EUR) },
  { doc: "Apostilla en el documento", precio: `+${eur(APOSTILLE_EXTRA_EUR)}` },
  { doc: "Extracto bancario", precio: `${eur(FR_BANK_DOC_EUR)} por documento` },
  { doc: "Contratos, poderes, sentencias y textos largos", precio: `desde ${PER_WORD_RATE.fr.toLocaleString("es-ES")} €/palabra` },
];

function SeccionesFrances() {
  return (
    <>
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">Precio y plazo de la traducción jurada de francés</h2>
        <div className="mt-4 overflow-hidden rounded-doc border border-cream bg-card shadow-paper">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream/60 text-encre">
              <tr>
                <th className="px-4 py-2 font-semibold">Documento (francés → español)</th>
                <th className="px-4 py-2 font-semibold whitespace-nowrap">Precio + IVA</th>
              </tr>
            </thead>
            <tbody className="text-sepia">
              {PRECIOS.map((r) => (
                <tr key={r.doc} className="border-t border-cream">
                  <td className="px-4 py-2">{r.doc}</td>
                  <td className="px-4 py-2 font-medium text-encre whitespace-nowrap">{r.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-sepia">
          <strong className="text-encre">Plazo:</strong> 1 día hábil hasta 5 páginas, en PDF con firma electrónica
          cualificada. Si lo necesitas en el día, pregúntanos: se puede con un recargo del 40 %. El precio es cerrado y
          lo ves antes de pagar.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-doc border border-cream bg-card p-5 shadow-paper">
          <h2 className="text-lg font-semibold text-encre">Cómo comprobar que un traductor es jurado</h2>
          <p className="mt-2 text-sm text-sepia">
            El Ministerio de Asuntos Exteriores publica el listado oficial de traductores e intérpretes jurados que ha
            nombrado, con su idioma y número. Antes de encargar una traducción jurada, busca el nombre del traductor en
            ese listado: si no aparece, la traducción no será jurada.
          </p>
          <a
            href={MAEC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-bleu hover:underline"
          >
            Listado oficial del MAEC →
          </a>
        </div>
        <div className="rounded-doc border border-cream bg-card p-5 shadow-paper">
          <h2 className="text-lg font-semibold text-encre">Quién firma tu traducción</h2>
          <p className="mt-2 text-sm text-sepia">
            <strong className="text-encre">Juan Silva Moreno</strong>, traductor jurado de francés nombrado por el
            Ministerio de Asuntos Exteriores con el <strong className="text-encre">nº 3850</strong>. Las traducciones de
            francés las hace y las firma él mismo, sin intermediarios.
          </p>
          <Link href="/acreditacion" className="mt-3 inline-block text-sm font-medium text-bleu hover:underline">
            Ver la acreditación →
          </Link>
        </div>
      </section>
    </>
  );
}

export const metadata: Metadata = {
  title: { absolute: "Traductor jurado de franc\u00E9s \u00B7 MAEC n\u00BA 3850 \u00B7 desde 30 \u20AC" },
  description:
    "Traductor jurado de franc\u00E9s oficial (MAEC n\u00BA 3850). Traducci\u00F3n jurada franc\u00E9s-espa\u00F1ol y espa\u00F1ol-franc\u00E9s. Documentos legales, antecedentes penales, t\u00EDtulos acad\u00E9micos. Traducci\u00F3n jurada de franc\u00E9s: 30\u20AC + IVA por p\u00E1gina.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+franc%C3%A9s&subtitle=Traducci%C3%B3n+jurada+oficial+FR+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de francés — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoFrancesPage() {
  return (
    <>
      <SchemaPerson id="schema-person-frances" />
      <PaginaIdioma
      idioma="francés"
      idiomaSlug="frances"
      combinaciones={["fr-es", "es-fr"]}
      updated="2026-11-05"
      extra={<SeccionesFrances />}
      tituloH1="Traductor jurado de francés: traducción oficial para España y países francófonos"
      descripcion="Traductor jurado de francés nº 3850, nombrado por el MAEC: traducción jurada francés↔español con validez oficial en toda España y reconocida en países francófonos. Es el formato que te piden cuando un documento en francés debe presentarse ante una administración, notaría, universidad o juzgado en España, o cuando un documento español se utiliza en Francia. Precio cerrado, plazo estimado y entrega en PDF firmado digitalmente por un traductor jurado acreditado por el MAEC."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de francés en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta traducir un certificado en francés?",
          answer:
            "Un documento de 1 página (acta de nacimiento, matrimonio, antecedentes penales, título) cuesta 30 € + IVA y uno de 2 páginas, 35 € + IVA; si lleva apostilla, +5 €. Los contratos, poderes, sentencias y textos largos se presupuestan por palabra, desde 0,08 €. Sube tu documento y recibes el precio cerrado al instante.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de francés?",
          answer:
            "En 1 día hábil para documentos de hasta 5 páginas, en PDF con firma electrónica cualificada. Si lo necesitas en el día, se puede con un recargo del 40 %.",
        },
        {
          question: "¿Necesito apostillar la traducción jurada de francés?",
          answer:
            "La apostilla se pone al documento original, no a la traducción. Entre países de la UE, como Francia y España, el Reglamento (UE) 2016/1191 exime de apostilla a muchos documentos públicos (nacimiento, matrimonio, antecedentes penales…). Para documentos de fuera de la UE depende del país: te orientamos según tu caso.",
        },
        {
          question: "¿Qué documentos franceses se traducen con más frecuencia?",
          answer:
            "Los más habituales son: acte de naissance (certificado de nacimiento), acte de mariage (matrimonio), extrait de casier judiciaire (antecedentes penales / Bulletin nº3), diplômes et relevés de notes (títulos académicos), contrats de travail y fiches de paie (documentos laborales).",
        },
        {
          question: "¿Sirve en España una traducción hecha por un traductor de Francia?",
          answer:
            "Para presentarla ante una administración, notaría o juzgado en España, lo que se pide normalmente es una traducción jurada firmada por un traductor jurado nombrado por el Ministerio de Asuntos Exteriores español. Si tienes una traducción hecha en Francia, pregunta antes al organismo si la acepta.",
        },
        {
          question: "¿Qué pasa si presento una traducción que no es jurada?",
          answer:
            "Lo habitual es que el organismo la rechace y tengas que volver a traducir el documento, con el retraso que eso supone en tu trámite. Una traducción jurada lleva la firma y el sello del traductor jurado y una certificación de fidelidad.",
        },
        {
          question: "¿Cómo se comprueba la firma electrónica de la traducción?",
          answer:
            "La traducción en PDF lleva firma electrónica cualificada. Puedes comprobar su validez tú mismo en valide.redsara.es, el servicio de validación del Gobierno de España.",
        },
        {
          question: "¿Puedo recibir la traducción jurada en papel?",
          answer:
            "Sí. Además del PDF firmado digitalmente, podemos enviarte la traducción jurada en papel, con firma y sello originales, por mensajería.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados del Registro Civil",
          descripcion:
            "Actes de naissance, mariage, divorce, décès, certificats de célibat, certificats de coutume y otros documentos del état civil necesarios para extranjería, nacionalidad o herencias.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes penales y buena conducta",
          descripcion:
            "Extrait de casier judiciaire, certificats de bonne conduite u otros documentos exigidos para visados, permisos de residencia, oposiciones o empleo en España.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Diplômes, relevés de notes, attestations de réussite, programas de estudios, certificados de escolaridad y otros documentos necesarios para homologaciones, estudios universitarios y oposiciones.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos mercantiles y laborales",
          descripcion:
            "Contrats de travail, fiches de paie, attestations de salaire, statuts de société, extraits Kbis, procès-verbaux y otros documentos necesarios para trabajar o invertir en España.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
        {
          titulo: "Nacionalidad española para franceses",
          descripcion:
            "Qué documentos traducir y cuáles no para el expediente de nacionalidad española cuando vienes de Francia, con el detalle del casier judiciaire y el acte de naissance.",
          enlace: "/blog/nacionalidad-espanola-para-franceses",
        },
        {
          titulo: "Casarse en España siendo francés",
          descripcion:
            "Documentos franceses para la boda civil en España y por qué el Reglamento UE 2016/1191 exime de Apostilla al acte de naissance y al certificat de coutume.",
          enlace: "/blog/boda-en-espana-documentos-franceses",
        },
        {
          titulo: "Casier judiciaire francés (Bulletin n°3)",
          descripcion:
            "Cómo pedir el extrait de casier judiciaire en Francia y cómo se traduce de forma jurada para extranjería, nacionalidad u oposiciones en España.",
          enlace: "/blog/casier-judiciaire-frances-traduccion",
        },
        {
          titulo: "Documentos marroquíes, argelinos y tunecinos en francés",
          descripcion:
            "Guías por país para quien tramita en España con documentos del Magreb redactados en francés o bilingües: apostilla, legalización consular y traducción jurada.",
          enlace: "/blog/documentos-marroquies-guia-completa",
        },
      ]}
    />
    </>
  );
}
