// app/traductor-jurado-neerlandes/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import LanguageOfferPanel from "@/components/LanguageOfferPanel";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title:
    "Traductor jurado de neerlandés | Traducciones juradas neerlandés-español",
  description:
    "Traducciones juradas de neerlandés a español y de español a neerlandés realizadas por traductores jurados. Válidas para trámites en España, Países Bajos y Bélgica.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-neerlandes",
  },
};

export default function TraductorJuradoNeerlandesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-traductor-jurado-neerlandes"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Traductor jurado de neerlandés", url: "https://www.traduccionesjuradas.net/traductor-jurado-neerlandes" },
        ]}
      />
      <SchemaFAQ
        id="faq-traductor-jurado-neerlandes"
        items={[
          {
            question: "¿Qué validez tiene una traducción jurada de neerlandés en España?",
            answer:
              "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
          },
          {
            question: "¿Cuánto cuesta una traducción jurada de neerlandés?",
            answer:
              "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
          },
          {
            question: "¿En cuánto tiempo se entrega una traducción jurada de neerlandés?",
            answer:
              "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
          },
        ]}
      />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de neerlandés
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de neerlandés para España, Países Bajos y Bélgica
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos{" "}
          <strong>
            traducciones juradas de neerlandés a español y de español a
            neerlandés
          </strong>{" "}
          para trámites en España y en países como Países Bajos y Bélgica:
          empleo, residencia, estudios, empresas y herencias. Cada traducción
          la firma un <strong>traductor jurado de neerlandés</strong>, sin
          plataformas intermediarias, para que tus documentos sean aceptados
          ante administraciones, notarías, universidades y juzgados.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de neerlandés
          </a>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-slate-300 px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
          >
            Enviar documentos por WhatsApp
          </a>
          <Link
            href="/presupuesto"
            className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            O rellenar el formulario de presupuesto
          </Link>
        </div>
      </header>

      {/* PANEL DE PEDIDO */}
      <LanguageOfferPanel config={LANGUAGE_CONFIGS.neerlandes} />

      {/* BLOQUE PRECIO / PLAZO / VALIDEZ */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Precio de traducción jurada de neerlandés
          </h2>
          <p className="mt-2 text-slate-700">
            El precio depende del tipo de documento, páginas, sellos y
            urgencia. Confirmamos siempre presupuesto cerrado al revisar el
            archivo.
          </p>
          <Link
            href="/precios-traduccion-jurada"
            className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
          >
            Ver tarifas orientativas →
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Plazo de entrega
          </h2>
          <p className="mt-2 text-slate-700">
            Para certificados sencillos, el plazo habitual es de 24-72 h
            laborables. Los expedientes extensos se planifican con fecha de
            entrega realista desde el inicio.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            También podemos valorar urgencias según volumen y disponibilidad.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Validez oficial (MAEC)
          </h2>
          <p className="mt-2 text-slate-700">
            La traducción jurada tiene validez cuando la firma un traductor
            jurado nombrado por el Ministerio de Asuntos Exteriores (MAEC) y
            respeta el formato oficial requerido.
          </p>
        </article>
      </section>

      {/* DOCUMENTOS */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos frecuentes en neerlandés que solemos traducir
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Trabajamos con documentos emitidos en{" "}
          <strong>Países Bajos y Bélgica</strong>, tanto personales como
          académicos, laborales y de empresa, que se van a presentar en España
          o en otros países:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Registro civil */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados del registro civil
            </h3>
            <p className="mt-1 text-slate-700">
              Geboorteakte, huwelijksakte, echtscheidingsakte, overlijdensakte,
              etc. para trámites de extranjería, nacionalidad, matrimonio o
              herencias en España.
            </p>
            <Link
              href="/documentos-oficiales/certificados-registro-civil"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre certificados →
            </Link>
          </div>

          {/* Académicos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Títulos y documentos académicos
            </h3>
            <p className="mt-1 text-slate-700">
              Diplomas, cijferlijsten, certificaten, estudios superiores y
              formación profesional necesarios para homologaciones o acceso a
              estudios en España.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos académicos habituales →
            </Link>
          </div>

          {/* Laborales */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos laborales
            </h3>
            <p className="mt-1 text-slate-700">
              Arbeidscontract, loonstroken, werkgeversverklaring y otros
              documentos de trabajo para residir o trabajar en España o para
              acreditar experiencia profesional.
            </p>
            <Link
              href="/documentos-oficiales/documentos-laborales"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos laborales →
            </Link>
          </div>

          {/* Mercantiles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos mercantiles y societarios
            </h3>
            <p className="mt-1 text-slate-700">
              Uittreksel Kamer van Koophandel, statuten, jaarrekeningen y otros
              documentos de empresa para operar, invertir o abrir delegaciones
              en España.
            </p>
            <Link
              href="/documentos-oficiales/documentos-mercantiles"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos mercantiles →
            </Link>
          </div>
        </div>
      </section>

      {/* APOSTILLA */}
      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Documentos con Apostilla de la Haya en neerlandés
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Es frecuente que documentos neerlandeses destinados a España lleven{" "}
          <strong>Apostille / Apostilla de la Haya</strong>. En esos casos,
          suele ser necesario traducir tanto el documento como la apostilla
          mediante traducción jurada para que los acepte la administración,
          notaría o universidad.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Más información general en{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-emerald-700 underline"
          >
            Apostilla de la Haya
          </Link>
          .
        </p>
      </section>

      {/* VENTAJAS */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Ventajas de trabajar con nuestro traductor jurado de neerlandés
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Experiencia con España, Países Bajos y Bélgica
            </h3>
            <p className="mt-1 text-slate-700">
              Acostumbrados a documentación entre España y países de habla
              neerlandesa: empleo, residencia, estudios, herencias y
              constitución de empresas.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Servicio online y entrega en PDF
            </h3>
            <p className="mt-1 text-slate-700">
              Envío de documentos por email o WhatsApp y{" "}
              <strong>entrega en PDF firmado digitalmente</strong>. En caso
              necesario, también envío en papel por mensajería.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Precios claros y asesoramiento
            </h3>
            <p className="mt-1 text-slate-700">
              Precio cerrado antes de empezar y orientación sobre qué documentos
              suelen pedir en tu trámite. Puedes consultar nuestros{" "}
              <Link
                href="/precios-traduccion-jurada"
                className="text-emerald-700 underline"
              >
                precios de traducción jurada
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* BLOQUE E-E-A-T */}
      <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Despacho profesional y garantías legales
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Servicio prestado por <strong>HBTJ Consultores Lingüísticos S.L.</strong>.
          </li>
          <li>
            Sede profesional: <strong>Calle Esperanto, 9 · 29007 Málaga</strong>.
          </li>
          <li>
            Traducciones firmadas por traductor jurado acreditado por el MAEC.
          </li>
          <li>
            Tratamiento de datos conforme a RGPD y LOPDGDD: consulta nuestra{" "}
            <Link href="/privacidad" className="text-emerald-700 underline">
              política de privacidad
            </Link>
            .
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-700">
          Contacto directo:{" "}
          <a href="mailto:hola@traduccionesjuradas.net" className="font-semibold text-emerald-700 hover:underline">
            hola@traduccionesjuradas.net
          </a>{" "}
          ·{" "}
          <a href="tel:+34951333614" className="font-semibold text-emerald-700 hover:underline">
            951 333 614
          </a>
          .
        </p>
      </section>

      {/* URGENCIAS */}
      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de neerlandés urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes plazos próximos (notaría, extranjería, universidad,
              trabajo), indícanos la <strong>fecha límite</strong> al solicitar
              presupuesto y valoraremos la posibilidad de un servicio urgente
              según el volumen y la complejidad de los documentos.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <a
              href={WHATSAPP_LINK}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-center font-semibold text-white hover:bg-emerald-600"
            >
              Escribir por WhatsApp
            </a>
            <a
              href={MAIL_LINK}
              className="text-center text-xs font-medium text-sky-300 hover:underline"
            >
              O enviar un email a hola@traduccionesjuradas.net
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

