import type { Metadata } from "next";
import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RelatedDocuments } from "@/components/RelatedDocuments";
import { SchemaService } from "@/components/SchemaService";
import { SchemaProduct } from "@/components/SchemaProduct";

export const metadata: Metadata = {
  title: "Apostilla de La Haya y traducción jurada | Qué es y cuándo se exige",
  description:
    "Qué es la Apostilla de La Haya, qué documentos suelen requerirla y cómo se relaciona con la traducción jurada. Información práctica para certificados de nacimiento, matrimonio, antecedentes penales, documentos mercantiles y casos frecuentes de Marruecos, Francia y países francófonos.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/apostilla-haya" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Apostilla+de+La+Haya&subtitle=Qu%C3%A9+es+y+cu%C3%A1ndo+se+exige+en+traducci%C3%B3n+jurada",
        width: 1200,
        height: 630,
        alt: "Apostilla de La Haya y traducción jurada — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function ApostillaHayaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaProduct
        name="Traducción jurada de documentos con Apostilla de La Haya"
        description="Traducción jurada oficial de documentos apostillados para su uso en España. Incluye traducción del texto de la apostilla."
        sku="apostilla-haya"
        offers={[
          { price: "55.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
          { price: "80.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
        ]}
      />
      <SchemaFAQ
        id="faq-apostilla"
        items={[
          { question: "¿Qué es la Apostilla de La Haya?", answer: "Es un certificado que confirma la autenticidad de firmas y cargos públicos de un documento para que sea válido en otro país firmante del Convenio de La Haya, sin necesidad de legalización consular." },
          { question: "¿Se traduce también la apostilla junto con el documento?", answer: "Sí. La traducción jurada debe incluir el texto de la apostilla porque forma parte del documento que se va a presentar." },
          { question: "¿Primero se apostilla y luego se traduce?", answer: "Sí, el orden habitual es: obtener el documento, solicitar la Apostilla de La Haya y después enviar el documento completo (con apostilla) al traductor jurado." },
        ]}
      />
      <SchemaService
        id="service-apostilla"
        serviceName="Traducción jurada de documentos con Apostilla de La Haya"
        serviceDescription="Traducción jurada oficial de documentos apostillados: certificados de nacimiento, matrimonio, antecedentes penales y documentos mercantiles con Apostilla de La Haya para su uso en España."
        serviceUrl="https://www.traduccionesjuradas.net/documentos-oficiales/apostilla-haya"
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-apostilla"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
          { name: "Apostilla de La Haya", url: "https://www.traduccionesjuradas.net/documentos-oficiales/apostilla-haya" },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
        { name: "Apostilla de La Haya", href: "/documentos-oficiales/apostilla-haya" },
      ]} />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Apostilla de La Haya
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Apostilla de La Haya y traducción jurada: cómo encajan
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          La Apostilla de La Haya es un sello o anotación que confirma la
          autenticidad de firmas y cargos públicos de un documento para que sea
          válido en otro país que también forme parte del Convenio de La Haya.
          Te explicamos de forma práctica qué es, cuándo se exige y cómo se
          combina con la traducción jurada.
        </p>
      </header>

      {/* QUE ES */}
      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Qué es exactamente la Apostilla de La Haya?
        </h2>
        <p>
          Es un certificado que se añade a un documento público (en forma de
          sello, hoja adicional o anotación) para confirmar que:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>La firma del documento es auténtica.</li>
          <li>La persona que firma tiene el cargo que dice tener.</li>
          <li>
            El sello o timbre que aparece en el documento es el oficial de esa
            autoridad.
          </li>
        </ul>
        <p>
          La apostilla no cambia el contenido del documento, pero hace que su
          uso en otro país que también ha firmado el Convenio de La Haya sea
          mucho más simple, porque evita cadenas largas de legalizaciones
          consulares.
        </p>
      </section>

      {/* DOCUMENTOS QUE SUELEN REQUERIR APOSTILLA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos que con frecuencia deben llevar Apostilla
        </h2>
        <p>
          La decisión final la tiene siempre la administración que recibe el
          documento (consulado, Extranjería, universidad, juzgado, notaría…),
          pero en la práctica, los documentos que más vemos con apostilla son:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Certificados del Registro Civil</strong>: nacimiento,
            matrimonio, defunción, fe de vida y estado, etc.
          </li>
          <li>
            <strong>Certificados de antecedentes penales</strong> o{" "}
            <em>Casier Judiciaire</em>.
          </li>
          <li>
            <strong>Certificados de estado civil</strong> (soltería, divorcio,
            viudedad).
          </li>
          <li>
            <strong>Escrituras y documentos notariales</strong>: poderes,
            capitulaciones matrimoniales, actas, testamentos, etc.
          </li>
          <li>
            <strong>Certificados mercantiles</strong>: Registro Mercantil,{" "}
            <em>Registre du Commerce</em>, certificados de vigencia.
          </li>
          <li>
            Algunos <strong>certificados de estudios</strong> o documentos
            académicos, según el país y el trámite.
          </li>
        </ul>
        <p>
          En la mayoría de los casos, la apostilla se coloca sobre el documento
          original o sobre una copia certificada antes de hacer la traducción
          jurada.
        </p>
      </section>

      {/* APOSTILLA + TRADUCCION JURADA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Primero apostilla o primero traducción?
        </h2>
        <p>
          Si tu documento debe llevar Apostilla de La Haya, el orden lógico
          suele ser:
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Obtienes el documento original actualizado.</li>
          <li>Solicitas la Apostilla de La Haya en el organismo competente.</li>
          <li>
            Nos envías una copia clara del documento completo, apostilla
            incluida, para hacer la <strong>traducción jurada</strong>.
          </li>
        </ol>
        <p>
          La traducción jurada debe incluir también la parte de la apostilla,
          porque forma parte del documento que se va a presentar. De lo
          contrario, puede considerarse incompleta.
        </p>
      </section>

      {/* CTA INTERMEDIO */}
      <section className="mt-8 rounded-xl border border-bleu/20 bg-bleu/5 p-5 text-sm">
        <p className="font-semibold text-encre">¿Tienes documentos con apostilla para traducir?</p>
        <p className="mt-1 text-sepia">Sube tu documento y recibe precio cerrado al instante.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/presupuesto-instantaneo" className="rounded-xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu/90">
            Pedir presupuesto
          </Link>
          <a href="mailto:hola@traduccionesjuradas.net?subject=Apostilla%20de%20La%20Haya%20-%20Presupuesto" className="text-xs font-medium text-bleu hover:underline">
            Enviar por email
          </a>
        </div>
      </section>

      {/* PAISES FRANCÓFONOS / MARRUECOS */}
      <section className="mt-10 space-y-4 rounded-2xl border border-cream bg-parchment p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Apostilla en documentos de Marruecos, Francia y países francófonos
        </h2>
        <p>
          En nuestra experiencia diaria, vemos muchos documentos con apostilla
          procedentes de:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Marruecos</strong>:{" "}
            <em>Extraits d&apos;Acte de Naissance</em>, certificados de
            matrimonio, <em>Casier Judiciaire</em>, certificados del{" "}
            <em>Registre du Commerce</em>, etc.
          </li>
          <li>
            <strong>Francia</strong>: certificados del{" "}
            <em>État Civil</em>, extractos de nacimiento y matrimonio,{" "}
            <em>Casier Judiciaire</em>, títulos académicos, etc.
          </li>
        </ul>
        <p>
          En otros países francófonos de África (por ejemplo, Senegal o Costa de
          Marfil), puede que:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>La Apostilla de La Haya no se aplique, o</li>
          <li>Haya que utilizar sistemas de legalización distintos.</li>
        </ul>
        <p className="text-xs text-sepia">
          Lo más seguro siempre es confirmar los requisitos en el consulado
          español, en la oficina de Extranjería o en la notaría que va a usar el
          documento.
        </p>
      </section>

      {/* INFORMACIÓN PRÁCTICA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Información práctica: cómo obtener la apostilla en España
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Dónde solicitarla</p>
            <p className="mt-1">Documentos judiciales y del Registro Civil: <strong>Tribunal Superior de Justicia</strong> (TSJ) de tu comunidad. Documentos notariales: <strong>Colegio Notarial</strong>. También puedes solicitar algunas apostillas en el portal del <strong>Ministerio de Justicia</strong>.</p>
          </div>
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Plazo y coste</p>
            <p className="mt-1">En España, la apostilla suele tardar entre <strong>1 y 5 días hábiles</strong> según el organismo. El coste es variable; en muchos casos es gratuita o tiene una tasa reducida.</p>
          </div>
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Trámite online</p>
            <p className="mt-1">El Ministerio de Justicia permite solicitar la apostilla electrónica para algunos documentos a través de su sede electrónica. El resultado es un código QR verificable.</p>
          </div>
        </div>
      </section>

      {/* CUANDO NO HAY APOSTILLA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Y si mi país no aplica la Apostilla de La Haya?
        </h2>
        <p>
          Si tu país no es parte del Convenio de La Haya, el documento no
          podrá llevar apostilla, pero eso no significa que no se pueda usar en
          España. En esos casos, suelen existir otros sistemas:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Legalización en el Ministerio de Asuntos Exteriores del país.</li>
          <li>Legalización en el Consulado de España en ese país.</li>
          <li>Legalización en el consulado del país emisor en España.</li>
        </ul>
        <p>
          Una vez completadas las legalizaciones, se puede hacer la{" "}
          <strong>traducción jurada</strong> al español para el trámite que
          corresponda.
        </p>
      </section>

      {/* ENLACES A OTROS CONTENIDOS */}
      <section className="mt-10 space-y-3 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Documentos en los que la apostilla es especialmente importante
        </h2>
        <p>
          Si tienes dudas sobre un documento concreto, puedes consultar también
          estas páginas específicas:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <Link
              href="/documentos-oficiales/certificado-de-nacimiento"
              className="font-semibold text-bleu hover:underline"
            >
              Certificado de nacimiento
            </Link>{" "}
            (muy habitual con apostilla en Marruecos y Francia).
          </li>
          <li>
            <Link
              href="/documentos-oficiales/antecedentes-penales"
              className="font-semibold text-bleu hover:underline"
            >
              Certificados de antecedentes penales
            </Link>
            .
          </li>
          <li>
            <Link
              href="/documentos-oficiales/documentos-mercantiles"
              className="font-semibold text-bleu hover:underline"
            >
              Documentos mercantiles y empresariales
            </Link>{" "}
            (Registre du Commerce, certificados de vigencia, etc.).
          </li>
          <li>
            <Link
              href="/teletrabajo"
              className="font-semibold text-bleu hover:underline"
            >
              Documentos para teletrabajar en España
            </Link>{" "}
            (donde la apostilla de penales y certificados civiles es muy
            frecuente).
          </li>
        </ul>
      </section>

      {/* COMO ENVIAR */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviarnos tus documentos con apostilla para traducir?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Escanea o fotografía el documento completo, incluyendo la página de
            la apostilla.
          </li>
          <li>
            Comprueba que se lean bien los sellos, firmas y textos (también en
            la apostilla).
          </li>
          <li>
            Indícanos para qué trámite lo necesitas (nacionalidad, teletrabajo,
            notaría, universidad, etc.).
          </li>
        </ul>
        <p>
          Prepararemos un presupuesto y un plazo de entrega, y te explicaremos
          si es necesario traducir uno o varios documentos relacionados.
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Tienes documentos con Apostilla de La Haya para usar en España?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tus certificados con apostilla (nacimiento, matrimonio,
          antecedentes penales, documentos mercantiles, etc.) en PDF o foto
          clara y te responderemos con un presupuesto cerrado y un plazo
          estimado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Apostilla%20de%20La%20Haya%20-%20Presupuesto"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar directamente los documentos por email
          </a>
        </div>
      </section>

      <RelatedDocuments currentSlug="apostilla-haya" />
    </main>
  );
}
