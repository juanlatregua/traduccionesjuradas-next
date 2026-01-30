// app/documentos-oficiales/antecedentes-penales/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AntecedentesMiniForm } from "@/components/AntecedentesMiniForm";
import { SchemaProduct } from "@/components/SchemaProduct";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducción jurada de antecedentes penales extranjeros | Casier judiciaire y certificados de buena conducta",
  description:
    "Traducción jurada de certificados de antecedentes penales y documentos equivalentes extranjeros (casier judiciaire, bulletin n°3, police clearance, buena conducta) para trámites de extranjería, visados, nacionalidad, teletrabajo y empleo en España.",
};

export default function AntecedentesPenalesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaProduct
        name="Traducción jurada de antecedentes penales"
        description="Precio orientativo para traducir certificados de antecedentes penales con firma y sello de traductor jurado."
        sku="antecedentes-penales"
        offers={[
          { price: "50.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
          { price: "45.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
          { price: "75.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
          { price: "40.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
        ]}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-antecedentes"
        items={[
          { name: "Inicio", url: "https://traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://traduccionesjuradas.net/documentos-oficiales" },
          { name: "Antecedentes penales", url: "https://traduccionesjuradas.net/documentos-oficiales/antecedentes-penales" },
        ]}
      />
      <SchemaFAQ
        id="faq-antecedentes"
        items={[
          {
            question: "¿Vale la traducción en PDF o necesito papel?",
            answer:
              "El PDF firmado digitalmente por el traductor jurado es válido en la mayoría de trámites. Si el organismo exige papel, lo enviamos por mensajería.",
          },
          {
            question: "¿Se traduce también la Apostilla de La Haya?",
            answer:
              "Sí, la apostilla forma parte del documento y debe traducirse junto con el certificado de antecedentes penales.",
          },
          {
            question: "¿Qué plazo orientativo tiene la traducción?",
            answer: "Español→Inglés 2 días, Español→Francés 1 día, Francés apostillado→Español 1 día, Portugués apostillado→Español 2 días.",
          },
          {
            question: "¿Cómo envío el documento?",
            answer:
              "Puedes adjuntar un PDF o foto clara desde la propia página o enviarlo a hola@traduccionesjuradas.net. Revisamos sellos y apostilla antes de confirmar el precio.",
          },
        ]}
      />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Antecedentes penales
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traducción jurada de certificados de antecedentes penales extranjeros
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          El certificado de antecedentes penales (y sus equivalentes en otros
          países) es uno de los documentos más sensibles y solicitados en
          trámites de extranjería, nacionalidad, visados, empleo y teletrabajo.
          Realizamos la <strong>traducción jurada de antecedentes penales
          extranjeros</strong> para que sean aceptados por las autoridades
          españolas y, cuando corresponde, por otros países.
        </p>
      </header>

      {/* USOS HABITUALES */}
      <section className="mt-8 space-y-4 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
          ¿Para qué trámites se pide la traducción de antecedentes penales?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Permisos de residencia inicial y renovaciones.</li>
          <li>Visados de larga duración, estudios y trabajo.</li>
          <li>Solicitudes de nacionalidad o cartas de naturaleza.</li>
          <li>Reagrupación familiar y desplazamientos de menores.</li>
          <li>
            Teletrabajo desde España para empresas extranjeras (especialmente
            clientes de Marruecos y otros países francófonos).
          </li>
          <li>
            Puestos de trabajo sensibles (educación, sanidad, menores, etc.).
          </li>
        </ul>
        <p>
          En la mayoría de estos procedimientos se exige que el certificado
          sea reciente (normalmente menos de 3 o 6 meses) y que, si procede,
          se haya legalizado con la{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-emerald-700 underline"
          >
            Apostilla de La Haya
          </Link>{" "}
          antes de la traducción jurada.
        </p>
      </section>

      {/* TARIFAS Y PLAZOS */}
      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Tarifas y plazos orientativos
        </h2>
        <p className="mt-2 text-slate-600">
          Precios para certificados de antecedentes penales (PDF o foto legible). Incluyen firma y sello de traductor jurado.
        </p>
        <AntecedentesMiniForm />
      </section>

      {/* TIPOS DE DOCUMENTOS */}
      <section className="mt-10 space-y-4 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
          Documentos que entran en esta categoría
        </h2>
        <p>
          No todos los países utilizan exactamente la expresión
          &quot;certificado de antecedentes penales&quot;, pero muchos
          documentos cumplen la misma función. Algunos ejemplos:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Certificado de Antecedentes Penales</strong> emitido por el
            Ministerio de Justicia español.
          </li>
          <li>
            <strong>Certificados de delitos de naturaleza sexual</strong>, que
            en algunos trámites se exigen de forma separada.
          </li>
          <li>
            <strong>Casier judiciaire</strong> (Marruecos, Francia y otros
            países francófonos).
          </li>
          <li>
            <strong>Bulletin n° 3</strong> y otros extractos de antecedentes
            judiciales.
          </li>
          <li>
            <strong>Certificados de buena conducta</strong> o{" "}
            <em>Police Clearance Certificates</em> emitidos por autoridades
            policiales o judiciales.
          </li>
        </ul>
        <p>
          Todos estos documentos se traducen de forma jurada y se entregan con
          firma, sello y declaración de veracidad del traductor jurado.
        </p>
      </section>

      {/* PAÍSES Y APOSTILLA */}
      <section className="mt-10 space-y-4 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
          Diferencias por país y Apostilla de La Haya
        </h2>
        <p>
          En la práctica, muchos certificados de antecedentes penales
          extranjeros que se presentan en España deben ir{" "}
          <strong>apostillados</strong> o legalizados antes de la traducción
          jurada. La situación típica que vemos es:
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Marruecos, Francia y otros países con apostilla
          </h3>
          <p>
            En el caso de <strong>Marruecos</strong>, <strong>Francia</strong> y
            otros países que aplican el Convenio de La Haya, el{" "}
            <strong>casier judiciaire</strong> suele presentarse con Apostilla
            de La Haya cuando se va a utilizar en España.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              La administración española suele rechazar certificados sin
              apostilla cuando la exigencia es clara.
            </li>
            <li>
              La traducción jurada debe incluir siempre la página de la
              apostilla.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Países africanos francófonos sin apostilla
          </h3>
          <p>
            En algunos países africanos francófonos (como Senegal, Costa de
            Marfil u otros), los certificados de antecedentes penales pueden
            llegar <strong>sin apostilla</strong> porque:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>El país no aplica la Apostilla de La Haya, o</li>
            <li>
              La apostilla no está disponible para este tipo de documento.
            </li>
          </ul>
          <p>
            En estos casos es frecuente que se utilicen otros sistemas de
            legalización (sellos ministeriales, legalización consular, etc.). Es
            importante confirmar siempre los requisitos en el consulado español
            o en la oficina de Extranjería que tramita el expediente.
          </p>
        </div>

        <p className="text-xs text-slate-600">
          Podemos orientarte según nuestra experiencia, pero los requisitos
          finales (apostilla, legalización adicional, antigüedad del
          certificado) dependen siempre de la autoridad que tramita tu
          expediente en España.
        </p>
      </section>

      {/* RELACIÓN CON TELETRABAJO Y MARRUECOS */}
      <section className="mt-10 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
          Antecedentes penales en expedientes de teletrabajo y clientes de
          Marruecos
        </h2>
        <p>
          En muchos casos de{" "}
          <strong>teletrabajo desde España para empresas extranjeras</strong>{" "}
          (especialmente en el caso de clientes marroquíes), el certificado de
          antecedentes penales forma parte del paquete obligatorio de
          documentación junto con:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Certificados de nacimiento y documentos de unidad familiar.</li>
          <li>Certificados de salarios y volumen de negocio declarado.</li>
          <li>Registre du Commerce y otros documentos mercantiles.</li>
          <li>Contrato de trabajo y autorizaciones de teletrabajo.</li>
        </ul>
        <p>
          Si este es tu caso, también puedes consultar:
        </p>
        <p className="space-x-2">
          <Link
            href="/teletrabajo"
            className="font-semibold text-emerald-700 hover:underline"
          >
            Traducciones juradas para teletrabajar en España
          </Link>
          <span className="text-slate-400">·</span>
          <Link
            href="/marruecos"
            className="font-semibold text-emerald-700 hover:underline"
          >
            Documentos marroquíes para España
          </Link>
        </p>
      </section>

      {/* CÓMO ENVIAR LOS DOCUMENTOS */}
      <section className="mt-10 space-y-4 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
          ¿Cómo enviarnos tu certificado de antecedentes penales?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Haz una foto clara o un escaneo legible del certificado (y de la
            apostilla, si la tiene).
          </li>
          <li>
            Comprueba que se leen bien el nombre completo, la fecha de
            nacimiento y todos los sellos y firmas.
          </li>
          <li>
            Indícanos para qué trámite lo necesitas (nacionalidad, residencia,
            teletrabajo, visado, etc.).
          </li>
        </ul>
        <p>
          Prepararemos un presupuesto ajustado y te indicaremos los plazos de
          entrega. Podemos enviar la traducción jurada en PDF firmado
          digitalmente y, si lo necesitas, también en papel.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-sm">
        <h2 className="text-lg font-semibold text-emerald-900">
          ¿Necesitas traducir tu certificado de antecedentes penales?
        </h2>
        <p className="mt-1 text-slate-800">
          Envíanos tu certificado (y la apostilla o legalización, si la tiene)
          en PDF o foto clara y te responderemos con un precio cerrado y un
          plazo estimado de entrega. Trabajamos tanto con certificados emitidos
          en España como con{" "}
          <strong>antecedentes penales de Marruecos, Francia y otros países
          extranjeros</strong>.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Solicitar presupuesto
          </a>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Antecedentes%20penales%20-%20Presupuesto"
            className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            O enviar directamente el documento por email
          </a>
        </div>
      </section>
    </main>
  );
}
