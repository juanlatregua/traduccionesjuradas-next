import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducci\u00F3n Jurada de Escritura Notarial \u00B7 Franc\u00E9s\u2194Espa\u00F1ol \u00B7 Desde 35\u20AC",
  description:
    "Traducci\u00F3n jurada de escrituras notariales: compraventas, poderes notariales, testamentos y capitulaciones. Traductor jurado oficial MAEC n\u00BA 3850. Entrega en PDF firmado.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-de-escritura-notarial",
  },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFQu\u00E9 escrituras notariales necesitan traducci\u00F3n jurada?",
    answer:
      "Cualquier escritura notarial extranjera que deba surtir efecto en Espa\u00F1a: compraventas de inmuebles, poderes notariales, testamentos, capitulaciones matrimoniales, constituciones de sociedad y actas notariales.",
  },
  {
    question: "\u00BFNecesito apostillar la escritura antes de traducirla?",
    answer:
      "S\u00ED, las escrituras notariales extranjeras deben ir apostilladas (pa\u00EDses del Convenio de La Haya) o legalizadas por v\u00EDa consular. La apostilla se traduce junto con la escritura.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta traducir una escritura notarial?",
    answer:
      "El precio depende de la extensi\u00F3n. Una escritura de compraventa t\u00EDpica (5-10 p\u00E1ginas) cuesta desde 80-150 \u20AC. Env\u00EDa el documento para un presupuesto exacto.",
  },
  {
    question: "\u00BFSe necesita traducci\u00F3n jurada de un poder notarial franc\u00E9s?",
    answer:
      "S\u00ED, para que un poder notarial otorgado en Francia surta efecto ante un notario o registro espa\u00F1ol, necesita traducci\u00F3n jurada y apostilla.",
  },
];

export default function TraduccionJuradaEscrituraNotarialPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-escritura-notarial"
        serviceName="Traducci\u00F3n jurada de escritura notarial"
        serviceDescription="Traducci\u00F3n jurada oficial de escrituras notariales extranjeras: compraventas, poderes, testamentos y capitulaciones. Traductor jurado MAEC n\u00BA 3850."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-de-escritura-notarial"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Ling\u00FC\u00EDsticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC n\u00BA 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-escritura-notarial"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducci\u00F3n jurada escritura notarial",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-de-escritura-notarial",
          },
        ]}
      />
      <SchemaFAQ id="faq-escritura-notarial" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Escritura notarial
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducci\u00F3n jurada de escritura notarial
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Las escrituras notariales extranjeras \u2014 compraventas, poderes, testamentos,
          capitulaciones matrimoniales \u2014 necesitan <strong>traducci\u00F3n jurada</strong>{" "}
          para surtir efecto ante notarios, registros de la propiedad y tribunales
          espa\u00F1oles. Traducci\u00F3n firmada por traductor jurado oficial MAEC n\u00BA 3850.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Tipos de escrituras notariales que traducimos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Escrituras de compraventa</strong> \u2014 inmuebles comprados o vendidos
            en Francia, Alemania, B\u00E9lgica, etc.
          </li>
          <li>
            <strong>Poderes notariales</strong> \u2014 procurations y mandatos generales o
            especiales.
          </li>
          <li>
            <strong>Testamentos</strong> \u2014 testamentos abiertos, cerrados y ol\u00F3grafos
            otorgados ante notario extranjero.
          </li>
          <li>
            <strong>Capitulaciones matrimoniales</strong> \u2014 r\u00E9gimen econ\u00F3mico
            pactado ante notario.
          </li>
          <li>
            <strong>Constituciones de sociedad</strong> \u2014 actas de constituci\u00F3n y
            estatutos ante notario extranjero.
          </li>
          <li>
            <strong>Actas notariales</strong> \u2014 actas de notoriedad, de manifestaciones
            y de presencia.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios orientativos
        </h2>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Poder notarial (1-3 p\u00E1ginas):</strong> desde 45 \u20AC
          </li>
          <li>
            <strong>Escritura de compraventa (5-10 p\u00E1ginas):</strong> desde 80 \u20AC
          </li>
          <li>
            <strong>Testamento (3-8 p\u00E1ginas):</strong> desde 60 \u20AC
          </li>
          <li>
            <strong>Capitulaciones matrimoniales:</strong> desde 60 \u20AC
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          El precio definitivo depende del idioma, la extensi\u00F3n y la complejidad del
          documento. Env\u00EDanos el documento para un presupuesto exacto.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFPara qu\u00E9 tr\u00E1mites se necesita?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Registro de la Propiedad</strong> \u2014 inscripci\u00F3n de inmuebles
            adquiridos en el extranjero.
          </li>
          <li>
            <strong>Notar\u00EDa espa\u00F1ola</strong> \u2014 para hacer valer un poder
            notarial extranjero.
          </li>
          <li>
            <strong>Herencias internacionales</strong> \u2014 presentaci\u00F3n de testamentos
            y adjudicaciones ante el notario espa\u00F1ol.
          </li>
          <li>
            <strong>Registro Mercantil</strong> \u2014 para inscribir sociedades
            extranjeras o sus sucursales.
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          \u00BFNecesitas traducir una escritura notarial?
        </h2>
        <p className="mt-1 text-encre">
          Env\u00EDanos la escritura en PDF o foto clara y te damos presupuesto cerrado
          con plazo de entrega.
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
          href="/documentos-oficiales/documentos-mercantiles"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos mercantiles
        </Link>
      </p>
    </main>
  );
}
