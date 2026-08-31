import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";

// Nicho GSC 31-ago-2026: "traducción jurada neerlandés bélgica" (pos 9,4),
// "traductor jurado holandés bélgica" (11,7), "traducción documentos notariales
// neerlandés" (11,3) — demanda medida sin página propia. Doctrina 31-ago: NO se
// promete precio al instante fuera del francés; se promete la valoración
// personal del traductor jurado.

const FAQ_ITEMS = [
  {
    question: "¿Un documento belga en neerlandés vale en España con traducción jurada?",
    answer:
      "Sí. Un documento belga redactado en neerlandés (acta de nacimiento, extracto del registro de penales, diploma…) se presenta en España con traducción jurada firmada y sellada por un traductor jurado de neerlandés nombrado por el MAEC, que es la traducción con validez oficial ante la administración española.",
  },
  {
    question: "¿Los documentos belgas necesitan apostilla para usarse en España?",
    answer:
      "Depende del documento. Bélgica y España son Estados miembros de la UE, y el Reglamento (UE) 2016/1191 exime de apostilla a muchos documentos públicos entre países de la Unión (estado civil, residencia, antecedentes penales, entre otros). Los documentos notariales y mercantiles quedan fuera de esa exención y suelen requerir la apostilla de La Haya. Ante la duda, confirma el requisito con el organismo que recibirá el documento; al valorar tu caso te lo indicamos.",
  },
  {
    question: "¿Traducen escrituras y poderes notariales en neerlandés?",
    answer:
      "Sí: escrituras, poderes notariales, actas de notario belgas o neerlandesas, testamentos y documentación de herencias. Son documentos extensos y con terminología jurídica, por eso no se tarifican de forma automática: un traductor jurado revisa el documento y recibes un presupuesto cerrado antes de decidir.",
  },
  {
    question: "¿El neerlandés de Bélgica (flamenco) es el mismo que el de Países Bajos?",
    answer:
      "Es la misma lengua oficial con variantes propias. Un traductor jurado de neerlandés habilitado por el MAEC cubre tanto documentos belgas como neerlandeses; lo relevante es la práctica con la terminología administrativa de cada país, que nuestros jurados manejan a diario.",
  },
  {
    question: "¿Y si mi documento belga está en francés?",
    answer:
      "Bélgica tiene tres lenguas oficiales: neerlandés, francés y alemán. Si tu documento belga está redactado en francés, lo traduce nuestro traductor jurado de francés (nº 3850), con presupuesto cerrado al instante.",
  },
];

export const metadata: Metadata = {
  title: "Traducción Jurada de Neerlandés para Bélgica | Traducciones Juradas",
  description:
    "Traducción jurada de neerlandés para documentos belgas: actas, penales, diplomas, escrituras notariales. Traductor jurado MAEC. Un jurado valora tu documento y tu presupuesto.",
  alternates: { canonical: "/traduccion-jurada-neerlandes-belgica" },
  openGraph: {
    title: "Traducción jurada de neerlandés para Bélgica",
    description:
      "Documentos belgas en neerlandés para España, y documentos españoles para Bélgica. Atención personalizada: un traductor jurado valora tu documento y tu presupuesto.",
    url: "https://www.traduccionesjuradas.net/traduccion-jurada-neerlandes-belgica",
    siteName: "Traducciones Juradas",
    locale: "es_ES",
    type: "website",
  },
};

