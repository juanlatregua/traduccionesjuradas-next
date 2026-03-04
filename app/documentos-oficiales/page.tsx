import Link from "next/link";
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title:
    "Documentos oficiales que requieren traducción jurada | Tipos y requisitos",
  description:
    "Listado actualizado de documentos oficiales que suelen requerir traducción jurada: certificados del Registro Civil, certificados de nacimiento, antecedentes penales, documentos académicos, laborales, jurídicos, mercantiles y documentación para teletrabajar en España.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Documentos+oficiales&subtitle=Tipos+de+documentos+que+requieren+traducci%C3%B3n+jurada",
        width: 1200,
        height: 630,
        alt: "Documentos oficiales — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function DocumentosOficialesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <SchemaBreadcrumbs
        id="breadcrumbs-documentos"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
      ]} />
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Documentos oficiales
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre">
          Documentos oficiales que requieren traducción jurada para usarlos en España
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Gestionamos la <strong>traducción jurada de documentos oficiales extranjeros</strong> 
          más habituales para trámites de extranjería, estudios, trabajo, oposiciones, procesos
          judiciales, empresas, movilidad internacional y teletrabajo en España. Cada traducción 
          es realizada y firmada por un <strong>traductor jurado oficial</strong> y se puede entregar
          en PDF firmado digitalmente o en papel.
        </p>
        <p className="mt-2 text-xs text-sepia">
          Si no tienes claro qué te van a pedir o cómo es el flujo completo, puedes ver{" "}
          <Link
            href="/proceso"
            className="font-semibold text-bleu hover:underline"
          >
            cómo funciona nuestro proceso
          </Link>{" "}
          o revisar las{" "}
          <Link
            href="/preguntas-frecuentes"
            className="font-semibold text-bleu hover:underline"
          >
            preguntas frecuentes
          </Link>
          .
        </p>
      </header>

      {/* GRID DE CATEGORÍAS */}
      <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Certificados del Registro Civil",
            desc: "Conjunto de documentos como matrimonio, divorcio, defunción, fe de vida y estado, cambios de nombre… que suelen necesitar traducción jurada para trámites en España.",
            href: "/documentos-oficiales/certificados-registro-civil",
          },
          {
            title: "Certificado de nacimiento",
            desc: "Página específica sobre la traducción jurada del certificado de nacimiento: usos frecuentes, países y cuándo se exige apostilla.",
            href: "/documentos-oficiales/certificado-de-nacimiento",
          },
          {
            title: "Antecedentes penales",
            desc: "Certificado de antecedentes penales y equivalentes extranjeros (casier judiciaire, police clearance…) para extranjería, visados, nacionalidad, empleo y teletrabajo.",
            href: "/documentos-oficiales/antecedentes-penales",
          },
          {
            title: "Documentos académicos",
            desc: "Títulos, expedientes, certificados de notas, diplomas, syllabus y títulos oficiales de idiomas (DELF/DALF, IELTS, TOEFL, Cambridge, Goethe…) para universidades y oposiciones.",
            href: "/documentos-oficiales/documentos-academicos",
          },
          {
            title: "Documentos laborales",
            desc: "Contratos, nóminas, certificados de empresa, vida laboral extranjera y documentación laboral para trabajar o teletrabajar en España.",
            href: "/documentos-oficiales/documentos-laborales",
          },
          {
            title: "Documentos jurídicos",
            desc: "Sentencias de divorcio, capitulaciones matrimoniales, herencias, testamentos, poderes notariales y otras resoluciones judiciales que deben surtir efecto en España.",
            href: "/documentos-oficiales/documentos-juridicos",
          },
          {
            title: "Documentos mercantiles y empresariales",
            desc: "Escrituras, estatutos sociales, poderes mercantiles, certificados del Registro Mercantil o Registre du Commerce y cuentas anuales para empresas.",
            href: "/documentos-oficiales/documentos-mercantiles",
          },
          {
            title: "Documentos para teletrabajar en España",
            desc: "Conjunto de documentos que Extranjería suele pedir para teletrabajo: salarios, volumen de negocio, Registro Mercantil, antecedentes penales y documentos familiares.",
            href: "/teletrabajo",
          },
          {
            title: "Apostilla de La Haya",
            desc: "Qué es la Apostilla de La Haya, qué documentos suelen requerirla y por qué es importante traducir también la página de la apostilla junto con el documento.",
            href: "/documentos-oficiales/apostilla-haya",
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-cream bg-card p-4 shadow-sm transition hover:border-bleu hover:shadow-md"
          >
            <h3 className="text-sm font-semibold text-encre">
              {item.title}
            </h3>
            <p className="mt-2 text-xs text-sepia">{item.desc}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-bleu">
              Ver más →
            </span>
          </Link>
        ))}
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl bg-cream p-6 border border-cream">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir alguno de estos documentos?
        </h2>
        <p className="mt-2 text-sm text-sepia">
          Envíanos tu documento en PDF o foto y te indicamos{" "}
          <strong>precio cerrado, plazo aproximado y forma de entrega</strong>. Todas nuestras
          traducciones juradas incluyen firma y sello oficial y se pueden entregar en{" "}
          <strong>PDF firmado digitalmente</strong> o, si lo necesitas, en papel.
        </p>
        <Link
          href="/presupuesto-instantaneo"
          className="mt-4 inline-block rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
        >
          Solicitar presupuesto
        </Link>
      </section>
    </main>
  );
}



