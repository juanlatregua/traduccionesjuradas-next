import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title: "Traducción jurada de títulos y documentos académicos | Universidades y oposiciones",
  description:
    "Traducción jurada de títulos universitarios, certificados de notas, diplomas, DELF/DALF, TOEFL, IELTS, Goethe, certificaciones oficiales de idiomas y documentos académicos para oposiciones, universidades y trámites en España.",
};

export default function DocumentosAcademicosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://traduccionesjuradas.net/documentos-oficiales" },
          { name: "Documentos académicos", url: "https://traduccionesjuradas.net/documentos-oficiales/documentos-academicos" },
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
            answer: "Adjunta un PDF o foto clara desde el formulario de presupuesto o envíalo a hola@traduccionesjuradas.net. Revisamos sellos y datos antes de confirmar precio y plazo.",
          },
        ]}
      />

      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Documentos académicos
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traducción jurada de títulos y documentos académicos
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Realizamos traducciones juradas de títulos universitarios, certificados de notas,
        diplomas, planes de estudios y certificaciones oficiales de idiomas como
        <a href="/traductor-jurado-frances" className="text-emerald-700 hover:underline"> DELF/DALF</a>, 
        <a href="/traductor-jurado-ingles" className="text-emerald-700 hover:underline"> TOEFL, IELTS, Cambridge</a>, 
        <a href="/traductor-jurado-aleman" className="text-emerald-700 hover:underline"> Goethe</a> 
        y otras, para oposiciones, universidades, homologaciones y trámites administrativos en España y en el extranjero.
        </p>   
      </header>

      {/* CONTENIDO */}
      <section className="mt-8 space-y-10 text-sm text-slate-700">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Precio orientativo
              </p>
              <p className="text-sm font-semibold text-slate-900">
                25–35 € por página · plazo según páginas e idioma
              </p>
              <p className="text-xs text-slate-500">
                Confirmamos importe y plazo al revisar el PDF/imagen.
              </p>
            </div>
            <a
              href="/presupuesto"
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
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
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700"
              >
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {item.price}
                </p>
                <p className="text-[11px] text-slate-500">
                  Plazo estimado: {item.plazo}
                </p>
              </div>
            ))}
          </div>
        </div>


        {/* Universitarios */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
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
          <h2 className="text-lg font-semibold text-slate-900">
            Certificaciones oficiales de idiomas (muy frecuentes para oposiciones)
          </h2>

          <p className="mt-2">Traducimos de forma jurada titulaciones emitidas por:</p>

          <ul className="mt-2 list-disc pl-5 space-y-1">

            {/* FRANCÉS */}
            <li className="font-semibold text-slate-900">Francés:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>DELF (A1–B2) — Alliance Française</li>
              <li>DALF (C1–C2)</li>
              <li>TCF / TCF Québec</li>
              <li>TEF / TEFAQ</li>
            </ul>

            {/* INGLÉS */}
            <li className="font-semibold text-slate-900">Inglés:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>Cambridge English (A2 Key, B1 Preliminary, B2 First, C1 Advanced, C2 Proficiency)</li>
              <li>IELTS (Academic / General)</li>
              <li>TOEFL iBT</li>
              <li>Trinity College London</li>
              <li>TOEIC</li>
            </ul>

            {/* ALEMÁN */}
            <li className="font-semibold text-slate-900">Alemán:</li>
            <ul className="ml-6 list-disc space-y-1">
              <li>Goethe-Zertifikat (A1–C2)</li>
              <li>TestDaF</li>
              <li>DSH</li>
            </ul>

            {/* OTROS */}
            <li className="font-semibold text-slate-900">Otras certificaciones:</li>
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
          <h2 className="text-lg font-semibold text-slate-900">
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
            <a href="/precios-traduccion-jurada" className="text-emerald-700 hover:underline">
                precios orientativos de traducción jurada
            </a>
            .
            </p>

        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mt-10 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6 text-sm">
        <h2 className="text-lg font-semibold text-emerald-900">
          ¿Necesitas traducir un título o certificado de idiomas?
        </h2>
        <p className="mt-1 text-slate-800">
          Envíanos tu título universitario, certificado DELF/DALF, TOEFL, IELTS,
          Cambridge, Goethe u otro documento y te informaremos del precio y
          el plazo de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Pedir presupuesto
          </a>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Presupuesto%20documentos%20acad%C3%A9micos"
            className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            Enviar por email
          </a>
        </div>
      </section>
    </main>
  );
}
