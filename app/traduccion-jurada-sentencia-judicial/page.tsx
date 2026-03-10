import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducci\u00F3n Jurada de Sentencia Judicial \u00B7 Franc\u00E9s\u2194Espa\u00F1ol \u00B7 MAEC n\u00BA 3850",
  description:
    "Traducci\u00F3n jurada de sentencias judiciales extranjeras para su reconocimiento en Espa\u00F1a. Traductor jurado oficial MAEC n\u00BA 3850. Franc\u00E9s, ingl\u00E9s, alem\u00E1n. Presupuesto personalizado.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-sentencia-judicial",
  },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFQu\u00E9 tipo de sentencias se pueden traducir de forma jurada?",
    answer:
      "Cualquier sentencia judicial extranjera: divorcios, custodias, condenas, sentencias civiles, mercantiles, penales y laborales. Tambi\u00E9n autos y providencias judiciales.",
  },
  {
    question: "\u00BFNecesito apostillar la sentencia antes de traducirla?",
    answer:
      "S\u00ED, para el reconocimiento en Espa\u00F1a (exequ\u00E1tur), la sentencia debe ir apostillada o legalizada seg\u00FAn el pa\u00EDs de origen. La apostilla se traduce junto con la sentencia.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta traducir una sentencia judicial?",
    answer:
      "El precio depende de la extensi\u00F3n del documento. Las sentencias suelen ser documentos extensos (5-30 p\u00E1ginas). Env\u00EDanos el documento para un presupuesto exacto.",
  },
  {
    question: "\u00BFCu\u00E1nto tarda la traducci\u00F3n jurada de una sentencia?",
    answer:
      "El plazo depende de la extensi\u00F3n. Una sentencia breve (2-5 p\u00E1ginas) puede estar lista en 48-72h. Documentos m\u00E1s extensos pueden requerir una semana.",
  },
];

export default function TraduccionJuradaSentenciaJudicialPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-sentencia-judicial"
        serviceName="Traducci\u00F3n jurada de sentencia judicial"
        serviceDescription="Traducci\u00F3n jurada oficial de sentencias judiciales extranjeras para procedimientos de exequ\u00E1tur y reconocimiento en Espa\u00F1a."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-sentencia-judicial"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Ling\u00FC\u00EDsticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC n\u00BA 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-sentencia-judicial"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducci\u00F3n jurada sentencia judicial",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-sentencia-judicial",
          },
        ]}
      />
      <SchemaFAQ id="faq-sentencia-judicial" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Sentencia judicial
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducci\u00F3n jurada de sentencia judicial
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Las sentencias judiciales extranjeras necesitan <strong>traducci\u00F3n jurada</strong>{" "}
          para ser reconocidas por los tribunales espa\u00F1oles. Ya sea una sentencia
          de divorcio, una resoluci\u00F3n de custodia o una condena penal, realizamos
          la traducci\u00F3n jurada con la precisi\u00F3n jur\u00EDdica que exige el procedimiento.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFCu\u00E1ndo necesitas traducir una sentencia judicial?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Exequ\u00E1tur</strong> \u2014 reconocimiento de sentencias extranjeras
            ante tribunales espa\u00F1oles.
          </li>
          <li>
            <strong>Divorcios internacionales</strong> \u2014 para inscribir el divorcio
            en el Registro Civil espa\u00F1ol.
          </li>
          <li>
            <strong>Custodias y reg\u00EDmenes de visitas</strong> \u2014 para ejecutar
            resoluciones extranjeras en Espa\u00F1a.
          </li>
          <li>
            <strong>Procedimientos penales</strong> \u2014 para acreditar antecedentes
            o condenas en otro pa\u00EDs.
          </li>
          <li>
            <strong>Herencias internacionales</strong> \u2014 sentencias de adjudicaci\u00F3n
            o declaraci\u00F3n de herederos.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precio de la traducci\u00F3n
        </h2>
        <p className="mt-2 text-sepia">
          Las sentencias judiciales suelen ser documentos extensos con terminolog\u00EDa
          jur\u00EDdica especializada. El precio se calcula por volumen y complejidad:
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Sentencia breve (1-5 p\u00E1ginas):</strong> desde 60 \u20AC
          </li>
          <li>
            <strong>Sentencia media (5-15 p\u00E1ginas):</strong> desde 120 \u20AC
          </li>
          <li>
            <strong>Sentencia extensa (15+ p\u00E1ginas):</strong> presupuesto personalizado
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          Env\u00EDanos el documento para recibir un presupuesto exacto y cerrado.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Idiomas m\u00E1s frecuentes
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Franc\u00E9s</strong> \u2014 sentencias de tribunales franceses y
            marroqu\u00EDes, especialmente divorcios y custodias.
          </li>
          <li>
            <strong>Ingl\u00E9s</strong> \u2014 sentencias de tribunales brit\u00E1nicos y
            estadounidenses.
          </li>
          <li>
            <strong>Alem\u00E1n</strong> \u2014 resoluciones de tribunales de Alemania,
            Austria y Suiza.
          </li>
          <li>
            <strong>Otros idiomas</strong> \u2014 italiano, portugu\u00E9s, neerland\u00E9s, rumano.
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          \u00BFNecesitas traducir una sentencia judicial?
        </h2>
        <p className="mt-1 text-encre">
          Env\u00EDanos la sentencia en PDF o foto clara y te damos presupuesto cerrado
          con plazo de entrega. Traducci\u00F3n con precisi\u00F3n jur\u00EDdica.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </section>

      <p className="mt-6 text-xs text-sepia">
        Ver tambi\u00E9n:{" "}
        <Link
          href="/documentos-oficiales/documentos-juridicos"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos jur\u00EDdicos
        </Link>
        {" \u00B7 "}
        <Link
          href="/traductor-jurado-frances"
          className="font-semibold text-bleu hover:underline"
        >
          Traductor jurado de franc\u00E9s
        </Link>
      </p>
    </main>
  );
}
