import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducción Jurada de Sentencia Judicial · Francés↔Español · MAEC nº 3850",
  description:
    "Traducción jurada de sentencias judiciales extranjeras para su reconocimiento en España. Traductor jurado oficial MAEC nº 3850. Francés, inglés, alemán. Presupuesto personalizado.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-sentencia-judicial",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Qué tipo de sentencias se pueden traducir de forma jurada?",
    answer:
      "Cualquier sentencia judicial extranjera: divorcios, custodias, condenas, sentencias civiles, mercantiles, penales y laborales. También autos y providencias judiciales.",
  },
  {
    question: "¿Necesito apostillar la sentencia antes de traducirla?",
    answer:
      "Sí, para el reconocimiento en España (exequátur), la sentencia debe ir apostillada o legalizada según el país de origen. La apostilla se traduce junto con la sentencia.",
  },
  {
    question: "¿Cuánto cuesta traducir una sentencia judicial?",
    answer:
      "El precio depende de la extensión del documento. Las sentencias suelen ser documentos extensos (5-30 páginas). Envíanos el documento para un presupuesto exacto.",
  },
  {
    question: "¿Cuánto tarda la traducción jurada de una sentencia?",
    answer:
      "El plazo depende de la extensión. Una sentencia breve (2-5 páginas) puede estar lista en 48-72h. Documentos más extensos pueden requerir una semana.",
  },
];

export default function TraduccionJuradaSentenciaJudicialPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-sentencia-judicial"
        serviceName="Traducción jurada de sentencia judicial"
        serviceDescription="Traducción jurada oficial de sentencias judiciales extranjeras para procedimientos de exequátur y reconocimiento en España."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-sentencia-judicial"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-sentencia-judicial"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducción jurada sentencia judicial",
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
          Traducción jurada de sentencia judicial
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Las sentencias judiciales extranjeras necesitan <strong>traducción jurada</strong>{" "}
          para ser reconocidas por los tribunales españoles. Ya sea una sentencia
          de divorcio, una resolución de custodia o una condena penal, realizamos
          la traducción jurada con la precisión jurídica que exige el procedimiento.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cuándo necesitas traducir una sentencia judicial?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Exequátur</strong> — reconocimiento de sentencias extranjeras
            ante tribunales españoles.
          </li>
          <li>
            <strong>Divorcios internacionales</strong> — para inscribir el divorcio
            en el Registro Civil español.
          </li>
          <li>
            <strong>Custodias y regímenes de visitas</strong> — para ejecutar
            resoluciones extranjeras en España.
          </li>
          <li>
            <strong>Procedimientos penales</strong> — para acreditar antecedentes
            o condenas en otro país.
          </li>
          <li>
            <strong>Herencias internacionales</strong> — sentencias de adjudicación
            o declaración de herederos.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precio de la traducción
        </h2>
        <p className="mt-2 text-sepia">
          Las sentencias judiciales suelen ser documentos extensos con terminología
          jurídica especializada. El precio se calcula por volumen y complejidad:
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Sentencia breve (1-5 páginas):</strong> desde 60 €
          </li>
          <li>
            <strong>Sentencia media (5-15 páginas):</strong> desde 120 €
          </li>
          <li>
            <strong>Sentencia extensa (15+ páginas):</strong> presupuesto personalizado
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          Envíanos el documento para recibir un presupuesto exacto y cerrado.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Idiomas más frecuentes
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Francés</strong> — sentencias de tribunales franceses y
            marroquíes, especialmente divorcios y custodias.
          </li>
          <li>
            <strong>Inglés</strong> — sentencias de tribunales británicos y
            estadounidenses.
          </li>
          <li>
            <strong>Alemán</strong> — resoluciones de tribunales de Alemania,
            Austria y Suiza.
          </li>
          <li>
            <strong>Otros idiomas</strong> — italiano, portugués, neerlandés, rumano.
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir una sentencia judicial?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos la sentencia en PDF o foto clara y te damos presupuesto cerrado
          con plazo de entrega. Traducción con precisión jurídica.
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
        Ver también:{" "}
        <Link
          href="/documentos-oficiales/documentos-juridicos"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos jurídicos
        </Link>
        {" · "}
        <Link
          href="/traductor-jurado-frances"
          className="font-semibold text-bleu hover:underline"
        >
          Traductor jurado de francés
        </Link>
      </p>
    </main>
  );
}
