import type { Metadata } from "next";
import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaProduct } from "@/components/SchemaProduct";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

const FAQ_ITEMS = [
  {
    question: "¿La traducción jurada de francés vale para Extranjería en España?",
    answer:
      "Sí. La traducción la firma un traductor jurado acreditado por el MAEC y se usa en trámites de Extranjería, nacionalidad, Registro Civil, universidades y notarías.",
  },
  {
    question: "¿Hay que traducir también la Apostilla de La Haya?",
    answer:
      "Sí, cuando el documento lleva apostilla se traduce también esa página para evitar requerimientos del organismo de destino.",
  },
  {
    question: "¿Puedo enviar una foto del documento en lugar de escaneo?",
    answer:
      "Sí, si la imagen es legible y se ven completos los sellos y firmas. Si falta calidad, te pediremos un escaneo antes de cerrar el trabajo.",
  },
  {
    question: "¿Cuánto tarda una traducción jurada de francés?",
    answer:
      "Para certificados breves francés-español, el plazo habitual es 24-48 h. Si hay varias páginas o maquetación compleja, el plazo se confirma al revisar el archivo.",
  },
  {
    question: "¿Ofrecéis traducción jurada urgente de francés?",
    answer:
      "Sí, en función del volumen y la fecha límite. Indícanos tu cita o vencimiento y te diremos si es viable con plazo y precio cerrados.",
  },
  {
    question: "¿Entregáis en PDF o en papel?",
    answer:
      "Entregamos en PDF firmado digitalmente. Si necesitas copia física, podemos gestionar el envío por mensajería.",
  },
];

const PRICE_ROWS = [
  {
    tipo: "Certificado breve",
    ejemplos: "Naissance, mariage, casier judiciaire (1 pág.)",
    normal: "45-55 EUR",
    urgente: "65-85 EUR",
    plazoNormal: "24-48 h",
    plazoUrgente: "Mismo día / 24 h",
  },
  {
    tipo: "Documento académico",
    ejemplos: "Diploma, relevé de notes, attestation",
    normal: "50-90 EUR",
    urgente: "75-130 EUR",
    plazoNormal: "24-72 h",
    plazoUrgente: "24-48 h",
  },
  {
    tipo: "Documento jurídico/mercantil",
    ejemplos: "Contrato, poderes, estatutos, Kbis",
    normal: "Desde 0,14 EUR/palabra",
    urgente: "Desde 0,18 EUR/palabra",
    plazoNormal: "Según volumen",
    plazoUrgente: "Prioridad con suplemento",
  },
];

export const metadata: Metadata = {
  title: "Traductor jurado de francés: precio, plazo y servicio urgente",
  description:
    "Traducción jurada francés-español y español-francés con traductor jurado acreditado por el MAEC. Precios orientativos, plazos reales y opción urgente para trámites en España.",
};

export default function TraductorJuradoFrancesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaProduct
        name="Traducción jurada de francés"
        description="Servicio de traducción jurada francés-español y español-francés para trámites oficiales en España."
        category="Traducción jurada de francés"
        sku="traductor-jurado-frances"
        offers={[
          {
            price: "45.00",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
          },
          {
            price: "55.00",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
          },
        ]}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-frances"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traductor jurado de francés",
            url: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
          },
        ]}
      />
      <SchemaFAQ id="faq-frances" items={FAQ_ITEMS} />

      <nav aria-label="Migas de pan" className="mb-4 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-700 hover:underline">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <span>Traductor jurado de francés</span>
      </nav>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traducción jurada de francés
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traductor jurado de francés con precio orientativo y opción urgente
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos <strong>traducciones juradas de francés a español y de español a francés</strong> para
          presentar en Extranjería, Registro Civil, universidades, notarías y otros organismos. Todas las
          traducciones las firma un <strong>traductor jurado acreditado por el MAEC</strong>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto cerrado
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-slate-300 px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
          >
            Calcular precio orientativo
          </Link>
          <a
            href={WHATSAPP_LINK}
            className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </header>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Precios y plazos orientativos: francés jurado normal vs urgente
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Estos importes son orientativos para ayudarte a decidir rápido. El precio final se confirma al revisar
          el documento (extensión real, sellos, apostilla y formato).
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Ejemplos</th>
                <th className="px-3 py-2 font-semibold">Precio normal</th>
                <th className="px-3 py-2 font-semibold">Plazo normal</th>
                <th className="px-3 py-2 font-semibold">Precio urgente</th>
                <th className="px-3 py-2 font-semibold">Plazo urgente</th>
              </tr>
            </thead>
            <tbody>
              {PRICE_ROWS.map((row) => (
                <tr key={row.tipo} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.tipo}</td>
                  <td className="px-3 py-3 text-slate-700">{row.ejemplos}</td>
                  <td className="px-3 py-3 text-slate-700">{row.normal}</td>
                  <td className="px-3 py-3 text-slate-700">{row.plazoNormal}</td>
                  <td className="px-3 py-3 text-slate-700">{row.urgente}</td>
                  <td className="px-3 py-3 text-slate-700">{row.plazoUrgente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <a
            href={MAIL_LINK}
            className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
            Enviar documento por email
          </a>
          <Link
            href="/precios-traduccion-jurada"
            className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Ver tarifas generales
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Documentos de francés que más nos piden
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Registro civil francés</h3>
            <p className="mt-1 text-slate-700">
              Acte de naissance, acte de mariage, acte de divorce, acte de deces, certificat de celibat y
              documentos de etat civil.
            </p>
            <Link
              href="/documentos-oficiales/certificados-registro-civil"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver certificados civiles
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Casier judiciaire y apostilla</h3>
            <p className="mt-1 text-slate-700">
              Traducción jurada de antecedentes penales franceses o marroquíes y de la Apostilla de La Haya en el
              mismo encargo.
            </p>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver antecedentes penales
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Titulos y expedientes academicos</h3>
            <p className="mt-1 text-slate-700">
              Diplome, releve de notes, attestation de reussite, certificados DELF/DALF y documentacion para
              homologacion.
            </p>
            <Link
              href="/documentos-oficiales/documentos-academicos"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver documentos academicos
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Contratos y documentacion mercantil</h3>
            <p className="mt-1 text-slate-700">
              Contrats de travail, fiches de paie, pouvoirs, statuts y extrait Kbis para empleo, inversion o
              constitucion de sociedades en Espana.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link href="/documentos-oficiales/documentos-laborales" className="font-semibold text-emerald-700 hover:underline">
                Documentos laborales
              </Link>
              <Link href="/documentos-oficiales/documentos-mercantiles" className="text-slate-700 hover:underline">
                Documentos mercantiles
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Preguntas frecuentes sobre francés jurado</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold text-slate-900">{item.question}</summary>
              <p className="mt-2 text-slate-700">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">¿Necesitas traduccion jurada de frances urgente?</h2>
            <p className="mt-2 text-sm text-slate-200">
              Envia el documento e indicanos fecha limite. Te confirmamos en la misma respuesta si llegamos a
              tiempo, con precio y plazo cerrados.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <a
              href={WHATSAPP_LINK}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-center font-semibold text-white hover:bg-emerald-600"
            >
              Escribir por WhatsApp
            </a>
            <a href={MAIL_LINK} className="text-center text-xs font-medium text-sky-300 hover:underline">
              O enviar email a hola@traduccionesjuradas.net
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
