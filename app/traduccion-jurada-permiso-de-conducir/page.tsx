import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducci\u00F3n Jurada Permiso de Conducir \u00B7 Franc\u00E9s\u2194Espa\u00F1ol \u00B7 Desde 35\u20AC",
  description:
    "Traducci\u00F3n jurada de permiso de conducir para canjear tu carnet en Espa\u00F1a. Traductor jurado oficial MAEC n\u00BA 3850. Franc\u00E9s, ingl\u00E9s, alem\u00E1n y m\u00E1s. Entrega en PDF firmado en 24h. Desde 35\u20AC.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-permiso-de-conducir",
  },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFNecesito traducci\u00F3n jurada para canjear mi permiso de conducir?",
    answer:
      "S\u00ED, la DGT exige traducci\u00F3n jurada del permiso de conducir extranjero para tramitar el canje por un carnet espa\u00F1ol. Debe estar realizada por un traductor jurado acreditado por el MAEC.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta la traducci\u00F3n jurada de un permiso de conducir?",
    answer:
      "El precio habitual es de 35-50 \u20AC dependiendo del idioma y la complejidad del documento. El permiso de conducir suele ser un documento breve con precio ajustado.",
  },
  {
    question: "\u00BFCu\u00E1nto tarda la traducci\u00F3n jurada del carnet de conducir?",
    answer:
      "Normalmente 24 horas para permisos en franc\u00E9s. Para otros idiomas, entre 24 y 48 horas. Entregamos en PDF firmado digitalmente.",
  },
  {
    question: "\u00BFSirve el PDF firmado o necesito la traducci\u00F3n en papel?",
    answer:
      "La mayor\u00EDa de las Jefaturas de Tr\u00E1fico aceptan el PDF firmado digitalmente. Si tu oficina exige papel, podemos enviarlo por mensajer\u00EDa.",
  },
];

export default function TraduccionJuradaPermisoConducirPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-permiso-conducir"
        serviceName="Traducci\u00F3n jurada de permiso de conducir"
        serviceDescription="Traducci\u00F3n jurada oficial de permisos de conducir extranjeros para canje en la DGT. Traductor jurado MAEC n\u00BA 3850."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-permiso-de-conducir"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Ling\u00FC\u00EDsticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC n\u00BA 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-permiso-conducir"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducci\u00F3n jurada permiso de conducir",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-permiso-de-conducir",
          },
        ]}
      />
      <SchemaFAQ id="faq-permiso-conducir" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Permiso de conducir
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducci\u00F3n jurada de permiso de conducir
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Si necesitas <strong>canjear tu permiso de conducir extranjero</strong> por
          uno espa\u00F1ol, la DGT te exigir\u00E1 una traducci\u00F3n jurada del carnet
          original. Realizamos la traducci\u00F3n jurada de permisos de conducir de
          cualquier pa\u00EDs, con entrega r\u00E1pida en PDF firmado digitalmente por
          traductor jurado oficial MAEC.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFCu\u00E1ndo necesitas traducir tu permiso de conducir?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Canje del carnet en la DGT</strong> \u2014 obligatorio para
            residentes con permiso de conducir extranjero de pa\u00EDses sin convenio
            de reconocimiento directo.
          </li>
          <li>
            <strong>Alquiler de veh\u00EDculos</strong> \u2014 algunas empresas de alquiler
            exigen traducci\u00F3n jurada del permiso si no es europeo.
          </li>
          <li>
            <strong>Tr\u00E1mites de extranjer\u00EDa</strong> \u2014 el permiso de conducir
            sirve como documento de identidad complementario en algunos expedientes.
          </li>
          <li>
            <strong>Tr\u00E1mites judiciales y de seguros</strong> \u2014 en caso de
            accidentes o siniestros, se exige la traducci\u00F3n oficial del carnet.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios y plazos orientativos
        </h2>
        <p className="mt-2 text-sepia">
          El permiso de conducir suele ser un documento breve (1-2 p\u00E1ginas), con un
          precio ajustado:
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Franc\u00E9s \u2194 Espa\u00F1ol:</strong> desde 35 \u20AC \u2014 entrega en 24h
          </li>
          <li>
            <strong>Ingl\u00E9s \u2194 Espa\u00F1ol:</strong> desde 40 \u20AC \u2014 entrega en 24-48h
          </li>
          <li>
            <strong>Alem\u00E1n \u2194 Espa\u00F1ol:</strong> desde 45 \u20AC \u2014 entrega en 48h
          </li>
          <li>
            <strong>Otros idiomas:</strong> consultar
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          Precios orientativos. El presupuesto definitivo depende del idioma, la
          complejidad y el plazo de entrega solicitado.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Pa\u00EDses m\u00E1s frecuentes
        </h2>
        <p>
          Traducimos permisos de conducir de cualquier pa\u00EDs. Los m\u00E1s habituales
          en nuestra experiencia:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Marruecos</strong> \u2014 permiso en franc\u00E9s y \u00E1rabe, para canje
            en la DGT.
          </li>
          <li>
            <strong>Francia y B\u00E9lgica</strong> \u2014 permisos europeos que requieren
            traducci\u00F3n para procedimientos judiciales o administrativos.
          </li>
          <li>
            <strong>Alemania, Austria y Suiza</strong> \u2014 para tr\u00E1mites de seguros
            y procedimientos civiles.
          </li>
          <li>
            <strong>Reino Unido</strong> \u2014 tras el Brexit, el canje requiere
            traducci\u00F3n jurada.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFC\u00F3mo enviar tu permiso de conducir?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Haz una foto clara del anverso y reverso del permiso.</li>
          <li>
            Aseg\u00FArate de que se leen todos los datos: nombre, fecha, categor\u00EDas
            y n\u00FAmero del permiso.
          </li>
          <li>Ind\u00EDcanos el idioma y el tr\u00E1mite para el que lo necesitas.</li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          \u00BFNecesitas traducir tu permiso de conducir?
        </h2>
        <p className="mt-1 text-encre">
          Env\u00EDanos una foto de tu carnet y te damos precio cerrado al instante.
          Entrega r\u00E1pida en PDF firmado por traductor jurado oficial.
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
          href="/documentos-oficiales/documentos-laborales"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos laborales
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
