// app/traductor-jurado-frances/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Traductor jurado de francés | Traducciones juradas francés-español",
  description:
    "Traducciones juradas de francés a español y de español a francés realizadas por traductores jurados acreditados por el MAEC. Válidas para trámites en España, Francia y otros países francófonos.",
};

export default function TraductorJuradoFrancesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de francés
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de francés para trámites en España y en países
          francófonos
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos <strong>traducciones juradas de francés a español y de
          español a francés</strong> para presentar documentos ante
          administraciones públicas, juzgados, notarías, universidades y
          otros organismos oficiales en España, Francia y otros países
          francófonos. Todas las traducciones las firma un{" "}
          <strong>traductor jurado de francés acreditado por el MAEC</strong>.
        </p>

        {/* CTA PRINCIPAL */}
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de francés
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

      {/* BLOQUE TIPOS DE DOCUMENTOS */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos más habituales que traducimos del francés
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Trabajamos diariamente con documentación emitida en{" "}
          <strong>Francia, Bélgica, Suiza, Canadá, Marruecos</strong> y otros
          países francófonos. Estos son algunos de los documentos que más
          suelen solicitar nuestros clientes:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados del Registro Civil
            </h3>
            <p className="mt-1 text-slate-700">
              Actes de naissance, mariage, divorce, décès, certificats de
              célibat, certificats de coutume y otros documentos del état
              civil necesarios para extranjería, nacionalidad o herencias.
            </p>
            <Link
              href="/documentos-oficiales/certificados-registro-civil"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre certificados →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Antecedentes penales y buena conducta
            </h3>
            <p className="mt-1 text-slate-700">
              Extrait de casier judiciaire, certificats de bonne conduite u
              otros documentos exigidos para visados, permisos de residencia,
              oposiciones o empleo en España.
            </p>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre antecedentes penales →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Títulos y expedientes académicos
            </h3>
            <p className="mt-1 text-slate-700">
              Diplômes, relevés de notes, attestations de réussite, programas
              de estudios, certificados de escolaridad y otros documentos
              necesarios para homologaciones, estudios universitarios y
              oposiciones.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos académicos habituales →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos mercantiles y laborales
            </h3>
            <p className="mt-1 text-slate-700">
              Contrats de travail, fiches de paie, attestations de salaire,
              statuts de société, extraits Kbis, procès-verbaux y otros
              documentos necesarios para trabajar o invertir en España.
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

      {/* BLOQUE APOSTILLA / PAISES FRANCÓFONOS */}
      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Documentos con Apostilla de la Haya y países francófonos
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Si tus documentos franceses o francófonos llevan{" "}
          <strong>Apostille de La Haye / Apostilla de la Haya</strong>, es
          habitual que te pidan la <strong>traducción jurada del documento y
          de la apostilla</strong> para trámites en España u otros países.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Trabajamos con documentación procedente de Francia, Bélgica, Suiza,
          Luxemburgo, Canadá y países del Magreb como Marruecos y Túnez.
          Podemos ayudarte a organizar todas las traducciones en un mismo
          expediente, especialmente si se trata de{" "}
          <strong>familias o empresas</strong> que presentan varios
          documentos.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Puedes ampliar información sobre apostilla y legalizaciones en{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-emerald-700 underline"
          >
            Apostilla de la Haya
          </Link>
          .
        </p>
      </section>

      {/* BLOQUE POR QUÉ NOSOTROS */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          ¿Por qué encargar la traducción jurada de francés con nosotros?
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Traductores jurados, no intermediarios
            </h3>
            <p className="mt-1 text-slate-700">
              Coordinamos un equipo de{" "}
              <strong>traductores jurados de francés</strong> acreditados. Tu
              traducción la firma directamente un profesional habilitado, sin
              plataformas intermediarias.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Servicio 100% online
            </h3>
            <p className="mt-1 text-slate-700">
              Envío de documentos por email o WhatsApp y{" "}
              <strong>entrega en PDF firmado digitalmente</strong>. Si lo
              necesitas, también podemos enviarte copias en papel por
              mensajería.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Precios claros y plazos realistas
            </h3>
            <p className="mt-1 text-slate-700">
              Te indicamos siempre un{" "}
              <strong>precio cerrado</strong> y un plazo estimado antes de
              empezar. Puedes consultar nuestros{" "}
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

      {/* BLOQUE URGENCIAS FRANCÉS */}
      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de francés urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes una cita de extranjería, una firma notarial, un plazo
              universitario o un viaje próximo, indícanos la{" "}
              <strong>fecha límite</strong> al pedir presupuesto. Según el
              volumen, podemos ofrecer <strong>servicio urgente</strong> en
              traducción jurada de francés.
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
