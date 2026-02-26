// app/traductor-jurado-portugues/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import LanguageOfferPanel from "@/components/LanguageOfferPanel";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";

export const metadata: Metadata = {
  title: "Traductor jurado de portugués | Traducciones juradas portugués-español",
  description:
    "Traducciones juradas de portugués a español y de español a portugués realizadas por traductores jurados. Válidas para trámites en España, Portugal y Brasil.",
};

export default function TraductorJuradoPortuguesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de portugués
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de portugués para España, Portugal y Brasil
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos <strong>traducciones juradas de portugués a español y de español a
          portugués</strong> para documentos emitidos en Portugal, Brasil y otros países lusófonos
          que deban presentarse en España o ante autoridades extranjeras. Cada encargo lo firma un{" "}
          <strong>traductor jurado de portugués acreditado</strong>.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de portugués
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
      <LanguageOfferPanel config={LANGUAGE_CONFIGS.portugues} />

      {/* DOCUMENTOS */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos en portugués que solemos traducir
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Documentación habitual de <strong>Portugal y Brasil</strong> para su uso en España:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certidões do registo civil
            </h3>
            <p className="mt-1 text-slate-700">
              Certidões de nascimento, casamento, óbito, união estável… para procesos de
              nacionalidad, residencia, matrimonio o herencias.
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
              Antecedentes y certificados judiciales
            </h3>
            <p className="mt-1 text-slate-700">
              Certidões de registo criminal, antecedentes penales y otros documentos exigidos para
              visados, empleo o residencia.
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
              Diplomas, históricos escolares, certificados universitarios, necesarios para
              homologaciones y estudios en España.
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
              Documentos laborales y de empresa
            </h3>
            <p className="mt-1 text-slate-700">
              Contratos, recibos de salario, declarações de rendimentos, contratos sociales,
              registos comerciales y más.
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
          Apostilla de la Haya en documentos portugueses y brasileños
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          En muchos casos, los documentos portugueses o brasileños destinados a España deben llevar{" "}
          <strong>Apostille / Apostilla de la Haya</strong>. Suele requerirse la traducción jurada
          del documento y de la apostilla.
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

      {/* URGENCIAS */}
      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de portugués urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes prisa por entregar documentos en consulado, universidad o administración,
              indícanos la <strong>fecha límite</strong> al pedir presupuesto y revisaremos la
              posibilidad de un servicio urgente.
            </p>
            <p className="mt-2 text-xs text-slate-300">
              Puedes consultar una orientación general en nuestra página de{" "}
              <Link
                href="/precios-traduccion-jurada"
                className="text-sky-300 underline-offset-2 hover:underline"
              >
                precios de traducción jurada
              </Link>
              .
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
