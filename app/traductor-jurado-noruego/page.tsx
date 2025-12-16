// app/traductor-jurado-noruego/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Traductor jurado de noruego | Traducciones juradas noruego-español",
  description:
    "Traducciones juradas de noruego a español y de español a noruego para trámites en España y Noruega. Traductores jurados oficiales.",
};

export default function TraductorJuradoNoruegoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de noruego
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de noruego para trámites entre España y Noruega
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos{" "}
          <strong>
            traducciones juradas de noruego a español y de español a noruego
          </strong>{" "}
          para documentación civil, académica, laboral, judicial y de empresa.
          Cada traducción la firma un{" "}
          <strong>traductor jurado de noruego</strong>, sin plataformas
          intermediarias, para que tus documentos sean aceptados en España y en
          Noruega ante administraciones, notarías, universidades y juzgados.
        </p>

        {/* CTA PRINCIPAL */}
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de noruego
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

      {/* DOCUMENTOS NORUEGOS HABITUALES */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos noruegos más habituales que solemos traducir
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Trabajamos con documentación emitida en Noruega que se va a presentar
          en España o ante autoridades noruegas desde España: extranjería,
          trabajo, estudios, herencias, pensiones o inversión.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Certificados civiles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados civiles
            </h3>
            <p className="mt-1 text-slate-700">
              Fødselsattest, vigselsattest, documentos de estado civil,
              certificados familiares y otros certificados necesarios para
              matrimonio, nacionalidad, residencia o herencias.
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
              Antecedentes y certificados oficiales
            </h3>
            <p className="mt-1 text-slate-700">
              Extractos de antecedentes, certificados policiales y otros
              documentos exigidos para empleo, residencia, trabajo cualificado o
              trámites de extranjería.
            </p>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre antecedentes penales →
            </Link>
          </div>

          {/* Estudios */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Estudios y cualificaciones
            </h3>
            <p className="mt-1 text-slate-700">
              Títulos, certificados de estudios, historiales académicos y
              cualificaciones profesionales para homologaciones, reconocimiento
              de títulos o acceso a estudios en España.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos académicos habituales →
            </Link>
          </div>

          {/* Laborales y empresa */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos laborales y de empresa
            </h3>
            <p className="mt-1 text-slate-700">
              Contratos de trabajo, nóminas, certificados de empleo, informes de
              ingresos, documentos mercantiles y societarios para operar o
              invertir entre España y Noruega.
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

      {/* APOSTILLA DE LA HAYA */}
      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Documentos noruegos con Apostilla de la Haya
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Muchos documentos noruegos destinados a España u otros países requieren{" "}
          <strong>Apostille / Apostilla de la Haya</strong>. Es habitual en
          certificados civiles, documentación judicial, poderes o documentos
          mercantiles.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          En esos casos se suele exigir la{" "}
          <strong>traducción jurada del documento y de la apostilla</strong>.
          Podemos ayudarte a preparar toda la documentación para evitar
          rechazos en consulado, notaría, universidad o administración.
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

      {/* VENTAJAS DE TRABAJAR CON NOSOTROS */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Ventajas de trabajar con nuestro traductor jurado de noruego
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Experiencia en trámites España–Noruega
            </h3>
            <p className="mt-1 text-slate-700">
              Acostumbrados a documentación entre España y Noruega: residencia,
              trabajo, estudios, pensiones, herencias o compra de vivienda.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Servicio online y entrega en PDF firmado
            </h3>
            <p className="mt-1 text-slate-700">
              Envío de documentos escaneados o fotografiados y{" "}
              <strong>entrega de la traducción jurada en PDF firmado</strong>.
              Si lo necesitas, también podemos enviarla en papel por
              mensajería.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Precios claros y asesoramiento previo
            </h3>
            <p className="mt-1 text-slate-700">
              Te daremos un <strong>precio cerrado</strong> antes de empezar y,
              si lo deseas, te orientamos sobre qué documentos suelen pedir en
              tu tipo de trámite. Puedes consultar nuestros{" "}
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

      {/* URGENCIAS NORUEGO */}
      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de noruego urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si necesitas entregar documentos con poco margen (cita en
              extranjería, firma notarial, plazos universitarios o laborales),
              indícanos la <strong>fecha límite</strong> al pedir presupuesto y
              revisaremos la disponibilidad para ofrecer, cuando sea posible, un
              servicio urgente.
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
