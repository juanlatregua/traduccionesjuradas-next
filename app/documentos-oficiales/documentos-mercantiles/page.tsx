import type { Metadata } from "next";
import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RelatedDocuments } from "@/components/RelatedDocuments";
import { SchemaService } from "@/components/SchemaService";

export const metadata: Metadata = {
  title:
    "Traducción jurada de documentos mercantiles y empresariales | Registro Mercantil, estatutos y poderes",
  description:
    "Traducción jurada de documentos mercantiles y empresariales para usarlos en España: escrituras, estatutos sociales, poderes, certificados del Registro Mercantil, cuentas anuales, acuerdos societarios y documentación de empresas extranjeras (incluidas empresas de Marruecos).",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-mercantiles" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traducci%C3%B3n+jurada+de+documentos+mercantiles&subtitle=Escrituras%2C+estatutos%2C+poderes+y+Registro+Mercantil",
        width: 1200,
        height: 630,
        alt: "Traducción jurada de documentos mercantiles — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function DocumentosMercantilesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaFAQ
        id="faq-mercantiles"
        items={[
          { question: "¿Qué documentos mercantiles necesitan traducción jurada para España?", answer: "Los más habituales son escrituras de constitución, estatutos sociales, poderes notariales, certificados del Registro Mercantil, cuentas anuales y contratos mercantiles." },
          { question: "¿Una empresa extranjera necesita traducir sus estatutos para operar en España?", answer: "Sí. Para abrir sucursal, filial o establecimiento permanente en España, las notarías y el Registro Mercantil exigen traducción jurada de los estatutos y la escritura de constitución." },
          { question: "¿Hace falta apostilla en los documentos mercantiles?", answer: "Depende del país emisor y del trámite. En muchos casos, el Registre du Commerce o certificado de vigencia debe llevar Apostilla de La Haya. Lo más prudente es confirmarlo con la notaría o el registro español correspondiente." },
        ]}
      />
      <SchemaService
        id="service-mercantiles"
        serviceName="Traducción jurada de documentos mercantiles"
        serviceDescription="Traducción jurada oficial de escrituras, estatutos sociales, poderes, certificados del Registro Mercantil y documentación empresarial extranjera para operar en España."
        serviceUrl="https://www.traduccionesjuradas.net/documentos-oficiales/documentos-mercantiles"
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-mercantiles"
        items={[
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
          { name: "Documentos mercantiles", url: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-mercantiles" },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
        { name: "Documentos mercantiles", href: "/documentos-oficiales/documentos-mercantiles" },
      ]} />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Documentos mercantiles y empresariales
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de documentos mercantiles y empresariales
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Ayudamos a empresas, autónomos y asesores a traducir de forma jurada
          toda la documentación mercantil necesaria para operar en España o en
          el extranjero: escrituras, estatutos, poderes, certificados del
          Registro Mercantil, cuentas anuales y acuerdos societarios.
        </p>
      </header>

      {/* TIPOS DE DOCUMENTOS */}
      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Principales documentos mercantiles que traducimos
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Escrituras de constitución</strong> de sociedades.
          </li>
          <li>
            <strong>Estatutos sociales</strong> y modificaciones posteriores
            (ampliaciones de capital, cambios de administrador, objeto social,
            domicilio, etc.).
          </li>
          <li>
            <strong>Poderes notariales</strong> generales y especiales:
            representación en España, poderes para firmar contratos, operar con
            bancos, comprar inmuebles, etc.
          </li>
          <li>
            <strong>Certificados del Registro Mercantil</strong> o{" "}
            <em>Registre du Commerce</em>: vigencia, denominación social,
            administradores, objeto social, domicilio social.
          </li>
          <li>
            <strong>Cuentas anuales, balances y estados financieros</strong>.
          </li>
          <li>
            <strong>Contratos mercantiles</strong>: compraventa, agencia,
            distribución, franquicia, prestación de servicios.
          </li>
          <li>
            <strong>Acuerdos societarios</strong> y actas de juntas generales o
            consejos de administración.
          </li>
          <li>
            Documentación de <strong>autónomos y auto-entrepreneurs</strong>:
            certificados de inscripción, volumen de negocio declarado, etc.
          </li>
        </ul>
        <p>
          Todos estos documentos se traducen de forma jurada, con firma y sello
          del traductor jurado, para que puedan presentarse ante notarías,
          registros, bancos, administraciones públicas y clientes.
        </p>
      </section>

      {/* CASOS TÍPICOS EN ESPAÑA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Casos habituales en los que se pide la traducción jurada
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Empresas extranjeras que quieren abrir{" "}
            <strong>sucursal, filial o establecimiento permanente</strong> en
            España.
          </li>
          <li>
            Sociedades que desean <strong>comprar inmuebles</strong> o invertir
            en España.
          </li>
          <li>
            Participación en <strong>licitaciones y concursos públicos</strong>.
          </li>
          <li>
            Apertura de <strong>cuentas bancarias</strong> para empresas
            extranjeras o movimientos de capital.
          </li>
          <li>
            Acreditar <strong>vínculo con la empresa</strong> en expedientes de
            residencia, teletrabajo o desplazamiento de trabajadores.
          </li>
          <li>
            Presentación de <strong>cuentas anuales</strong> o estados
            financieros ante organismos reguladores o socios internacionales.
          </li>
        </ul>
      </section>

      {/* ENFOQUE MARRUECOS / FRANCÓFONOS */}
      <section className="mt-10 space-y-4 rounded-2xl border border-cream bg-parchment p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Empresas de Marruecos y países francófonos que quieren operar en
          España
        </h2>
        <p>
          Trabajamos con frecuencia con <strong>sociedades marroquíes</strong> y
          de otros países francófonos que necesitan documentar su actividad en
          España. Algunos documentos muy habituales son:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Registre du Commerce</strong> y certificados de vigencia.
          </li>
          <li>
            Estatutos de la sociedad y sus modificaciones.
          </li>
          <li>
            Poderes otorgados a representantes en España (para compra de
            inmuebles, firma de contratos, gestiones bancarias, etc.).
          </li>
          <li>
            Certificados del <strong>volumen de negocio declarado</strong> (
            <em>attestation du chiffre d&apos;affaires déclaré</em>).
          </li>
          <li>
            Documentos que vinculan a la empresa con trabajadores desplazados o
            en teletrabajo.
          </li>
        </ul>
        <p>
          Estos documentos suelen exigirse en operaciones inmobiliarias, en
          teletrabajo, en desplazamientos temporales de personal y en
          operaciones bancarias.
        </p>
        <p className="text-xs text-sepia">
          En muchos casos, además de la traducción jurada, se exige Apostilla de
          La Haya u otra forma de legalización. Lo más prudente es confirmar
          siempre los requisitos en la notaría, banco o administración española
          que tramita el caso.
        </p>
      </section>

      {/* RELACIÓN CON TELETRABAJO */}
      <section className="mt-10 space-y-4 rounded-2xl border border-cream bg-card p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos mercantiles en expedientes de teletrabajo
        </h2>
        <p>
          Cuando un trabajador quiere <strong>teletrabajar desde España</strong>{" "}
          para una empresa extranjera, especialmente en el caso de empresas de
          Marruecos y otros países francófonos, suele exigirse un paquete de
          documentos mercantiles:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Registre du Commerce o certificados del Registro Mercantil del país
            de origen.
          </li>
          <li>
            Estatutos de la empresa y documentación acreditativa de la actividad
            real.
          </li>
          <li>
            Certificados de salarios y volumen de negocio declarado, cuando se
            trata de autónomos o auto-entrepreneurs.
          </li>
          <li>
            Contratos de trabajo, cartas de la empresa y autorizaciones de
            teletrabajo.
          </li>
        </ul>
        <p>
          Si este es tu caso, también puedes consultar la página específica de:
        </p>
        <p className="space-x-2">
          <Link
            href="/teletrabajo"
            className="font-semibold text-bleu hover:underline"
          >
            Traducciones juradas para teletrabajar en España
          </Link>
          <span className="text-graphite">·</span>
          <Link
            href="/marruecos"
            className="font-semibold text-bleu hover:underline"
          >
            Documentos marroquíes para España
          </Link>
        </p>
      </section>

      {/* CÓMO ENVIAR DOCUMENTOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviarnos tus documentos mercantiles para traducir?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Envíanos los documentos en PDF o como fotos claras donde se lean
            bien los textos, sellos y firmas.
          </li>
          <li>
            Indica el trámite para el que los necesitas (notaría, Registro de
            la Propiedad, banco, Extranjería, licitación, etc.).
          </li>
          <li>
            Si van a utilizarse en España, pregunta si necesitan Apostilla de La
            Haya u otro tipo de legalización antes de traducirlos.
          </li>
        </ul>
        <p>
          Prepararemos un presupuesto detallado y podremos agrupar varios
          documentos en un mismo encargo para que te resulte más cómodo.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir documentación mercantil o de empresa?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tus escrituras, estatutos, poderes, certificados del Registro
          Mercantil o cualquier otro documento empresarial en PDF o como fotos
          legibles. Te responderemos con un presupuesto cerrado y un plazo
          aproximado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Documentos%20mercantiles%20-%20Presupuesto"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar documentos por email
          </a>
        </div>
      </section>

      <RelatedDocuments currentSlug="documentos-mercantiles" />
    </main>
  );
}
