import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducci\u00F3n Jurada de Estatutos Sociales \u00B7 Franc\u00E9s\u2194Espa\u00F1ol \u00B7 MAEC",
  description:
    "Traducci\u00F3n jurada de estatutos sociales para Registro Mercantil, constituci\u00F3n de sucursales y tr\u00E1mites notariales. Traductor jurado oficial MAEC n\u00BA 3850. Presupuesto gratis.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-de-estatutos-sociales",
  },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFCu\u00E1ndo necesito traducir los estatutos sociales de una empresa?",
    answer:
      "Para inscribir una sucursal en el Registro Mercantil espa\u00F1ol, constituir una sociedad con socios extranjeros, o presentar documentaci\u00F3n mercantil ante un tribunal o notario en Espa\u00F1a.",
  },
  {
    question: "\u00BFSe necesita apostilla en los estatutos?",
    answer:
      "S\u00ED, los estatutos notariales extranjeros deben ir apostillados o legalizados. La apostilla se traduce conjuntamente con los estatutos.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta traducir unos estatutos sociales?",
    answer:
      "El precio depende de la extensi\u00F3n. Unos estatutos de 10-20 p\u00E1ginas cuestan habitualmente entre 120 y 250 \u20AC. Env\u00EDa el documento para un presupuesto exacto.",
  },
  {
    question: "\u00BFTambi\u00E9n traduc\u00EDs actas de la junta y certificados del Registre du Commerce?",
    answer:
      "S\u00ED, traducimos todos los documentos mercantiles: actas de junta, certificados de registro mercantil (Registre du Commerce), balances y cuentas anuales.",
  },
];

export default function TraduccionJuradaEstatutosSocialesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-estatutos-sociales"
        serviceName="Traducci\u00F3n jurada de estatutos sociales"
        serviceDescription="Traducci\u00F3n jurada oficial de estatutos sociales y documentaci\u00F3n mercantil para Registro Mercantil, notar\u00EDa y tribunales en Espa\u00F1a."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-de-estatutos-sociales"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Ling\u00FC\u00EDsticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC n\u00BA 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-estatutos-sociales"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducci\u00F3n jurada estatutos sociales",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-de-estatutos-sociales",
          },
        ]}
      />
      <SchemaFAQ id="faq-estatutos-sociales" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Estatutos sociales
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducci\u00F3n jurada de estatutos sociales
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Los estatutos sociales de una empresa extranjera necesitan{" "}
          <strong>traducci\u00F3n jurada</strong> para ser v\u00E1lidos ante el Registro Mercantil,
          notar\u00EDas y tribunales espa\u00F1oles. Realizamos la traducci\u00F3n jurada de
          estatutos de cualquier pa\u00EDs, firmada por traductor jurado oficial MAEC
          n\u00BA 3850.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFCu\u00E1ndo se necesita traducir los estatutos sociales?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Inscripci\u00F3n de sucursal</strong> \u2014 para registrar una sucursal
            de empresa extranjera en el Registro Mercantil espa\u00F1ol.
          </li>
          <li>
            <strong>Constituci\u00F3n de sociedad</strong> \u2014 cuando los socios
            fundadores son extranjeros y aportan documentaci\u00F3n de su pa\u00EDs.
          </li>
          <li>
            <strong>Procedimientos judiciales</strong> \u2014 para acreditar la
            personalidad jur\u00EDdica de una empresa extranjera.
          </li>
          <li>
            <strong>Licitaciones p\u00FAblicas</strong> \u2014 cuando una empresa extranjera
            participa en concursos p\u00FAblicos en Espa\u00F1a.
          </li>
          <li>
            <strong>Operaciones notariales</strong> \u2014 compraventas,
            ampliaciones de capital y fusiones con participaci\u00F3n de empresas
            extranjeras.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios orientativos
        </h2>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Estatutos breves (5-10 p\u00E1ginas):</strong> desde 80 \u20AC
          </li>
          <li>
            <strong>Estatutos est\u00E1ndar (10-20 p\u00E1ginas):</strong> desde 150 \u20AC
          </li>
          <li>
            <strong>Estatutos extensos (20+ p\u00E1ginas):</strong> presupuesto personalizado
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          El precio definitivo depende del idioma, la extensi\u00F3n y la terminolog\u00EDa.
          Env\u00EDanos el documento para un presupuesto exacto.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos mercantiles relacionados
        </h2>
        <p>
          Adem\u00E1s de los estatutos sociales, traducimos toda la documentaci\u00F3n
          mercantil que suele acompa\u00F1arlos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Actas de junta general y del consejo de administraci\u00F3n.</li>
          <li>
            Certificados del <strong>Registre du Commerce</strong> (Kbis, extracto
            K, etc.) y Handelsregister.
          </li>
          <li>Cuentas anuales y balances de situaci\u00F3n.</li>
          <li>Poderes de representaci\u00F3n y certificados de vigencia.</li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          \u00BFNecesitas traducir los estatutos de una empresa?
        </h2>
        <p className="mt-1 text-encre">
          Env\u00EDanos los estatutos en PDF y te damos presupuesto cerrado con plazo
          de entrega. Tambi\u00E9n podemos traducir el resto de documentaci\u00F3n mercantil
          del expediente.
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
          href="/documentos-oficiales/documentos-mercantiles"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos mercantiles
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
