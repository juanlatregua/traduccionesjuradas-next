import type { Metadata } from "next";
import Link from "next/link";
import { WHATSAPP_LINK } from "@/lib/contact";
import dynamic from "next/dynamic";

const PriceEstimator = dynamic(() => import("@/components/PriceEstimator"), {
  ssr: false,
});
const mailLink =
  "mailto:hola@traduccionesjuradas.net?subject=Precios%20traducci%C3%B3n%20jurada";

export const metadata: Metadata = {
  title: "Precios de traducción jurada | Precio cerrado al instante",
  description:
    "Precios de traducción jurada según tipo de documento, idioma y volumen. Sube tu documento y recibe precio cerrado al instante. Certificados, expedientes académicos, contratos y documentación mercantil.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/precios-traduccion-jurada" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Precios+de+traducci%C3%B3n+jurada&subtitle=Precio+cerrado+al+instante+seg%C3%BAn+documento+e+idioma",
        width: 1200,
        height: 630,
        alt: "Precios de traducción jurada — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function PreciosTraduccionJuradaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Precios de traducción jurada
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Precios de traducción jurada: precio cerrado al instante
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          El precio de una traducción jurada depende del <strong>idioma</strong>,
          del <strong>tipo de documento</strong>, de la <strong>extensión</strong> y,
          en algunos casos, de la <strong>urgencia</strong>. Sube tu documento y
          recibe un precio cerrado al instante, o consulta los rangos de referencia
          a continuación.
        </p>
      </header>

      {/* FACTORES QUE INFLUYEN */}
      <section className="mt-8 space-y-3 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿De qué depende el precio de una traducción jurada?
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Idioma</strong>: no cuesta lo mismo una traducción jurada de
            francés que una de sueco o noruego.
          </li>
          <li>
            <strong>Tipo de documento</strong>: no es igual un certificado breve
            que un contrato largo o un expediente académico completo.
          </li>
          <li>
            <strong>Extensión</strong>: número de palabras o de páginas reales a
            traducir.
          </li>
          <li>
            <strong>Formato</strong>: documentos muy escaneados, manuscritos o
            con tablas complejas pueden requerir más tiempo de maquetación.
          </li>
          <li>
            <strong>Plazo</strong>: en algunos casos, los encargos urgentes
            pueden llevar suplemento.
          </li>
        </ul>
        <p className="text-xs text-sepia">
          Los rangos que aparecen en esta página son de referencia.
          Sube tu documento para recibir un <strong>precio cerrado</strong> al instante.
        </p>
      </section>

      {/* BLOQUES DE PRECIOS */}
      <section className="mt-10 grid gap-6 md:grid-cols-2 text-sm text-sepia">
        {/* REGISTRO CIVIL */}
        <div className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold text-encre">
            Certificados del Registro Civil
          </h2>
          <p className="mt-2">
            Certificados breves de nacimiento, matrimonio, defunción,
            antecedentes penales o fe de vida y estado.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
            <li>
              <strong>Idiomas más habituales</strong>: francés, alemán, inglés.
            </li>
            <li>
              <strong>Precio cerrado</strong> por certificado breve que
              se confirma al analizar el documento.
            </li>
            <li>
              Si el certificado tiene varias páginas o anotaciones extensas,
              puede ajustarse el presupuesto.
            </li>
          </ul>
        </div>

        {/* EXPEDIENTES ACADÉMICOS */}
        <div className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold text-encre">
            Títulos y expedientes académicos
          </h2>
          <p className="mt-2">
            Títulos universitarios, certificados de notas, &quot;transcripts&quot;,
            planes de estudios y certificados de idiomas (DELF/DALF, Goethe,
            Cambridge, etc.).
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
            <li>
              Suelen presupuestarse en función del número de páginas o palabras.
            </li>
            <li>
              Es frecuente aplicar un precio por conjunto (título + notas +
              certificados complementarios).
            </li>
          </ul>
        </div>

        {/* DOCUMENTOS LABORALES */}
        <div className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold text-encre">
            Documentos laborales y económicos
          </h2>
          <p className="mt-2">
            Contratos de trabajo, nóminas, certificados de empresa, &quot;attestations
            de salaire&quot;, declaraciones de ingresos y medios económicos.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
            <li>
              Muy habituales en expedientes de extranjería y teletrabajo desde
              el extranjero.
            </li>
            <li>
              Se puede aplicar un precio por paquete cuando se trata de varias
              nóminas o certificados similares.
            </li>
          </ul>
        </div>

        {/* DOCUMENTOS JURÍDICOS Y MERCANTILES */}
        <div className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold text-encre">
            Documentos jurídicos y mercantiles
          </h2>
          <p className="mt-2">
            Sentencias, autos, poderes notariales, escrituras, estatutos de
            sociedades, cuentas anuales, actas y otro documento mercantil.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
            <li>
              La extensión y complejidad jurídica influyen de forma directa en
              el precio.
            </li>
            <li>
              En empresas que quieren operar en España, es habitual preparar un
              presupuesto global para todo el dossier.
            </li>
          </ul>
        </div>
      </section>

      {/* PAQUETES / CASOS COMPLEJOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Paquetes completos de documentos (teletrabajo, extranjería, herencias…)
        </h2>
        <p>
          En muchos casos no se trata de un solo documento aislado, sino de un
          <strong>paquete completo</strong>: por ejemplo, expedientes para{" "}
          <strong>teletrabajar en España desde Marruecos u otros países</strong>,
          reagrupación familiar, nacionalidad o herencias con documentos de
          varios países.
        </p>
        <p>
          En estos casos, solemos preparar un presupuesto conjunto para todos
          los documentos necesarios (medios económicos, certificados del
          Registro Civil, antecedentes penales, documentos mercantiles, etc.),
          de manera que tengas una visión clara del coste total.
        </p>
        <p className="text-xs text-sepia">
          Si te encuentras en una situación así, puedes indicarnos que se trata
          de un <strong>paquete de documentos para un expediente concreto</strong>
          y prepararemos un presupuesto global en lugar de ir documento por
          documento.
        </p>
      </section>

      {/* POR QUÉ NO HAY LISTA CERRADA DE TARIFAS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Por qué no publicamos una tabla cerrada de tarifas?
        </h2>
        <p>
          Cada documento tiene unas características propias: no es lo mismo un
          certificado estándar de una página que un contrato de 25 páginas con
          anexos, ni es igual traducir del francés que de un idioma menos
          habitual. Publicar una tabla cerrada de precios puede llevar a
          malentendidos.
        </p>
        <p>
          Preferimos trabajar con <strong>presupuestos claros y personalizados</strong>,
          explicando siempre qué se incluye y cuáles son los plazos estimados.
        </p>
      </section>

      {/* ESTIMADOR ORIENTATIVO */}
      <PriceEstimator />

      {/* CTA FINAL */}
      <section className="mt-12 rounded-3xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Quieres saber cuánto costaría tu traducción jurada?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tus documentos (o fotos claras) y te responderemos con un
          precio cerrado y un plazo aproximado. No hace falta que lo tengas todo
          decidido: podemos orientarte sobre qué es imprescindible traducir para
          tu expediente.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Obtener presupuesto instantáneo
          </Link>
          <a
            href={mailLink}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar documentos por email
          </a>
          <a
            href={WHATSAPP_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar fotos por WhatsApp
          </a>
        </div>
        <p className="mt-2 text-[11px] text-sepia">
          Damos prioridad a las consultas por email y WhatsApp para poder
          revisar tus documentos con calma y ofrecerte un presupuesto ajustado.
        </p>
      </section>
    </main>
  );
}