export default function TraduccionJuradaNeerlandesBelgicaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        serviceName="Traducción jurada de neerlandés para Bélgica"
        serviceDescription="Traducción jurada de documentos belgas en neerlandés (actas del registro civil, extractos de penales, diplomas, escrituras y poderes notariales) por traductor jurado nombrado por el MAEC, y de documentos españoles para su uso en Bélgica."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-neerlandes-belgica"
      />
      <SchemaFAQ items={FAQ_ITEMS} />
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Traductor jurado de neerlandés", url: "https://www.traduccionesjuradas.net/traductor-jurado-neerlandes" },
          { name: "Neerlandés para Bélgica", url: "https://www.traduccionesjuradas.net/traduccion-jurada-neerlandes-belgica" },
        ]}
      />

      {/* Hero */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Traductor jurado de neerlandés · Bélgica
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de neerlandés para documentos belgas
        </h1>
        <p className="mt-4 text-lg text-sepia">
          Actas de nacimiento y matrimonio, extractos del registro de penales, diplomas, escrituras y
          poderes notariales de Bélgica, traducidos al español por un traductor jurado nombrado por el
          MAEC — y documentos españoles preparados para presentarse ante organismos belgas. Atención
          personalizada: un traductor jurado valora tu documento y tu presupuesto.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-xl bg-bleu px-5 py-3 text-sm font-semibold text-white hover:bg-bleu/90"
          >
            Subir mi documento
          </Link>
          <Link
            href="/traductor-jurado-neerlandes"
            className="rounded-xl border border-bleu/40 px-5 py-3 text-sm font-semibold text-bleu hover:bg-bleu/5"
          >
            Ver traducción jurada de neerlandés
          </Link>
        </div>
      </header>

      {/* Flandes, Bruselas y las tres lenguas de Bélgica */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold text-encre">El neerlandés belga: Flandes y Bruselas</h2>
        <p className="mt-3 text-sepia">
          Bélgica tiene tres lenguas oficiales: neerlandés, francés y alemán. Los documentos emitidos en
          Flandes y buena parte de los de Bruselas llegan redactados en neerlandés — a veces llamado
          flamenco. Para surtir efectos ante una administración española (extranjería, registro civil,
          universidad, notaría o juzgado), necesitan traducción jurada de un traductor de neerlandés
          habilitado por el Ministerio de Asuntos Exteriores español.
        </p>
        <p className="mt-3 text-sepia">
          ¿Tu documento belga está en francés? Lo cubre nuestro{" "}
          <Link href="/traductor-jurado-frances" className="font-semibold text-bleu hover:underline">
            traductor jurado de francés
          </Link>{" "}
          (nº 3850), con precio cerrado al instante.
        </p>
      </section>

      {/* Documentos habituales */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold text-encre">Documentos belgas que traducimos a diario</h2>
        <ul className="mt-4 space-y-3 text-sepia">
          <li>
            <strong className="text-encre">Registro civil:</strong> akte van geboorte (acta de
            nacimiento), huwelijksakte (matrimonio), echtscheidingsakte (divorcio) y attest van woonst
            (empadronamiento) para extranjería, matrimonio o nacionalidad en España.
          </li>
          <li>
            <strong className="text-encre">Uittreksel uit het strafregister:</strong> el extracto del
            registro de penales belga, imprescindible en solicitudes de residencia y nacionalidad.
          </li>
          <li>
            <strong className="text-encre">Diplomas y expedientes:</strong> títulos, cijferlijsten y
            certificados de estudios flamencos para homologación o acceso a estudios en España.
          </li>
          <li>
            <strong className="text-encre">Documentos notariales:</strong> escrituras, poderes, actas de
            notario y testamentos — el corazón de compraventas, herencias y constitución de sociedades
            entre Bélgica y España.
          </li>
        </ul>
      </section>

      {/* Documentos notariales — la consulta con nicho propio */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold text-encre">
          Traducción jurada de documentos notariales en neerlandés
        </h2>
        <p className="mt-3 text-sepia">
          Las escrituras y poderes notariales belgas y neerlandeses combinan fórmulas jurídicas propias
          del notariado latino con terminología local. Un error de matiz en un poder o en una cláusula
          testamentaria tiene consecuencias reales, por eso estos documentos no se tarifican de forma
          automática: los revisa personalmente un traductor jurado con experiencia jurídica, que valora
          extensión y complejidad y te envía un presupuesto cerrado con su nombre y su número oficial
          antes de que decidas.
        </p>
        <p className="mt-3 text-sepia">
          Sobre la legalización: España y Bélgica son Estados miembros de la UE, y el Reglamento (UE)
          2016/1191 exime de apostilla a muchos documentos públicos entre países de la Unión — pero los
          documentos notariales y mercantiles quedan fuera de esa exención y suelen requerir la
          apostilla de La Haya. Si no sabes qué pide tu trámite, dínoslo al enviar el documento y te lo
          aclaramos con la valoración.
        </p>
      </section>

      {/* Proceso */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold text-encre">Cómo funciona</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sepia">
          <li>Sube tu documento escaneado o fotografiado por la web.</li>
          <li>
            Un traductor jurado de neerlandés lo valora personalmente y recibes el presupuesto cerrado,
            con su nombre y su número oficial.
          </li>
          <li>
            Al aceptarlo, esa misma persona firma y sella tu traducción: la recibes en PDF con firma
            digital o en papel por mensajería. Los certificados sencillos suelen entregarse en 24-72
            horas laborables.
          </li>
        </ol>
      </section>

      {/* FAQ */}
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold text-encre">Preguntas frecuentes</h2>
        <div className="mt-4 space-y-5">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <h3 className="font-semibold text-encre">{item.question}</h3>
              <p className="mt-1 text-sepia">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mt-12 rounded-2xl border border-bleu/30 bg-bleu/5 p-6">
        <h2 className="text-xl font-bold text-encre">Empieza con tu documento belga</h2>
        <p className="mt-2 text-sepia">
          Sube el documento y un traductor jurado de neerlandés te prepara el presupuesto. Sin
          compromiso: primero la valoración, después decides.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-xl bg-bleu px-5 py-3 text-sm font-semibold text-white hover:bg-bleu/90"
          >
            Subir mi documento
          </Link>
          <Link
            href="/documentos-oficiales"
            className="rounded-xl border border-bleu/40 px-5 py-3 text-sm font-semibold text-bleu hover:bg-bleu/5"
          >
            Ver tipos de documento
          </Link>
        </div>
      </section>
    </main>
  );
}
