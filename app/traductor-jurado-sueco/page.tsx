// app/traductor-jurado-sueco/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import LanguageOfferPanel from "@/components/LanguageOfferPanel";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";

export const metadata: Metadata = {
  title: "Traductor jurado de sueco | Traducciones juradas sueco-español",
  description:
    "Traducciones juradas de sueco a español y de español a sueco realizadas por traductores jurados acreditados. Válidas para trámites en España y Suecia: certificados civiles, antecedentes, estudios y documentación laboral.",
};

export default function TraductorJuradoSuecoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de sueco
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de sueco para trámites entre España y Suecia
        </h1>

        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos <strong>traducciones juradas de sueco a español y de español a sueco</strong> 
          válidas para administraciones públicas, notarías, universidades y empresas.
          Traductores jurados acreditados, con entrega en PDF firmado digitalmente.
        </p>

        {/* CTA PRINCIPAL */}
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de sueco
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
      <LanguageOfferPanel config={LANGUAGE_CONFIGS.sueco} />

      {/* DOCUMENTOS FRECUENTES */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos suecos más habituales
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Traducimos documentos emitidos en Suecia para su uso en España, así como documentación
          española destinada a autoridades suecas:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">

          {/* CIVILES */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados civiles
            </h3>
            <p className="mt-1 text-slate-700">
              Personbevis, certificados de nacimiento, matrimonio, familia y otros documentos del
              registro civil sueco.
            </p>
            <Link
              href="/documentos-oficiales/certificados-registro-civil"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre certificados →
            </Link>
          </div>

          {/* ANTECEDENTES */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Antecedentes y certificados de policía
            </h3>
            <p className="mt-1 text-slate-700">
              Belastningsregister, extractos policiales y certificados de buena conducta necesarios
              para empleo o residencia.
            </p>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver más sobre antecedentes penales →
            </Link>
          </div>

          {/* ACADÉMICOS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Estudios y cualificaciones
            </h3>
            <p className="mt-1 text-slate-700">
              Certificados escolares, títulos universitarios y profesionales para homologación,
              estudios o reconocimiento oficial.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos académicos habituales →
            </Link>
          </div>

          {/* LABORALES Y EMPRESA */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Empleo y empresa
            </h3>
            <p className="mt-1 text-slate-700">
              Contratos de trabajo, nóminas, certificados de empresa, documentos mercantiles y
              societarios suecos.
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

      {/* URGENCIAS */}
      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de sueco urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes una cita próxima en extranjería, notaría, universidad o empresa, indícanos
              la <strong>fecha límite</strong>. Revisaremos disponibilidad para ofrecer servicio
              urgente cuando sea posible.
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

