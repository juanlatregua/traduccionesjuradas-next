// app/traductor-jurado-catalan/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import LanguageOfferPanel from "@/components/LanguageOfferPanel";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title: "Traductor jurado de catalán | Traducciones juradas catalán-español",
  description:
    "Traducciones juradas de catalán a español y de español a catalán realizadas por traductores jurados. Válidas para trámites en Cataluña, Valencia, Baleares y el resto de España.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-catalan",
  },
};

export default function TraductorJuradoCatalanPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-traductor-jurado-catalan"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Traductor jurado de catalán", url: "https://www.traduccionesjuradas.net/traductor-jurado-catalan" },
        ]}
      />
      <SchemaFAQ
        id="faq-traductor-jurado-catalan"
        items={[
          {
            question: "¿Cuándo necesito una traducción jurada de catalán?",
            answer:
              "Cuando un documento emitido en catalán debe presentarse ante una administración estatal o en otro país que no acepta el catalán como lengua oficial, se requiere traducción jurada al castellano o al idioma de destino.",
          },
          {
            question: "¿Cuánto cuesta una traducción jurada de catalán?",
            answer:
              "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
          },
          {
            question: "¿En cuánto tiempo se entrega una traducción jurada de catalán?",
            answer:
              "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
          },
        ]}
      />
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traductor jurado de catalán
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de catalán para trámites en toda España
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos <strong>traducciones juradas de catalán a español y de español a
          catalán</strong> para documentos emitidos en Cataluña, Comunidad Valenciana, Islas
          Baleares y otras administraciones que usen el catalán como lengua de trabajo.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto de traducción jurada de catalán
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
      <LanguageOfferPanel config={LANGUAGE_CONFIGS.catalan} />

      {/* BLOQUE PRECIO / PLAZO / VALIDEZ */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Precio de traducción jurada de catalán
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

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos habituales en catalán
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Documentos emitidos por administraciones autonómicas, universidades, colegios
          profesionales y juzgados:
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Certificados civiles y administrativos
            </h3>
            <p className="mt-1 text-slate-700">
              Certificats de naixement, matrimoni, defunció, empadronament, convivència, etc.
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
              Títulos y expedientes académicos
            </h3>
            <p className="mt-1 text-slate-700">
              Títols universitaris, certificats de notes, expedients acadèmics, certificats de
              capacitació, etc.
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
              Documentos judiciales y notariales
            </h3>
            <p className="mt-1 text-slate-700">
              Sentències, decrets, escriptures, poders notarials i altres documents que han de
              presentar-se en altres territoris.
            </p>
            <Link
              href="/documentos-oficiales/documentos-juridicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos jurídicos →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Documentos laborales y de empresa
            </h3>
            <p className="mt-1 text-slate-700">
              Contractes, nòmines, certificats d’empresa, estatuts socials i altres documents per a
              tràmits a escala estatal o internacional.
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
          Apostilla de la Haya en documentos catalanes
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Cuando un documento emitido en catalán por una administración autonómica necesita
          surtir efecto fuera de España, puede requerirse{" "}
          <strong>Apostilla de la Haya</strong> junto con la traducción jurada al idioma
          del país de destino. También es habitual la traducción jurada del catalán al
          castellano para trámites ante administraciones estatales que no aceptan documentos
          en lengua cooficial.
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
          Ventajas de trabajar con nuestro traductor jurado de catalán
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Experiencia en documentación autonómica
            </h3>
            <p className="mt-1 text-slate-700">
              Acostumbrados a trabajar con documentos emitidos por administraciones de
              Cataluña, Comunidad Valenciana e Islas Baleares: resoluciones, sentencias,
              certificados y escrituras.
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

      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              ¿Traducción jurada de catalán urgente?
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              Si tienes un plazo de recurso, una cita en otra administración o una matrícula
              universitaria, indícanos la <strong>fecha límite</strong> al pedir presupuesto y
              valoraremos un servicio urgente.
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

