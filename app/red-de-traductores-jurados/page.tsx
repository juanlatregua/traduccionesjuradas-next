import type { Metadata } from "next";
import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title: "Red directa de traductores jurados | Sin intermediarios",
  description:
    "Tu documento va directo al traductor jurado de tu idioma, con su nombre y nº MAEC en el presupuesto. Red de 70 traductores e intérpretes jurados en 27 lenguas, sin cadenas de agencias.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/red-de-traductores-jurados" },
};

const FAQ_ITEMS = [
  {
    question: "¿Quién traduce mi documento?",
    answer:
      "Un traductor-intérprete jurado nombrado por el Ministerio de Asuntos Exteriores (MAEC) para tu combinación de idiomas. Su nombre y su número oficial aparecen en tu presupuesto antes de pagar, y es esa misma persona quien firma y sella tu traducción.",
  },
  {
    question: "¿Qué es la red directa de traductores jurados?",
    answer:
      "Es una red profesional de 70 traductores e intérpretes que cubre 27 lenguas, coordinada por HBTJ Consultores Lingüísticos desde Málaga. Cuando llega tu documento, lo ve directamente el jurado de tu idioma — sin subcontratas en cadena ni agencias intermedias que encarecen y despersonalizan el encargo.",
  },
  {
    question: "¿Por qué es mejor que una agencia tradicional?",
    answer:
      "Porque sabes quién traduce: nombre y nº MAEC en el presupuesto. El precio lo pone el propio traductor que hará el trabajo, el documento viaja directo a sus manos y la entrega vuelve por el mismo camino. Menos eslabones significa más rapidez, mejor precio y un responsable con nombre y apellidos.",
  },
  {
    question: "¿La traducción jurada es válida oficialmente?",
    answer:
      "Sí. Toda traducción entregada por la red la firma y sella un traductor-intérprete jurado habilitado por el MAEC, con plena validez ante cualquier organismo español. En idiomas donde el organismo de destino exige papel (por ejemplo, el rumano), se entrega el original físico por mensajería.",
  },
  {
    question: "¿Qué idiomas cubre la red?",
    answer:
      "27 lenguas de trabajo, entre ellas francés, inglés, alemán, portugués, italiano, rumano, árabe, sueco, noruego y neerlandés. Si tu combinación es poco frecuente, consúltanos: la red crece cada semana con nuevos jurados.",
  },
];

export default function RedDirectaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-red"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Red directa de traductores jurados", url: "https://www.traduccionesjuradas.net/red-de-traductores-jurados" },
        ]}
      />
      <SchemaFAQ items={FAQ_ITEMS} id="faq-red-directa" />
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Red directa", href: "/red-de-traductores-jurados" },
        ]}
      />

      {/* TESIS */}
      <header className="mt-4 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Cómo trabajamos</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Tu documento va directo al traductor jurado — con su nombre y su nº MAEC en tu presupuesto
        </h1>
        <p className="mt-4 text-base text-sepia">
          Sin cadenas de agencias ni subcontratas opacas: el jurado de tu idioma ve tu documento,
          pone su precio y firma tu traducción. Tú sabes desde el primer momento quién responde por tu encargo.
        </p>
      </header>

      {/* CIFRAS */}
      <section className="mt-8 grid grid-cols-3 gap-3 sm:gap-4" aria-label="La red en cifras">
        {[
          { n: "70", label: "traductores e intérpretes" },
          { n: "27", label: "lenguas de trabajo" },
          { n: "MAEC", label: "todos nombrados por el Ministerio" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-cream bg-card p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-bleu sm:text-3xl">{item.n}</p>
            <p className="mt-1 text-xs text-sepia sm:text-sm">{item.label}</p>
          </div>
        ))}
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-encre sm:text-2xl">Cómo funciona</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            {
              t: "Subes tu documento",
              d: "Por la web o WhatsApp. Lo ve directamente el traductor jurado de tu combinación de idiomas — nadie más.",
            },
            {
              t: "El jurado pone su precio",
              d: "Recibes el presupuesto con el nombre y el nº MAEC de quien hará tu traducción. Sin sorpresas ni reasignaciones.",
            },
            {
              t: "Él firma, tú recibes",
              d: "La traducción llega firmada y sellada por ese mismo jurado: PDF con firma digital o papel por mensajería si tu trámite lo exige.",
            },
          ].map((step, i) => (
            <li key={step.t} className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-bleu">Paso {i + 1}</p>
              <h3 className="mt-1 font-semibold text-encre">{step.t}</h3>
              <p className="mt-1 text-sm text-sepia">{step.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Pedir presupuesto ahora
          </Link>
          <Link
            href="/traductores-jurados"
            className="rounded-xl border border-bleu px-5 py-2.5 text-sm font-semibold text-bleu hover:bg-cream"
          >
            Conocer al equipo
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-encre sm:text-2xl">Preguntas frecuentes</h2>
        <div className="mt-4 space-y-3">
          {FAQ_ITEMS.map((qa) => (
            <details key={qa.question} className="group rounded-2xl border border-cream bg-card p-4 shadow-sm">
              <summary className="cursor-pointer font-semibold text-encre marker:text-bleu">
                {qa.question}
              </summary>
              <p className="mt-2 text-sm text-sepia">{qa.answer}</p>
            </details>
          ))}
        </div>
      </section>

    </main>
  );
}
