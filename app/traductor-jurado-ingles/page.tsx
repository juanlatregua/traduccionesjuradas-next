// app/traductor-jurado-ingles/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import LanguageOfferPanel from "@/components/LanguageOfferPanel";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";

export const metadata: Metadata = {
  title: "Traductor jurado de inglés | Traducciones juradas inglés-español",
  description:
    "Traducciones juradas de inglés a español y de español a inglés realizadas por traductores jurados acreditados. Válidas para trámites en España, Reino Unido, Irlanda, Estados Unidos y otros países anglófonos.",
};

export default function TraductorJuradoInglesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de inglés
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de inglés para trámites en España y en el extranjero
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos{" "}
          <strong>
            traducciones juradas de inglés a español y de español a inglés
          </strong>{" "}
          para presentar documentos ante administraciones, universidades,
          notarías, juzgados y empresas en España, Reino Unido, Irlanda, Estados
          Unidos y otros países anglófonos. Cada encargo lo firma un{" "}
          <strong>traductor jurado de inglés acreditado</strong>, sin
          plataformas intermediarias.
        </p>

        {/* CTA PRINCIPAL */}
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de inglés
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
      <LanguageOfferPanel config={LANGUAGE_CONFIGS.ingles} />

      {/* DOCUMENTOS */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos habituales que traducimos del inglés
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Trabajamos con documentación emitida en{" "}
          <strong>Reino Unido, Irlanda, Estados Unidos, Canadá</strong> y otros
          países de habla inglesa, tanto para presentarla en España como en el
          extranjero. Algunos de los documentos más frecuentes son:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Registro civil */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados del registro civil
            </h3>
            <p className="mt-1 text-slate-700">
              Birth certificates, marriage certificates, divorce decrees, death
              certificates y otros documentos necesarios para extranjería,
              nacionalidad, matrimonio o herencias.
            </p>
            <Link
              href="/documentos-oficiales/certificados-registro-civil"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre certificados →
            </Link>
          </div>

          {/* Antecedentes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados de antecedentes y buena conducta
            </h3>
            <p className="mt-1 text-slate-700">
              ACRO, DBS, Police Certificates, FBI Background Checks y otros
              certificados exigidos para visados, permisos de residencia,
              oposiciones o empleo en España.
            </p>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre antecedentes penales →
            </Link>
          </div>

          {/* Académicos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Títulos y expedientes académicos
            </h3>
            <p className="mt-1 text-slate-700">
              Diplomas, transcripts, degree certificates, academic records,
              certificados de estudios y otros documentos necesarios para
              homologaciones, másteres u oposiciones en España.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos académicos habituales →
            </Link>
          </div>

          {/* Laboral / mercantil */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos laborales y mercantiles
            </h3>
            <p className="mt-1 text-slate-700">
              Employment contracts, payslips, reference letters, company
              certificates, articles of association, powers of attorney y otra
              documentación para trabajar, invertir o abrir negocio en España.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link
                href="/documentos-oficiales/documentos-laborales"
                className="font-semibold text-emerald-700 hover:underline"
              >
                Ver documentos laborales →
              </Link>
              <Link
                href="/documentos-oficiales/documentos-mercantiles"
                className="text-slate-700 hover:underline"
              >
                Ver documentos mercantiles →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* APOSTILLA */}
      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Documentos con Apostilla de la Haya en inglés
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Muchos documentos emitidos en inglés destinados a España u otros
          países requieren <strong>Apostille / Apostilla de la Haya</strong>. Es
          habitual en certificados civiles, antecedentes, documentos judiciales
          y mercantiles.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          En estos casos se suele exigir la{" "}
          <strong>traducción jurada del documento y de la apostilla</strong>.
          Podemos ayudarte a preparar correctamente toda la documentación para
          evitar problemas en consulado, notaría, universidad o administración.
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
          Ventajas de trabajar con nuestro traductor jurado de inglés
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Experiencia internacional
            </h3>
            <p className="mt-1 text-slate-700">
              Amplia experiencia con documentación entre España y países de habla
              inglesa para empleo, estudios, migración, herencias o inversión.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Servicio online y entrega en PDF
            </h3>
            <p className="mt-1 text-slate-700">
              Envío de documentos por email o WhatsApp y{" "}
              <strong>
                entrega de la traducción jurada en PDF firmado digitalmente
              </strong>
              . Envío en papel opcional.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Presupuesto claro y asesoramiento
            </h3>
            <p className="mt-1 text-slate-700">
              Precio cerrado antes de empezar y orientación sobre qué documentos
              son necesarios para tu trámite concreto. Puedes ver nuestros{" "}
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

      {/* URGENCIAS */}
      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de inglés urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes un vuelo próximo, una cita en extranjería, una matrícula
              universitaria o una firma notarial, indícanos la{" "}
              <strong>fecha límite</strong> al pedir presupuesto. Revisaremos la
              disponibilidad para ofrecer, cuando sea posible, un servicio
              urgente.
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


