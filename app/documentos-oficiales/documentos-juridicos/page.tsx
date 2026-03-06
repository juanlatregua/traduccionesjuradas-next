// app/documentos-oficiales/documentos-juridicos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RelatedDocuments } from "@/components/RelatedDocuments";

export const metadata: Metadata = {
  title:
    "Traducción jurada de documentos jurídicos extranjeros | Divorcios, herencias y poderes",
  description:
    "Traducción jurada de documentos jurídicos extranjeros para su uso en España: sentencias de divorcio, capitulaciones matrimoniales, herencias, testamentos, poderes notariales, resoluciones judiciales y actas. Enfoque práctico para compraventa de inmuebles, sucesiones y extranjería, especialmente con documentos de países francófonos como Marruecos y Francia.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-juridicos" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traducci%C3%B3n+jurada+de+documentos+jur%C3%ADdicos&subtitle=Divorcios%2C+herencias%2C+poderes+y+sentencias",
        width: 1200,
        height: 630,
        alt: "Traducción jurada de documentos jurídicos — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function DocumentosJuridicosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-juridicos"
        items={[
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
          { name: "Documentos jurídicos", url: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-juridicos" },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
        { name: "Documentos jurídicos", href: "/documentos-oficiales/documentos-juridicos" },
      ]} />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Documentos jurídicos
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de documentos jurídicos
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Traducimos de forma jurada{" "}
          <strong>sentencias, capitulaciones matrimoniales, herencias, testamentos, poderes notariales y otras resoluciones judiciales</strong>{" "}
          emitidas en el extranjero para que puedan utilizarse ante tribunales, notarías,
          registros y administraciones en España o en otros países.
        </p>
      </header>

      {/* TIPOS DE DOCUMENTOS */}
      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Principales documentos jurídicos que traducimos
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Sentencias de divorcio</strong> y resoluciones sobre medidas
            paternofiliales (custodia, visitas, pensiones).
          </li>
          <li>
            <strong>Capitulaciones matrimoniales</strong>, regímenes
            económicos, acuerdos de separación de bienes y su traducción para
            compraventa de inmuebles en España.
          </li>
          <li>
            <strong>Testamentos</strong>, últimas voluntades y documentos
            relacionados.
          </li>
          <li>
            <strong>Declaraciones de herederos</strong>, particiones de herencia
            y escrituras de adjudicación.
          </li>
          <li>
            <strong>Poderes notariales</strong> generales y especiales para
            representar a personas en España (compraventas, trámites bancarios,
            herencias, juicios, etc.).
          </li>
          <li>
            <strong>Actas notariales</strong>, declaraciones juradas y otros
            documentos otorgados ante notario.
          </li>
          <li>
            <strong>Sentencias y autos judiciales</strong> en materia civil,
            mercantil, laboral o penal, cuando es necesario acreditarlos en
            otro país.
          </li>
        </ul>
        <p>
          Todas estas traducciones se realizan en <strong>formato jurado</strong>, incluyendo
          firma, sello y declaración de veracidad del traductor jurado.
        </p>
      </section>

      {/* COMPRAVENTA DE INMUEBLES Y NOTARÍAS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos jurídicos en compraventa de inmuebles en España
        </h2>
        <p>
          Es muy frecuente que notarías y registros de la propiedad en España
          exijan traducción jurada de:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Capitulaciones matrimoniales</strong>, para acreditar el
            régimen económico del matrimonio cuando intervienen cónyuges con
            documentos extranjeros.
          </li>
          <li>
            <strong>Sentencias de divorcio</strong>, cuando uno de los
            intervinientes está divorciado y el estado civil debe quedar claro
            en la escritura.
          </li>
          <li>
            <strong>Poderes notariales</strong> otorgados en el extranjero para
            que un representante firme en España.
          </li>
          <li>
            <strong>Documentos de herencia</strong>, cuando la compraventa
            proviene de una adjudicación hereditaria.
          </li>
        </ul>
        <p>
          En muchos casos, además de la traducción jurada, estos documentos
          deben estar <strong>legalizados o apostillados</strong>. Lo más prudente es que la
          notaría o el asesor que lleva la operación confirme qué exige el
          Registro de la Propiedad correspondiente.
        </p>
      </section>

      {/* HERENCIAS Y SUCESIONES */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Herencias y sucesiones con documentos extranjeros
        </h2>
        <p>
          En herencias internacionales, se combinan documentos de distintos
          países: certificados de defunción, testamentos, declaraciones de
          herederos, certificados de últimas voluntades, escrituras de
          adjudicación, etc. Es muy habitual que:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Haya que <strong>acreditar la filiación</strong> y el parentesco de
            los herederos mediante certificados de nacimiento y matrimonio.
          </li>
          <li>
            Se exija la <strong>traducción jurada</strong> de testamentos y
            decisiones judiciales extranjeras.
          </li>
          <li>
            La notaría española pida traducciones de{" "}
            <strong>actas y poderes</strong> otorgados fuera de España.
          </li>
        </ul>
        <p>
          En estos casos, una buena coordinación entre notaría, asesoría y
          traductor jurado ayuda a evitar retrasos y aclarar qué documentos es
          realmente necesario traducir.
        </p>
      </section>

      {/* ENFOQUE MARRUECOS / FRANCÓFONOS */}
      <section className="mt-10 space-y-4 rounded-2xl border border-cream bg-parchment p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos jurídicos de Marruecos y países francófonos
        </h2>
        <p>
          Trabajamos con frecuencia con <strong>actas notariales</strong>,{" "}
          <strong>poderes</strong>, <strong>decisiones judiciales</strong> y
          documentos de estado civil procedentes de Marruecos y otros países
          francófonos que deben surtir efecto en España.
        </p>
        <p>Algunos ejemplos habituales:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Poderes notariales otorgados en Marruecos para comprar o vender
            inmuebles en España.
          </li>
          <li>
            Decisiones de divorcio y documentos relativos a la guarda de hijos
            menores.
          </li>
          <li>
            Documentos relativos a <strong>herencias</strong> con bienes o
            herederos en España.
          </li>
          <li>
            Actas y certificaciones emitidas por autoridades judiciales o
            notariales marroquíes.
          </li>
        </ul>
        <p className="text-sm text-sepia">
          Si trabajas con documentación marroquí de forma habitual, puedes ver un resumen más amplio en{" "}
          <Link
            href="/marruecos"
            className="font-semibold text-bleu hover:underline"
          >
            documentos marroquíes para España
          </Link>
          .
        </p>
        <p className="text-xs text-sepia">
          Es frecuente que estos documentos deban llevar Apostilla de La Haya o
          legalización antes de la traducción jurada. Conviene confirmarlo con
          la notaría, el juzgado o el consulado correspondiente.
        </p>
      </section>

      {/* RELACIÓN CON OTRAS PÁGINAS */}
      <section className="mt-10 space-y-3 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Relación con otros documentos oficiales
        </h2>
        <p>
          Los documentos jurídicos no suelen ir solos: a menudo van acompañados
          de otros documentos que también requieren traducción jurada:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <Link
              href="/documentos-oficiales/certificados-registro-civil"
              className="font-semibold text-bleu hover:underline"
            >
              Certificados del Registro Civil
            </Link>{" "}
            (nacimiento, matrimonio, defunción, etc.).
          </li>
          <li>
            <Link
              href="/documentos-oficiales/certificado-de-nacimiento"
              className="font-semibold text-bleu hover:underline"
            >
              Certificados de nacimiento
            </Link>{" "}
            para acreditar filiación y parentesco.
          </li>
          <li>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="font-semibold text-bleu hover:underline"
            >
              Certificados de antecedentes penales
            </Link>{" "}
            en procedimientos de familia, extranjería o tutela.
          </li>
          <li>
            <Link
              href="/documentos-oficiales/documentos-mercantiles"
              className="font-semibold text-bleu hover:underline"
            >
              Documentos mercantiles y empresariales
            </Link>{" "}
            cuando la herencia o el caso afecta a participaciones sociales o
            empresas.
          </li>
        </ul>
      </section>

      {/* CÓMO ENVIAR DOCUMENTOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviarnos tus documentos jurídicos para traducir?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Envíanos escaneos en PDF o fotos claras donde se lean bien todos los
            datos, sellos y firmas.
          </li>
          <li>
            Indica el tipo de trámite (compraventa de inmueble, herencia,
            divorcio, procedimiento judicial, etc.).
          </li>
          <li>
            Si la notaría, el juzgado o el registro te han dado instrucciones
            concretas, puedes adjuntarlas o resumirlas.
          </li>
        </ul>
        <p>
          Aquí puedes ver en detalle{" "}
          <Link
            href="/proceso"
            className="font-semibold text-bleu hover:underline"
          >
            cómo funciona nuestro proceso de trabajo
          </Link>{" "}
          con traducciones juradas, plazos y entrega en PDF firmado digitalmente.
        </p>
        <p>
          Podemos ayudarte a priorizar qué documentos deben traducirse de forma
          inmediata y cuáles pueden esperar, para optimizar tiempos y costes.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir una sentencia, unas capitulaciones o un poder?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tus documentos jurídicos en PDF o como fotos legibles y te
          responderemos con un presupuesto cerrado y un plazo aproximado de
          entrega. Trabajamos a diario con notarías, despachos de abogados y
          particulares que necesitan traducir documentación legal para España.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Documentos%20jur%C3%ADdicos%20-%20Presupuesto"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar documentos por email
          </a>
        </div>
      </section>

      <RelatedDocuments currentSlug="documentos-juridicos" />
    </main>
  );
}
