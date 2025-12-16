// app/traductor-jurado-italiano/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Traductor jurado de italiano | Traducciones juradas italiano-español",
  description:
    "Traducciones juradas de italiano a español y de español a italiano realizadas por traductores jurados. Válidas para trámites en España, Italia y otros países de la UE.",
};

export default function TraductorJuradoItalianoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de italiano
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de italiano para trámites entre España e Italia
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos{" "}
          <strong>
            traducciones juradas de italiano a español y de español a italiano
          </strong>{" "}
          para documentos personales, académicos, laborales, notariales y
          mercantiles. Válidas ante administraciones, notarios, universidades y
          juzgados en España, Italia y otros países de la Unión Europea. Cada
          traducción la firma un <strong>traductor jurado de italiano</strong>,
          sin plataformas intermediarias.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de italiano
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

      {/* DOCUMENTOS */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos habituales en italiano que solemos traducir
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Trabajamos con documentación emitida en Italia para su uso en España,
          y con documentos españoles que deben presentarse ante autoridades
          italianas:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Stato civile */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados del stato civile
            </h3>
            <p className="mt-1 text-slate-700">
              Certificato di nascita, matrimonio, morte, stato di famiglia,
              cittadinanza… para trámites de extranjería, nacionalidad,
              matrimonio o herencias en España o Italia.
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
              Antecedentes y certificados penales
            </h3>
            <p className="mt-1 text-slate-700">
              Certificato del casellario giudiziale, certificato dei carichi
              pendenti y otros documentos necesarios para empleo, oposiciones o
              residencia.
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
              Diplomi, certificati di laurea, esiti d’esame, piani di studio… para
              homologaciones, convalidaciones y estudios en España o en otros
              países.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos académicos habituales →
            </Link>
          </div>

          {/* Laborales / mercantiles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos laborales y mercantiles
            </h3>
            <p className="mt-1 text-slate-700">
              Contratti di lavoro, buste paga, certificazioni INPS, visure
              camerali, statuti societari y otros documentos de empresa para
              trabajar o invertir entre España e Italia.
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
          Apostilla de la Haya en documentos italianos
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Muchos documentos italianos destinados a España requieren{" "}
          <strong>Apostille / Apostilla de la Haya</strong>. En esos casos, suele
          ser necesario traducir el documento y la apostilla mediante traducción
          jurada para que sean aceptados por la administración o el consulado.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Más información en{" "}
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
          Ventajas de trabajar con nuestro traductor jurado de italiano
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Especialistas en España–Italia
            </h3>
            <p className="mt-1 text-slate-700">
              Experiencia en documentación entre España e Italia para temas de
              residencia, ciudadanía, estudios, herencias, compra de vivienda o
              constitución de empresas.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Servicio online, entrega en PDF
            </h3>
            <p className="mt-1 text-slate-700">
              Envío de documentos escaneados o fotografiados y{" "}
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
              suelen pedir en tu tipo de trámite. Puedes consultar nuestros{" "}
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
              ¿Traducción jurada de italiano urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes plazos próximos en consulado, notaría o administración,
              indícanos la <strong>fecha límite</strong> al pedir presupuesto y
              valoraremos la posibilidad de un servicio urgente según el volumen y
              la complejidad de los documentos.
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

