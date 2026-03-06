// app/documentos-oficiales/certificado-nacimiento/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { WHATSAPP_LINK } from "@/lib/contact";
import { SchemaProduct } from "@/components/SchemaProduct";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RelatedDocuments } from "@/components/RelatedDocuments";
import { SchemaService } from "@/components/SchemaService";

export const metadata: Metadata = {
  title:
    "Traducción jurada de certificado de nacimiento | Usos, países y apostilla",
  description:
  "Traducción jurada de certificados de nacimiento para trámites en España: extranjería, nacionalidad, matrimonio, menores, ONG y adopciones. Información práctica para documentos de Marruecos, Francia, Senegal, Costa de Marfil y otros países francófonos.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-nacimiento" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traducci%C3%B3n+jurada+de+certificado+de+nacimiento&subtitle=Documentos+oficiales+%C2%B7+Extranjer%C3%ADa+y+nacionalidad",
        width: 1200,
        height: 630,
        alt: "Traducción jurada de certificado de nacimiento — TraduccionesJuradas.net",
      },
    ],
  },
};

const whatsappLink = WHATSAPP_LINK;
const mailLink =
  "mailto:hola@traduccionesjuradas.net?subject=Certificado%20de%20nacimiento%20-%20Presupuesto";

export default function CertificadoNacimientoPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaProduct
        name="Traducción jurada de certificado de nacimiento"
        description="Traducción jurada oficial de certificados de nacimiento extranjeros para trámites de extranjería, nacionalidad y registro civil en España."
        sku="tj-certificado-nacimiento"
        offers={[
          { price: "35", priceCurrency: "EUR", url: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-nacimiento" },
          { price: "75", priceCurrency: "EUR", url: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-nacimiento" },
        ]}
      />
      <SchemaFAQ
        id="faq-nacimiento"
        items={[
          { question: "¿Cuánto cuesta la traducción jurada de un certificado de nacimiento?", answer: "Desde 35 € IVA incluido para certificados breves. El precio depende del idioma y la extensión del documento." },
          { question: "¿Necesita apostilla el certificado de nacimiento para usarlo en España?", answer: "Depende del país emisor. Los certificados de países firmantes del Convenio de La Haya necesitan Apostilla. Para otros países se requiere legalización consular." },
          { question: "¿En cuánto tiempo se entrega la traducción jurada del certificado de nacimiento?", answer: "Normalmente entre 24 y 72 horas laborables. Entrega en PDF firmado digitalmente." },
        ]}
      />
      <SchemaService
        id="service-nacimiento"
        serviceName="Traducción jurada de certificado de nacimiento"
        serviceDescription="Traducción jurada oficial de certificados de nacimiento extranjeros para trámites de extranjería, nacionalidad y registro civil en España."
        serviceUrl="https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-nacimiento"
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-nacimiento"
        items={[
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
          { name: "Certificado de nacimiento", url: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-nacimiento" },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
        { name: "Certificado de nacimiento", href: "/documentos-oficiales/certificado-de-nacimiento" },
      ]} />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Certificado de nacimiento
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de certificados de nacimiento
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          El certificado de nacimiento es uno de los documentos que más se
          solicita en trámites de <strong>extranjería, nacionalidad, matrimonio,
          reagrupación familiar, adopciones y procedimientos relacionados con
          menores</strong>. Realizamos su traducción jurada para que sea
          aceptado por las autoridades españolas y, cuando corresponde, por
          otros países.
        </p>
        <p className="mt-2 text-xs text-sepia">
          Si necesitas información más general sobre tipos de certificados, puedes
          consultar también{" "}
          <Link
            href="/documentos-oficiales/certificados-registro-civil"
            className="text-bleu underline"
          >
            certificados del Registro Civil
          </Link>
          .
        </p>
      </header>

      {/* USOS HABITUALES */}
      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Para qué trámites se pide la traducción del certificado de
          nacimiento?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Permisos de residencia y expedientes de extranjería.</li>
          <li>Obtención o renovación de la tarjeta de residencia de hijos.</li>
          <li>Trámites de nacionalidad española.</li>
          <li>Expedientes de matrimonio civil y parejas de hecho.</li>
          <li>Reagrupación familiar y desplazamiento de menores.</li>
          <li>Adopciones internacionales o acogimientos.</li>
          <li>Trámites ante notarías, registros civiles y consulados.</li>
        </ul>
        <p>
          En todos estos casos, la administración suele exigir que el
          certificado esté actualizado (a menudo con menos de 3 o 6 meses) y,
          si procede, debidamente apostillado antes de la traducción jurada. Si
          tienes dudas sobre la apostilla, puedes ampliar información en{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-bleu underline"
          >
            Apostilla de la Haya
          </Link>
          .
        </p>
      </section>

      {/* PAISES Y APOSTILLA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Diferencias por país: apostilla y requisitos habituales
        </h2>
        <p>
          No todos los países funcionan igual. En algunos, el certificado de
          nacimiento llega casi siempre con Apostilla de La Haya; en otros, la
          apostilla no existe o no se aplica a este tipo de documentos.
        </p>

        <div className="rounded-2xl border border-cream bg-parchment p-4 space-y-3">
          <h3 className="text-sm font-semibold text-encre">
            Marruecos y Francia: certificados con apostilla
          </h3>
          <p>
            En la práctica, muchos certificados de nacimiento emitidos en{" "}
            <strong>Marruecos</strong> y <strong>Francia</strong> llegan ya con
            la Apostilla de La Haya cuando van a utilizarse en España. Es lo
            que exigen con frecuencia Extranjería, los registros civiles y
            notarías.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              En Marruecos, además, se suelen exigir certificados recientes
              (normalmente menos de 3 meses).
            </li>
            <li>
              La traducción jurada debe incluir tanto el certificado como la
              página de la apostilla.
            </li>
          </ul>
          <p className="text-xs text-sepia">
            Si tu certificado forma parte de un expediente para trabajar a
            distancia desde España, puedes ver un resumen de la documentación
            habitual en{" "}
            <Link
              href="/teletrabajo"
              className="text-bleu underline"
            >
              documentos para teletrabajar en España (Marruecos)
            </Link>
            .
          </p>
        </div>

        <div className="rounded-2xl border border-cream bg-parchment p-4 space-y-3">
          <h3 className="text-sm font-semibold text-encre">
            Senegal, Costa de Marfil y otros países africanos francófonos
          </h3>
          <p>
            En países como <strong>Senegal</strong>,{" "}
            <strong>Costa de Marfil</strong> y otros estados africanos
            francófonos, los certificados de nacimiento suelen presentarse{" "}
            <strong>sin apostilla</strong>, porque:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>El país no aplica la Apostilla de La Haya, o</li>
            <li>La apostilla no está disponible para este tipo de documento.</li>
          </ul>
          <p>
            En estos casos, las autoridades pueden exigir otros sistemas de
            legalización (cadenas consulares, sellos ministeriales, etc.). Lo
            más prudente es confirmar siempre los requisitos en el consulado
            español o en la oficina de Extranjería donde se va a presentar el
            expediente.
          </p>
        </div>

        <p className="text-xs text-sepia">
          Aunque podemos orientarte con nuestra experiencia, los requisitos
          formales (apostilla, legalización adicional, antigüedad del
          documento…) dependen siempre de la administración que tramita tu
          expediente.
        </p>
      </section>

      {/* ONG Y MENORES PARA OPERACIONES EN ESPAÑA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Certificados de nacimiento en proyectos de ONG y operaciones de
          menores en España
        </h2>
        <p>
          Trabajamos también con <strong>ONG</strong> y asociaciones que traen
          niños a España para operaciones médicas u otros tratamientos. En este
          tipo de proyectos, la traducción jurada del certificado de nacimiento
          es fundamental para:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Identificar correctamente la identidad del menor.</li>
          <li>
            Acreditar la filiación (padre, madre o tutor legal) ante hospitales,
            juzgados o administraciones.
          </li>
          <li>
            Tramitar permisos de entrada, estancia temporal o autorizaciones
            específicas.
          </li>
        </ul>
        <p>
          Si perteneces a una ONG o asociación, podemos ayudarte a organizar la
          traducción jurada de los certificados de nacimiento y de otros
          documentos relacionados (autorizaciones parentales, informes médicos,
          decisiones judiciales, etc.).
        </p>
      </section>

      {/* FORMATO Y ENVÍO */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviarnos tu certificado de nacimiento?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Haz una foto clara o un escaneo del certificado (y de la apostilla,
            si la tiene).
          </li>
          <li>
            Comprueba que se leen bien los datos, los sellos y las firmas.
          </li>
          <li>
            Indícanos para qué trámite lo necesitas (nacionalidad, residencia,
            ONG, matrimonio, etc.).
          </li>
        </ul>
        <p>
          Prepararemos un presupuesto ajustado y te indicaremos los plazos de
          entrega. La traducción jurada se puede enviar en{" "}
          <strong>PDF firmado digitalmente</strong> y, si lo necesitas, también
          en papel.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir tu certificado de nacimiento?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tu certificado (y la apostilla, si la tiene) en PDF o foto
          clara y te responderemos con un{" "}
          <strong>precio cerrado y un plazo estimado de entrega</strong>. Si se
          trata de un proyecto de ONG, puedes indicarlo para estudiar la mejor
          forma de organizar todas las traducciones.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href={mailLink}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar directamente el documento por email
          </a>
          <a
            href={whatsappLink}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O mandarlo por WhatsApp
          </a>
        </div>
      </section>

      <RelatedDocuments currentSlug="certificado-de-nacimiento" />
    </main>
  );
}
