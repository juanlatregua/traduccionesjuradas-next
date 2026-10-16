import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducción Jurada de Estatutos Sociales · MAEC nº 3850",
  description:
    "Traducción jurada de estatutos sociales para el Registro Mercantil, constitución de sucursales y trámites notariales. Traductor jurado oficial acreditado por el MAEC. Francés: desde 0,08 € por palabra. Presupuesto cerrado antes de pagar.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-de-estatutos-sociales",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Cuándo necesito traducir los estatutos sociales de una empresa?",
    answer:
      "Para inscribir una sucursal en el Registro Mercantil español, constituir una sociedad con socios extranjeros, o presentar documentación mercantil ante un tribunal o notario en España.",
  },
  {
    question: "¿Se necesita apostilla en los estatutos?",
    answer:
      "Sí, los estatutos notariales extranjeros deben ir apostillados o legalizados. La apostilla se traduce conjuntamente con los estatutos.",
  },
  {
    question: "¿Cuánto cuesta traducir unos estatutos sociales?",
    answer:
      "Se presupuesta por palabras, no por página: en francés desde 0,08 € por palabra más IVA, y en otros idiomas con presupuesto previo. Envía el documento y recibes el precio cerrado antes de pagar.",
  },
  {
    question: "¿También traducís actas de la junta y certificados del Registre du Commerce?",
    answer:
      "Sí, traducimos todos los documentos mercantiles: actas de junta, certificados de registro mercantil (Registre du Commerce), balances y cuentas anuales.",
  },
];

export default function TraduccionJuradaEstatutosSocialesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-estatutos-sociales"
        serviceName="Traducción jurada de estatutos sociales"
        serviceDescription="Traducción jurada oficial de estatutos sociales y documentación mercantil para Registro Mercantil, notaría y tribunales en España."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-de-estatutos-sociales"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-estatutos-sociales"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducción jurada estatutos sociales",
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
          Traducción jurada de estatutos sociales
        </h1>
        {/* Respuesta-arriba citable (AEO): precio y plazo en la primera frase. */}
        <p className="mt-3 text-base font-medium text-encre">
          Los estatutos sociales son el documento que fija el nombre, el objeto, el
          capital y el funcionamiento de una sociedad. Su traducción jurada, firmada
          por traductor jurado oficial MAEC nº 3850, se presupuesta por palabras:
          en francés, desde 0,08 € por palabra más IVA.
        </p>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Los estatutos sociales de una empresa extranjera necesitan{" "}
          <strong>traducción jurada</strong> para ser válidos ante el Registro Mercantil,
          notarías y tribunales españoles. Realizamos la traducción jurada de
          estatutos de cualquier país.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cuándo se necesita traducir los estatutos sociales?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Inscripción de sucursal</strong> — para registrar una sucursal
            de empresa extranjera en el Registro Mercantil español.
          </li>
          <li>
            <strong>Constitución de sociedad</strong> — cuando los socios
            fundadores son extranjeros y aportan documentación de su país.
          </li>
          <li>
            <strong>Procedimientos judiciales</strong> — para acreditar la
            personalidad jurídica de una empresa extranjera.
          </li>
          <li>
            <strong>Licitaciones públicas</strong> — cuando una empresa extranjera
            participa en concursos públicos en España.
          </li>
          <li>
            <strong>Operaciones notariales</strong> — compraventas,
            ampliaciones de capital y fusiones con participación de empresas
            extranjeras.
          </li>
        </ul>
      </section>

      <section id="precios" className="mt-10 scroll-mt-24 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Qué se traduce, en qué formato y a qué precio
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-cream">
          <table className="w-full text-left">
            <thead className="bg-parchment text-encre">
              <tr>
                <th className="px-4 py-3 font-semibold">Concepto</th>
                <th className="px-4 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-cream">
                <td className="px-4 py-3 font-medium text-encre">Qué se traduce</td>
                <td className="px-4 py-3">El texto íntegro de los estatutos, incluidas las modificaciones inscritas, y la apostilla o legalización si la lleva.</td>
              </tr>
              <tr className="border-t border-cream">
                <td className="px-4 py-3 font-medium text-encre">Formato de entrega</td>
                <td className="px-4 py-3">PDF firmado digitalmente por el traductor jurado; copia en papel según el caso.</td>
              </tr>
              <tr className="border-t border-cream">
                <td className="px-4 py-3 font-medium text-encre">Precio en francés</td>
                <td className="px-4 py-3">Por palabras, desde 0,08 € por palabra más IVA. La apostilla suma 5 € por documento.</td>
              </tr>
              <tr className="border-t border-cream">
                <td className="px-4 py-3 font-medium text-encre">Otros idiomas</td>
                <td className="px-4 py-3">Presupuesto previo según idioma y extensión.</td>
              </tr>
              <tr className="border-t border-cream">
                <td className="px-4 py-3 font-medium text-encre">Plazo</td>
                <td className="px-4 py-3">Se fija en el presupuesto según la extensión y la urgencia.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs">
          El precio definitivo depende del idioma, la extensión y la terminología.
          Tarifa vigente de octubre de 2026.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos mercantiles relacionados
        </h2>
        <p>
          Además de los estatutos sociales, traducimos toda la documentación
          mercantil que suele acompañarlos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Actas de junta general y del consejo de administración.</li>
          <li>
            Certificados del <strong>Registre du Commerce</strong> (Kbis, extracto
            K, etc.) y Handelsregister.
          </li>
          <li>Cuentas anuales y balances de situación.</li>
          <li>Poderes de representación y certificados de vigencia.</li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir los estatutos de una empresa?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos los estatutos en PDF y te damos presupuesto cerrado con plazo
          de entrega. También podemos traducir el resto de documentación mercantil
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
        Ver también:{" "}
        <Link
          href="/documentos-oficiales/documentos-mercantiles"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos mercantiles
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
