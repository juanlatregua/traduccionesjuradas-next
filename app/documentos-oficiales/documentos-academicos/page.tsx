import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaProduct } from "@/components/SchemaProduct";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RelatedDocuments } from "@/components/RelatedDocuments";
import { SchemaService } from "@/components/SchemaService";

export const metadata: Metadata = {
  title: "Títulos y DELF/DALF en francés | Traducción jurada académica",
  description:
    "Traducción jurada de títulos, expedientes y certificados académicos para homologación y oposiciones. Soporte para DELF/DALF en francés y otros idiomas oficiales.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-academicos" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traducci%C3%B3n+jurada+de+documentos+acad%C3%A9micos&subtitle=T%C3%ADtulos%2C+expedientes+y+certificados+para+homologaci%C3%B3n",
        width: 1200,
        height: 630,
        alt: "Traducción jurada de documentos académicos — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function DocumentosAcademicosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-academicos"
        serviceName="Traducción jurada de documentos académicos"
        serviceDescription="Traducción jurada oficial de títulos universitarios, expedientes académicos, diplomas y certificados de estudios extranjeros para homologación y trámites académicos en España."
        serviceUrl="https://www.traduccionesjuradas.net/documentos-oficiales/documentos-academicos"
      />
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
          { name: "Documentos académicos", url: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-academicos" },
        ]}
      />
      <SchemaProduct
        name="Traducción jurada de documentos académicos"
        description="Traducción jurada oficial de títulos universitarios, expedientes académicos, certificados DELF/DALF y diplomas para homologación en España."
        sku="tj-documentos-academicos"
        offers={[
          { price: "25", priceCurrency: "EUR", url: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-academicos" },
          { price: "35", priceCurrency: "EUR", url: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-academicos" },
        ]}
      />
      <SchemaFAQ
        items={[
          {
            question: "¿Cuánto cuesta traducir un título o expediente académico?",
            answer: "Orientativamente 25-35 € por página; confirmamos el importe exacto al revisar el PDF/imagen.",
          },
          {
            question: "¿Se traduce también la Apostilla de La Haya?",
            answer: "Sí, la apostilla o legalización se traduce junto con el título o certificado.",
          },
          {
            question: "¿Sirve el PDF firmado o necesito copia en papel?",
            answer: "El PDF firmado digitalmente suele ser aceptado; si te piden papel, podemos enviarlo por mensajería.",
          },
          {
            question: "¿Cómo envío el documento?",
            answer: "Adjunta un PDF o foto clara desde el presupuesto instantáneo o envíalo a hola@traduccionesjuradas.net. Revisamos sellos y datos antes de confirmar precio y plazo.",
          },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
        { name: "Documentos académicos", href: "/documentos-oficiales/documentos-academicos" },
      ]} />

      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Documentos académicos
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de títulos y documentos académicos
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
        Realizamos traducciones juradas de títulos universitarios, certificados de notas,
        diplomas, planes de estudios y certificaciones oficiales de idiomas como
        <a href="/traductor-jurado-frances" className="text-bleu hover:underline"> DELF/DALF</a>, 
        <a href="/traductor-jurado-ingles" className="text-bleu hover:underline"> TOEFL, IELTS, Cambridge</a>, 
        <a href="/traductor-jurado-aleman" className="text-bleu hover:underline"> Goethe</a> 
        y otras, para oposiciones, universidades, homologaciones y trámites administrativos en España y en el extranjero.
        </p>   
        <p className="mt-2 text-xs text-sepia">
          Si vas a homologar tu título extranjero, empieza por la guía de{" "}
          <a href="/blog/homologacion-titulo-universitario" className="font-semibold text-bleu hover:underline">
            traducción jurada del título universitario para la homologación
          </a>
          . Si tu documentación académica está en francés, puedes ampliar
          información en la guía de{" "}
          <a href="/traductor-jurado-frances" className="font-semibold text-bleu hover:underline">
            traducción jurada en francés
          </a>
          .
        </p>
      </header>

      {/* CONTENIDO */}
      <section className="mt-8 space-y-10 text-sm text-sepia">
        <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
                Precio cerrado
              </p>
              <p className="text-sm font-semibold text-encre">
                25–35 € por página · plazo según páginas e idioma
              </p>
              <p className="text-xs text-graphite">
                Confirmamos importe y plazo al revisar el PDF/imagen.
              </p>
            </div>
            <a
              href="/presupuesto-instantaneo"
              className="rounded-2xl bg-bleu px-4 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
            >
              Subir documento y pedir precio
            </a>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { title: "DELF / DALF (fr → es)", price: "45 €", plazo: "1 día" },
              {
                title: "Título universitario esp → fr (apostillado)",
                price: "50 €",
                plazo: "1 día",
              },
              {
                title: "Título universitario esp → fr (legalizado)",
                price: "55 €",
                plazo: "1 día",
              },
              { title: "Título esp → ing", price: "55 €", plazo: "2 días" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-cream bg-parchment px-3 py-3 text-xs text-sepia"
              >
                <p className="font-semibold text-encre">{item.title}</p>
                <p className="text-sm font-semibold text-bleu">
                  {item.price}
                </p>
                <p className="text-[11px] text-graphite">
                  Plazo estimado: {item.plazo}
                </p>
              </div>
            ))}
          </div>
        </div>


        {/* Universitarios */}
        <div>
          <h2 className="text-lg font-semibold text-encre">
            Títulos universitarios y documentos académicos
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Títulos universitarios de grado, máster y doctorado.</li>
            <li>Certificados de notas y expedientes académicos completos.</li>
            <li>Diplomas de posgrado, formación continua y cursos oficiales.</li>
            <li>Programas de estudios, syllabus y descripciones de asignaturas.</li>
            <li>Certificados de prácticas, asistencia o matrícula.</li>
          </ul>
          <p className="mt-2">
            Muy demandado para: acceso a máster, homologación de estudios, oposiciones,
            movilidad internacional y procesos de selección.
          </p>
        </div>

        {/* IDIOMAS – muy importante para opositores */}
        <div>
          <h2 className="text-lg font-semibold text-encre">
            Certificaciones oficiales de idiomas (muy frecuentes para oposiciones)
          </h2>

          <p className="mt-2">Traducimos de forma jurada titulaciones emitidas por:</p>

          <ul className="mt-2 list-disc pl-5 space-y-1">

            {/* FRANCÉS */}
            <li className="font-semibold text-encre">Francés:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>DELF (A1–B2) — Alliance Française</li>
              <li>DALF (C1–C2)</li>
              <li>TCF / TCF Québec</li>
              <li>TEF / TEFAQ</li>
            </ul>

            {/* INGLÉS */}
            <li className="font-semibold text-encre">Inglés:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>Cambridge English (A2 Key, B1 Preliminary, B2 First, C1 Advanced, C2 Proficiency)</li>
              <li>IELTS (Academic / General)</li>
              <li>TOEFL iBT</li>
              <li>Trinity College London</li>
              <li>TOEIC</li>
            </ul>

            {/* ALEMÁN */}
            <li className="font-semibold text-encre">Alemán:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>Goethe-Zertifikat (A1–C2)</li>
              <li>TestDaF</li>
              <li>DSH</li>
            </ul>

            {/* OTROS */}
            <li className="font-semibold text-encre">Otras certificaciones:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>CILS / CELI (italiano)</li>
              <li>DELE (español)</li>
              <li>NOKEN (japonés)</li>
            </ul>
          </ul>

          <p className="mt-2">
            Estas traducciones son especialmente solicitadas por opositores que deben acreditar
            un nivel oficial de idiomas ante el Ministerio, universidades o tribunales de oposición.
          </p>
        </div>

        {/* Oposiciones */}
        <div>
          <h2 className="text-lg font-semibold text-encre">
            Traducciones juradas para oposiciones en España
          </h2>
          <p className="mt-2">
            Muchos tribunales de oposición exigen traducción jurada cuando la titulación
            fue emitida por una institución extranjera. Algunos casos frecuentes:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Certificados oficiales de idiomas obtenidos en el extranjero.</li>
            <li>Títulos universitarios no españoles.</li>
            <li>Cursos de especialización impartidos por universidades internacionales.</li>
            <li>Documentación complementaria para baremo de méritos.</li>
          </ul>
          <p className="mt-1">
            Es recomendable verificar siempre los requisitos del tribunal convocante.
          </p>
          <p className="mt-1">
            Es recomendable verificar siempre los requisitos del tribunal convocante y, en caso de duda,
            consultar nuestros{" "}
            <a href="/precios-traduccion-jurada" className="text-bleu hover:underline">
                precios de traducción jurada
            </a>
            .
            </p>

        </div>
      </section>

      {/* INFORMACIÓN PRÁCTICA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Información práctica sobre documentos académicos
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Vigencia</p>
            <p className="mt-1">Los títulos universitarios <strong>no caducan</strong>. Sin embargo, certificaciones como <strong>TCF y TEF caducan a los 2 años</strong>; el DELF/DALF son válidos de por vida.</p>
          </div>
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Apostilla</p>
            <p className="mt-1">Para homologar un título extranjero ante el <strong>Ministerio de Universidades</strong>, suele exigirse la Apostilla de La Haya sobre el título original antes de la traducción jurada.</p>
          </div>
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Homologación</p>
            <p className="mt-1">La traducción jurada es un requisito previo a la <strong>homologación</strong> o <strong>equivalencia</strong> de títulos. El Ministerio exige traducción jurada + apostilla + título original.</p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mt-10 rounded-2xl border border-cream bg-cream/70 p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir un título o certificado de idiomas?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tu título universitario, certificado DELF/DALF, TOEFL, IELTS,
          Cambridge, Goethe u otro documento y te informaremos del precio y
          el plazo de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Pedir presupuesto
          </a>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Presupuesto%20documentos%20acad%C3%A9micos"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar por email
          </a>
        </div>
      </section>

      <RelatedDocuments currentSlug="documentos-academicos" />
    </main>
  );
}
