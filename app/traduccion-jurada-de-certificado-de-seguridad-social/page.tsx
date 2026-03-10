import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducci\u00F3n Jurada Certificado Seguridad Social \u00B7 Franc\u00E9s\u2194Espa\u00F1ol \u00B7 MAEC",
  description:
    "Traducci\u00F3n jurada de certificados de Seguridad Social: n\u00F3minas CNSS, cotizaciones, vida laboral y prestaciones. Traductor jurado oficial MAEC n\u00BA 3850. Presupuesto gratis.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-de-certificado-de-seguridad-social",
  },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFQu\u00E9 documentos de Seguridad Social se traducen con m\u00E1s frecuencia?",
    answer:
      "Certificados de cotizaci\u00F3n (CNSS, S\u00E9curit\u00E9 Sociale), n\u00F3minas, vidas laborales extranjeras, certificados de prestaciones por desempleo y certificados de pensi\u00F3n.",
  },
  {
    question: "\u00BFPara qu\u00E9 tr\u00E1mites se pide esta traducci\u00F3n?",
    answer:
      "Para permisos de residencia y trabajo, reagrupaci\u00F3n familiar, solicitud de prestaciones en Espa\u00F1a, teletrabajo desde Espa\u00F1a para empresas extranjeras, y tramitaci\u00F3n de pensiones.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta la traducci\u00F3n de un certificado de Seguridad Social?",
    answer:
      "Un certificado est\u00E1ndar (1-3 p\u00E1ginas) cuesta desde 35-50 \u20AC dependiendo del idioma. Las n\u00F3minas y vidas laborales extensas tienen precio por volumen.",
  },
  {
    question: "\u00BFTambi\u00E9n traduc\u00EDs n\u00F3minas de la CNSS marroqu\u00ED?",
    answer:
      "S\u00ED, traducimos habitualmente certificados y n\u00F3minas de la CNSS marroqu\u00ED para tr\u00E1mites de extranjer\u00EDa, reagrupaci\u00F3n familiar y teletrabajo desde Espa\u00F1a.",
  },
];

export default function TraduccionJuradaCertificadoSeguridadSocialPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-seguridad-social"
        serviceName="Traducci\u00F3n jurada de certificado de Seguridad Social"
        serviceDescription="Traducci\u00F3n jurada oficial de certificados de Seguridad Social extranjeros: cotizaciones, n\u00F3minas, vidas laborales y prestaciones."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-de-certificado-de-seguridad-social"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Ling\u00FC\u00EDsticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC n\u00BA 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-seguridad-social"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducci\u00F3n jurada certificado Seguridad Social",
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
          Traducci\u00F3n jurada de certificado de Seguridad Social
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Los certificados de Seguridad Social extranjeros \u2014 n\u00F3minas, cotizaciones,
          vidas laborales, prestaciones \u2014 necesitan{" "}
          <strong>traducci\u00F3n jurada</strong> para muchos tr\u00E1mites de extranjer\u00EDa,
          residencia y trabajo en Espa\u00F1a. Traducci\u00F3n firmada por traductor jurado
          oficial MAEC n\u00BA 3850.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos de Seguridad Social que traducimos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Certificados de cotizaci\u00F3n</strong> \u2014 CNSS (Marruecos),
            S\u00E9curit\u00E9 Sociale (Francia), Sozialversicherung (Alemania).
          </li>
          <li>
            <strong>N\u00F3minas</strong> \u2014 bulletins de paie, Gehaltsabrechnung,
            payslips.
          </li>
          <li>
            <strong>Vida laboral</strong> \u2014 certificados de historial laboral
            emitidos por el organismo de Seguridad Social del pa\u00EDs.
          </li>
          <li>
            <strong>Certificados de pensi\u00F3n</strong> \u2014 para cobrar pensi\u00F3n de
            otro pa\u00EDs desde Espa\u00F1a.
          </li>
          <li>
            <strong>Certificados de prestaciones</strong> \u2014 desempleo, baja
            m\u00E9dica, maternidad/paternidad.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFPara qu\u00E9 tr\u00E1mites se necesita?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Residencia y trabajo</strong> \u2014 acreditar medios econ\u00F3micos
            y situaci\u00F3n laboral.
          </li>
          <li>
            <strong>Reagrupaci\u00F3n familiar</strong> \u2014 demostrar solvencia
            econ\u00F3mica del reagrupante.
          </li>
          <li>
            <strong>Teletrabajo desde Espa\u00F1a</strong> \u2014 acreditar la relaci\u00F3n
            laboral con empresa extranjera.
          </li>
          <li>
            <strong>Jubilaci\u00F3n</strong> \u2014 tramitar el cobro de pensiones
            extranjeras desde Espa\u00F1a.
          </li>
          <li>
            <strong>Prestaciones sociales</strong> \u2014 acreditar cotizaciones previas
            en otro pa\u00EDs para solicitar prestaciones en Espa\u00F1a.
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios orientativos
        </h2>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Certificado CNSS / S\u00E9curit\u00E9 Sociale (1-2 p\u00E1ginas):</strong>{" "}
            desde 35 \u20AC
          </li>
          <li>
            <strong>N\u00F3mina (1 p\u00E1gina):</strong> desde 35 \u20AC
          </li>
          <li>
            <strong>Vida laboral (varias p\u00E1ginas):</strong> desde 50 \u20AC
          </li>
          <li>
            <strong>Lote de n\u00F3minas (3-6 meses):</strong> precio por volumen
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-parchment p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos marroqu\u00EDes de Seguridad Social
        </h2>
        <p className="mt-2">
          Traducimos habitualmente certificados de la <strong>CNSS marroqu\u00ED</strong>{" "}
          (Caisse Nationale de S\u00E9curit\u00E9 Sociale) para tr\u00E1mites de extranjer\u00EDa
          y reagrupaci\u00F3n familiar. Estos documentos est\u00E1n en franc\u00E9s y se traducen
          al espa\u00F1ol con entrega en 24 horas.
        </p>
        <p className="mt-2">
          Si necesitas traducir varios documentos marroqu\u00EDes a la vez, consulta
          nuestra p\u00E1gina sobre{" "}
          <Link href="/marruecos" className="text-bleu underline">
            traducciones juradas de documentos marroqu\u00EDes
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          \u00BFNecesitas traducir un certificado de Seguridad Social?
        </h2>
        <p className="mt-1 text-encre">
          Env\u00EDanos el documento en PDF o foto clara y te damos precio cerrado
          al instante. Entrega r\u00E1pida en PDF firmado.
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
          href="/teletrabajo"
          className="font-semibold text-bleu hover:underline"
        >
          Traducciones para teletrabajo
        </Link>
      </p>
    </main>
  );
}
