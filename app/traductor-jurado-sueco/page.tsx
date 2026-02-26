// app/traductor-jurado-sueco/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import LanguageOfferPanel from "@/components/LanguageOfferPanel";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title: "Traductor jurado de sueco | Traducciones juradas sueco-español",
  description:
    "Traducciones juradas de sueco a español y de español a sueco realizadas por traductores jurados acreditados. Válidas para trámites en España y Suecia: certificados civiles, antecedentes, estudios y documentación laboral.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-sueco",
  },
};

export default function TraductorJuradoSuecoPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-traductor-jurado-sueco"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Traductor jurado de sueco", url: "https://www.traduccionesjuradas.net/traductor-jurado-sueco" },
        ]}
      />
      <SchemaFAQ
        id="faq-traductor-jurado-sueco"
        items={[
          {
            question: "¿Qué validez tiene una traducción jurada de sueco en España?",
            answer:
              "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
          },
          {
            question: "¿Cuánto cuesta una traducción jurada de sueco?",
            answer:
              "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
          },
          {
            question: "¿En cuánto tiempo se entrega una traducción jurada de sueco?",
            answer:
              "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
          },
        ]}
      />
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

      {/* BLOQUE PRECIO / PLAZO / VALIDEZ */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Precio de traducción jurada de sueco
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

      {/* APOSTILLA */}
      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Documentos suecos con Apostilla de la Haya
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Muchos documentos suecos destinados a España u otros países requieren{" "}
          <strong>Apostille / Apostilla de la Haya</strong>. Es habitual en
          certificados civiles, antecedentes, documentos judiciales y mercantiles.
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

      {/* VENTAJAS */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Ventajas de trabajar con nuestro traductor jurado de sueco
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Experiencia en trámites España–Suecia
            </h3>
            <p className="mt-1 text-slate-700">
              Acostumbrados a documentación entre España y Suecia: residencia,
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

