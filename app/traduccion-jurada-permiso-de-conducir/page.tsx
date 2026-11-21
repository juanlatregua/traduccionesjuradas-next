import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducción Jurada Permiso de Conducir · Francés↔Español · Desde 35€",
  description:
    "Traducción jurada de permiso de conducir para canjear tu carnet en España. Traductor jurado oficial MAEC nº 3850. Francés, inglés, alemán y más. Francés en 1 día hábil, PDF firmado. Desde 35€.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-permiso-de-conducir",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Necesito traducción jurada para canjear mi permiso de conducir?",
    answer:
      "Sí, la DGT exige traducción jurada del permiso de conducir extranjero para tramitar el canje por un carnet español. Debe estar realizada por un traductor jurado acreditado por el MAEC.",
  },
  {
    question: "¿Cuánto cuesta la traducción jurada de un permiso de conducir?",
    answer:
      "El precio habitual es de 35-50 € dependiendo del idioma y la complejidad del documento. El permiso de conducir suele ser un documento breve con precio ajustado.",
  },
  {
    question: "¿Cuánto tarda la traducción jurada del carnet de conducir?",
    answer:
      "En francés, hasta 5 páginas se entregan en 1 día hábil. En otros idiomas el plazo lo fija el traductor jurado y figura en el presupuesto. Entregamos en PDF firmado digitalmente.",
  },
  {
    question: "¿Sirve el PDF firmado o necesito la traducción en papel?",
    answer:
      "La mayoría de las Jefaturas de Tráfico aceptan el PDF firmado digitalmente. Si tu oficina exige papel, podemos enviarlo por mensajería.",
  },
];

export default function TraduccionJuradaPermisoConducirPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-permiso-conducir"
        serviceName="Traducción jurada de permiso de conducir"
        serviceDescription="Traducción jurada oficial de permisos de conducir extranjeros para canje en la DGT. Traductor jurado MAEC nº 3850."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-permiso-de-conducir"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-permiso-conducir"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducción jurada permiso de conducir",
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
          Traducción jurada de permiso de conducir
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Si necesitas <strong>canjear tu permiso de conducir extranjero</strong> por
          uno español, la DGT te exigirá una traducción jurada del carnet
          original. Realizamos la traducción jurada de permisos de conducir de
          cualquier país, con entrega rápida en PDF firmado digitalmente por
          traductor jurado oficial MAEC.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cuándo necesitas traducir tu permiso de conducir?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Canje del carnet en la DGT</strong> — obligatorio para
            residentes con permiso de conducir extranjero de países sin convenio
            de reconocimiento directo.
          </li>
          <li>
            <strong>Alquiler de vehículos</strong> — algunas empresas de alquiler
            exigen traducción jurada del permiso si no es europeo.
          </li>
          <li>
            <strong>Trámites de extranjería</strong> — el permiso de conducir
            sirve como documento de identidad complementario en algunos expedientes.
          </li>
          <li>
            <strong>Trámites judiciales y de seguros</strong> — en caso de
            accidentes o siniestros, se exige la traducción oficial del carnet.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios y plazos orientativos
        </h2>
        <p className="mt-2 text-sepia">
          El permiso de conducir suele ser un documento breve (1-2 páginas), con un
          precio ajustado:
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Francés ↔ Español:</strong> desde 35 € — entrega en 1 día hábil
          </li>
          <li>
            <strong>Inglés ↔ Español:</strong> desde 40 € — plazo en el presupuesto
          </li>
          <li>
            <strong>Alemán ↔ Español:</strong> desde 45 € — plazo en el presupuesto
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
          Países más frecuentes
        </h2>
        <p>
          Traducimos permisos de conducir de cualquier país. Los más habituales
          en nuestra experiencia:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Marruecos</strong> — permiso en francés y árabe, para canje
            en la DGT.
          </li>
          <li>
            <strong>Francia y Bélgica</strong> — permisos europeos que requieren
            traducción para procedimientos judiciales o administrativos.
          </li>
          <li>
            <strong>Alemania, Austria y Suiza</strong> — para trámites de seguros
            y procedimientos civiles.
          </li>
          <li>
            <strong>Reino Unido</strong> — tras el Brexit, el canje requiere
            traducción jurada.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviar tu permiso de conducir?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Haz una foto clara del anverso y reverso del permiso.</li>
          <li>
            Asegúrate de que se leen todos los datos: nombre, fecha, categorías
            y número del permiso.
          </li>
          <li>Indícanos el idioma y el trámite para el que lo necesitas.</li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir tu permiso de conducir?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos una foto de tu carnet y te damos precio cerrado al instante.
          Entrega rápida en PDF firmado por traductor jurado oficial.
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
          href="/documentos-oficiales/documentos-laborales"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos laborales
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
