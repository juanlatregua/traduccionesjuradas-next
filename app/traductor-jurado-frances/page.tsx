import type { Metadata } from "next";
import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaProduct } from "@/components/SchemaProduct";
import FrenchOfferPanel from "@/components/FrenchOfferPanel";
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
      "Para documentos de 1 hoja y para 2 hojas cuando una es apostilla, el plazo es 24 h (francés-español y español-francés). En documentos más largos, confirmamos plazo al revisar el archivo.",
  },
  {
    question: "¿Ofrecéis traducción jurada urgente de francés?",
    answer:
      "En documentos de 1 hoja y en 2 hojas con apostilla no aplicamos recargo de urgencia. Para volúmenes mayores, te confirmamos plazo y coste al revisar el material.",
  },
  {
    question: "¿Entregáis en PDF o en papel?",
    answer:
      "Entregamos en PDF firmado digitalmente. Si necesitas copia física, podemos gestionar el envío por mensajería.",
  },
];

export const metadata: Metadata = {
  title: "Traductor jurado de francés: precio por palabra y plazos reales",
  description:
    "Traducción jurada francés-español y español-francés con traductor jurado acreditado por el MAEC. Precio por palabra de 0,08 EUR y precios cerrados para documentos breves para Francia, Bélgica, Suiza, Luxemburgo, Marruecos, Senegal, Costa de Marfil, Argelia y otros países francófonos.",
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
            price: "40.00",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
          },
          {
            price: "50.00",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
          },
          {
            price: "60.00",
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
        <p className="mt-2 text-sm text-slate-700 sm:text-base">
          Trabajamos de forma habitual con documentación emitida en <strong>Francia, Bélgica, Suiza,
          Luxemburgo, Marruecos, Senegal, Costa de Marfil y Argelia</strong>, además de otros países
          francófonos.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="#panel-frances"
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Empezar ahora: calcular y contratar
          </Link>
          <a
            href={WHATSAPP_LINK}
            className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Consultar por WhatsApp
          </a>
          <Link
            href="/acceso"
            className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
          >
            Acceso seguro con Google (opcional)
          </Link>
        </div>
      </header>

      <div id="panel-frances">
        <FrenchOfferPanel />
      </div>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Contratación en 3 pasos
        </h2>
        <ol className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Paso 1</p>
            <p className="mt-1 font-semibold text-slate-900">Selecciona tu caso</p>
            <p className="mt-1">Elige tipo de documento y combinación fr-es o es-fr.</p>
          </li>
          <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Paso 2</p>
            <p className="mt-1 font-semibold text-slate-900">Revisa precio y plazo</p>
            <p className="mt-1">Si es caso cerrado, puedes pagar al instante.</p>
          </li>
          <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Paso 3</p>
            <p className="mt-1 font-semibold text-slate-900">Recibe tu traducción</p>
            <p className="mt-1">Entrega en PDF firmado digitalmente y papel opcional.</p>
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Cobertura francófona y condiciones
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Francia, Bélgica, Suiza, Luxemburgo, Marruecos, Senegal, Costa de Marfil y Argelia. Mismo
          criterio de precio para francés-español y español-francés.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Precio por palabra francés: 0,08 EUR.</li>
          <li>1 hoja: 40 EUR. 2 hojas con apostilla: 50 EUR. 2 hojas sin apostilla: 60 EUR.</li>
          <li>Entrega base en PDF firmado digitalmente. Envío en papel: +24 h.</li>
          <li>Empresa: HBTJ Consultores Lingüísticos S.L. (CIF B93712784).</li>
        </ul>
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
