import type { Metadata } from "next";
import Link from "next/link";
import { CivilMiniForm } from "@/components/CivilMiniForm";
import { SchemaProduct } from "@/components/SchemaProduct";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title:
    "Registro Civil en francés | Traducción jurada nacimiento, matrimonio y defunción",
  description:
    "Traducción jurada de certificados del Registro Civil para trámites oficiales. Incluye documentos en francés y apostilla, con precio cerrado y plazos habituales 24-72h.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/certificados-registro-civil" },
};

export default function CertificadosRegistroCivilPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaProduct
        name="Traducción jurada de certificados del Registro Civil"
        description="Precio cerrado para traducir certificados de nacimiento, matrimonio, defunción y fe de vida con firma y sello de traductor jurado."
        sku="registro-civil"
        offers={[
          { price: "50.00", priceCurrency: "EUR" },
          { price: "45.00", priceCurrency: "EUR" },
          { price: "75.00", priceCurrency: "EUR" },
          { price: "40.00", priceCurrency: "EUR" },
        ]}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-registro-civil"
        items={[
          { name: "Inicio", url: "https://traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://traduccionesjuradas.net/documentos-oficiales" },
          { name: "Certificados del Registro Civil", url: "https://traduccionesjuradas.net/documentos-oficiales/certificados-registro-civil" },
        ]}
      />
      <SchemaFAQ
        id="faq-registro-civil"
        items={[
          {
            question: "¿Sirve la traducción jurada en PDF o necesito copia en papel?",
            answer:
              "El PDF firmado digitalmente suele ser aceptado. Si el organismo pide papel, podemos enviarlo por mensajería.",
          },
          {
            question: "¿Se traduce también la Apostilla de La Haya?",
            answer: "Sí, la apostilla se traduce junto con el certificado de nacimiento, matrimonio o defunción.",
          },
          {
            question: "¿Qué plazos orientativos manejan?",
            answer:
              "Español↔Inglés 2 días, Español→Francés 1 día, Portugués apostillado→Español 2 días, Francés apostillado→Español 1 día.",
          },
          {
            question: "¿Cómo envío el certificado?",
            answer:
              "Adjunta el PDF o una foto clara desde la página o envíalo a hola@traduccionesjuradas.net. Revisamos sellos y apostilla antes de confirmar el importe.",
          },
        ]}
      />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Certificados del Registro Civil
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de certificados del Registro Civil
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          El Registro Civil emite los certificados básicos de la vida de una
          persona: nacimiento, matrimonio, defunción, cambios de nombre, etc.
          Traducimos estos certificados de forma jurada para que puedan
          utilizarse en trámites de extranjería, nacionalidad, matrimonio,
          herencias y muchos otros procedimientos en España y en el extranjero.
        </p>
        <p className="mt-2 text-xs text-sepia">
          Si tu certificado está en francés, puedes revisar también el{" "}
          <Link
            href="/traductor-jurado-frances"
            className="font-semibold text-bleu hover:underline"
          >
            servicio oficial de francés
          </Link>
          .
        </p>
      </header>

      {/* TIPOS DE CERTIFICADOS */}
      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Principales certificados del Registro Civil que suelen requerir traducción
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Certificado de nacimiento</strong> (extracto o literal),
            para extranjería, nacionalidad, reagrupación familiar, matrimonio,
            herencias, etc.
          </li>
          <li>
            <strong>Certificado de matrimonio</strong>, muy habitual en
            expedientes de residencia, nacionalidad y compraventa de inmuebles.
          </li>
          <li>
            <strong>Certificado de divorcio</strong> o anotación de divorcio en
            el certificado de matrimonio.
          </li>
          <li>
            <strong>Certificado de defunción</strong>, frecuente en herencias y
            sucesiones internacionales.
          </li>
          <li>
            <strong>Fe de vida y estado</strong> y certificados de soltería o
            viudedad.
          </li>
          <li>
            Certificados de <strong>cambio de nombre o apellidos</strong> y
            rectificaciones registrales.
          </li>
        </ul>
        <p>
          Todos estos documentos se traducen de forma jurada, con firma y sello
          del traductor jurado, para que sean aceptados por notarías, juzgados,
          registros, consulados y administraciones públicas.
        </p>
      </section>

      {/* TARIFAS Y ENVÍO RÁPIDO */}
      <section className="mt-10 space-y-3 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Tarifas orientativas y envío directo
        </h2>
        <p className="text-sepia">
          Precios para certificados del Registro Civil (nacimiento, matrimonio, defunción, fe de vida…).
          Incluyen firma y sello de traductor jurado; confirmamos importe exacto al revisar el documento.
        </p>
        <CivilMiniForm />
      </section>

      {/* ENLACES A PÁGINAS ESPECÍFICAS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Páginas específicas por tipo de certificado
        </h2>
        <p>
          Si quieres información más detallada sobre un tipo de certificado en
          concreto, puedes consultar también:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <Link
              href="/documentos-oficiales/certificado-de-nacimiento"
              className="font-semibold text-bleu hover:underline"
            >
              Traducción jurada de certificado de nacimiento
            </Link>
          </li>
          {/* Cuando tengas páginas de matrimonio/defunción, puedes descomentar o añadir enlaces aquí */}
          {/* <li>
            <Link
              href="/documentos-oficiales/certificado-de-matrimonio"
              className="font-semibold text-bleu hover:underline"
            >
              Certificado de matrimonio
            </Link>
          </li> */}
        </ul>
      </section>

      {/* DIFERENCIAS POR PAÍS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Certificados de Registro Civil extranjeros: países francófonos y Marruecos
        </h2>
        <p>
          En muchos casos, los certificados del Registro Civil proceden de
          países francófonos o de Marruecos, con formatos y requisitos
          diferentes:
        </p>

        <div className="rounded-2xl border border-cream bg-parchment p-4 space-y-3">
          <h3 className="text-sm font-semibold text-encre">
            Marruecos y Francia
          </h3>
          <p>
            Es frecuente que los certificados de nacimiento, matrimonio o
            defunción emitidos en <strong>Marruecos</strong> y{" "}
            <strong>Francia</strong> lleguen con{" "}
            <strong>Apostilla de La Haya</strong> cuando se van a utilizar en
            España.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              La administración española suele exigir certificados recientes
              (a menudo menos de 3 o 6 meses).
            </li>
            <li>
              La traducción jurada debe incluir tanto el certificado como la
              página de la apostilla.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-cream bg-parchment p-4 space-y-3">
          <h3 className="text-sm font-semibold text-encre">
            Senegal, Costa de Marfil y otros países africanos francófonos
          </h3>
          <p>
            En países como <strong>Senegal</strong>,{" "}
            <strong>Costa de Marfil</strong> y otros estados africanos
            francófonos, los certificados del Registro Civil suelen presentarse{" "}
            <strong>sin apostilla</strong>, porque:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>El país no aplica la Apostilla de La Haya, o</li>
            <li>
              La apostilla no está disponible para este tipo de documento.
            </li>
          </ul>
          <p>
            En estos casos, se utilizan otros sistemas de legalización (sellos
            ministeriales, legalización consular, etc.). Conviene confirmar
            siempre los requisitos en el consulado español o en la oficina de
            Extranjería que tramita el expediente.
          </p>
        </div>
      </section>

      {/* ONG Y MENORES */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Certificados del Registro Civil en proyectos de ONG y menores
        </h2>
        <p>
          Colaboramos también con <strong>ONG</strong> y asociaciones que traen
          menores a España para operaciones médicas u otros tratamientos. En
          estos casos, la traducción jurada de certificados de nacimiento y
          otros documentos de Registro Civil es fundamental para:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Identificar correctamente al menor.</li>
          <li>
            Acreditar la filiación y quién ejerce la tutela o la patria
            potestad.
          </li>
          <li>
            Tramitar permisos de entrada, estancia temporal o autorizaciones
            sanitarias y administrativas.
          </li>
        </ul>
        <p>
          Podemos ayudarte a organizar la traducción jurada de todos estos
          documentos dentro de un mismo proyecto.
        </p>
      </section>

      {/* CÓMO ENVIAR DOCUMENTOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviarnos tus certificados del Registro Civil?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Haz una foto clara o un escaneo legible del certificado (y de la
            apostilla, si la tiene).
          </li>
          <li>
            Comprueba que se leen bien nombres, fechas, sellos y firmas.
          </li>
          <li>
            Indícanos para qué trámite lo necesitas (extranjería, nacionalidad,
            matrimonio, herencia, ONG, etc.).
          </li>
        </ul>
        <p>
          Prepararemos un presupuesto ajustado y te indicaremos los plazos de
          entrega. Podemos enviarte la traducción jurada en PDF firmado
          digitalmente y, si lo necesitas, también en papel.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir certificados del Registro Civil?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tus certificados (nacimiento, matrimonio, defunción, fe de
          vida, soltería, etc.) en PDF o foto clara y te responderemos con un
          precio cerrado y un plazo estimado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Certificados%20del%20Registro%20Civil%20-%20Presupuesto"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar directamente los documentos por email
          </a>
        </div>
      </section>
    </main>
  );
}
