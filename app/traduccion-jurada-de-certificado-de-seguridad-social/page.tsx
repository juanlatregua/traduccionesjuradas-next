import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducción Jurada Certificado Seguridad Social · Francés↔Español · MAEC",
  description:
    "Traducción jurada de certificados de Seguridad Social: nóminas CNSS, cotizaciones, vida laboral y prestaciones. Traductor jurado oficial MAEC nº 3850. Presupuesto gratis.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-de-certificado-de-seguridad-social",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Qué documentos de Seguridad Social se traducen con más frecuencia?",
    answer:
      "Certificados de cotización (CNSS, Sécurité Sociale), nóminas, vidas laborales extranjeras, certificados de prestaciones por desempleo y certificados de pensión.",
  },
  {
    question: "¿Para qué trámites se pide esta traducción?",
    answer:
      "Para permisos de residencia y trabajo, reagrupación familiar, solicitud de prestaciones en España, teletrabajo desde España para empresas extranjeras, y tramitación de pensiones.",
  },
  {
    question: "¿Cuánto cuesta la traducción de un certificado de Seguridad Social?",
    answer:
      "Un certificado estándar (1-3 páginas) cuesta desde 35-50 € dependiendo del idioma. Las nóminas y vidas laborales extensas tienen precio por volumen.",
  },
  {
    question: "¿También traducís nóminas de la CNSS marroquí?",
    answer:
      "Sí, traducimos habitualmente certificados y nóminas de la CNSS marroquí para trámites de extranjería, reagrupación familiar y teletrabajo desde España.",
  },
];

export default function TraduccionJuradaCertificadoSeguridadSocialPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-seguridad-social"
        serviceName="Traducción jurada de certificado de Seguridad Social"
        serviceDescription="Traducción jurada oficial de certificados de Seguridad Social extranjeros: cotizaciones, nóminas, vidas laborales y prestaciones."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-de-certificado-de-seguridad-social"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-seguridad-social"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducción jurada certificado Seguridad Social",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-de-certificado-de-seguridad-social",
          },
        ]}
      />
      <SchemaFAQ id="faq-seguridad-social" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Seguridad Social
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de certificado de Seguridad Social
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Los certificados de Seguridad Social extranjeros — nóminas, cotizaciones,
          vidas laborales, prestaciones — necesitan{" "}
          <strong>traducción jurada</strong> para muchos trámites de extranjería,
          residencia y trabajo en España. Traducción firmada por traductor jurado
          oficial MAEC nº 3850.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos de Seguridad Social que traducimos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Certificados de cotización</strong> — CNSS (Marruecos),
            Sécurité Sociale (Francia), Sozialversicherung (Alemania).
          </li>
          <li>
            <strong>Nóminas</strong> — bulletins de paie, Gehaltsabrechnung,
            payslips.
          </li>
          <li>
            <strong>Vida laboral</strong> — certificados de historial laboral
            emitidos por el organismo de Seguridad Social del país.
          </li>
          <li>
            <strong>Certificados de pensión</strong> — para cobrar pensión de
            otro país desde España.
          </li>
          <li>
            <strong>Certificados de prestaciones</strong> — desempleo, baja
            médica, maternidad/paternidad.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Para qué trámites se necesita?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Residencia y trabajo</strong> — acreditar medios económicos
            y situación laboral.
          </li>
          <li>
            <strong>Reagrupación familiar</strong> — demostrar solvencia
            económica del reagrupante.
          </li>
          <li>
            <strong>Teletrabajo desde España</strong> — acreditar la relación
            laboral con empresa extranjera.
          </li>
          <li>
            <strong>Jubilación</strong> — tramitar el cobro de pensiones
            extranjeras desde España.
          </li>
          <li>
            <strong>Prestaciones sociales</strong> — acreditar cotizaciones previas
            en otro país para solicitar prestaciones en España.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios orientativos
        </h2>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Certificado CNSS / Sécurité Sociale (1-2 páginas):</strong>{" "}
            desde 35 €
          </li>
          <li>
            <strong>Nómina (1 página):</strong> desde 35 €
          </li>
          <li>
            <strong>Vida laboral (varias páginas):</strong> desde 50 €
          </li>
          <li>
            <strong>Lote de nóminas (3-6 meses):</strong> precio por volumen
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-parchment p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos marroquíes de Seguridad Social
        </h2>
        <p className="mt-2">
          Traducimos habitualmente certificados de la <strong>CNSS marroquí</strong>{" "}
          (Caisse Nationale de Sécurité Sociale) para trámites de extranjería
          y reagrupación familiar. Estos documentos están en francés y se traducen
          al español con entrega en 1 día hábil (hasta 5 páginas).
        </p>
        <p className="mt-2">
          Si necesitas traducir varios documentos marroquíes a la vez, consulta
          nuestra página sobre{" "}
          <Link href="/marruecos" className="text-bleu underline">
            traducciones juradas de documentos marroquíes
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir un certificado de Seguridad Social?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos el documento en PDF o foto clara y te damos precio cerrado
          al instante. Entrega rápida en PDF firmado.
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
          href="/teletrabajo"
          className="font-semibold text-bleu hover:underline"
        >
          Traducciones para teletrabajo
        </Link>
      </p>
    </main>
  );
}
