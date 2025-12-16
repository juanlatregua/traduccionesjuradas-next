// app/preguntas-frecuentes/page.tsx
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre traducción jurada",
  description:
    "Resolvemos las dudas más frecuentes sobre la traducción jurada: plazos, formato de los documentos, apostilla de La Haya, validez legal, envío en PDF firmado, urgencias y precios.",
};

const whatsappNumber = "34951333614";
const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
  "Hola, quiero hacer una consulta sobre traducción jurada."
)}`;
const mailLink = "mailto:hola@traduccionesjuradas.net";

export default function PreguntasFrecuentesPage() {
  return (
    <>
      {/* SCHEMA FAQ */}
      <Script
        id="schema-faq-preguntas-frecuentes"
        type="application/ld+json"
        strategy="afterInteractive"
      >
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "¿Qué es una traducción jurada?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Una traducción jurada es una traducción realizada y firmada por un traductor jurado acreditado, que añade su sello y una declaración de veracidad. Tiene validez oficial ante administraciones, juzgados, notarías, universidades y otros organismos.",
              },
            },
            {
              "@type": "Question",
              name:
                "¿Puedo enviar una foto del documento o tiene que ser un escaneo?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Para preparar el presupuesto basta con una foto clara o un escaneo donde se lea todo el contenido. Para la traducción jurada definitiva también podemos trabajar a partir de una imagen nítida, siempre que no falte información en los márgenes.",
              },
            },
            {
              "@type": "Question",
              name: "¿Cuánto tarda una traducción jurada?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "El plazo habitual para una traducción jurada sencilla es de 24 a 72 horas laborables. En el caso de documentos extensos o varios idiomas, el plazo se ajusta al volumen. Si tienes una cita o plazo concreto, puedes indicarlo al pedir presupuesto para valorar la urgencia.",
              },
            },
            {
              "@type": "Question",
              name: "¿La traducción jurada se entrega en papel o en PDF?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Cada vez más organismos aceptan la traducción jurada en PDF firmado digitalmente. Nosotros solemos entregar en PDF firmado y, si lo necesitas, también podemos enviarte el original en papel por mensajería a tu dirección en España.",
              },
            },
            {
              "@type": "Question",
              name: "¿Cuándo es necesaria la Apostilla de la Haya?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "La Apostilla de la Haya suele exigirse cuando un documento público va a surtir efecto en otro país firmante del Convenio de La Haya. Es frecuente en certificados del Registro Civil, antecedentes penales o documentos mercantiles. Normalmente hay que traducir tanto el documento como la apostilla.",
              },
            },
            {
              "@type": "Question",
              name:
                "¿Mis traducciones juradas son válidas en España si el documento es extranjero?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Sí, siempre que la traducción jurada la realice un traductor jurado acreditado y el documento original cumpla los requisitos del organismo al que te diriges. Para trámites complejos, como extranjería o nacionalidad, conviene consultar antes con la administración o consulado correspondiente.",
              },
            },
            {
              "@type": "Question",
              name:
                "¿Hacéis traducciones juradas urgentes para citas de extranjería o notarías?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "En muchos casos podemos ofrecer traducción jurada urgente, dependiendo del volumen y del idioma. Si tienes una cita de extranjería, una firma notarial o un plazo universitario, indícalo al pedir presupuesto para revisar la disponibilidad del equipo.",
              },
            },
            {
              "@type": "Question",
              name: "¿Cuánto cuesta una traducción jurada?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "El precio depende del tipo de documento, el idioma, la extensión y la urgencia. Trabajamos con tarifas ajustadas y te indicamos siempre un precio cerrado antes de empezar. Puedes consultar una tabla de precios orientativos en nuestra página de precios o pedir un presupuesto personalizado.",
              },
            },
          ],
        })}
      </Script>

      <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
        {/* CABECERA */}
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Preguntas frecuentes
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Preguntas frecuentes sobre traducción jurada
          </h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Hemos reunido las dudas más habituales sobre la{" "}
            <strong>traducción jurada de documentos oficiales extranjeros</strong>:
            plazos, envío de documentos, validez legal, Apostilla de la Haya, formato
            de entrega y urgencias. Si no encuentras tu caso, puedes escribirnos
            y lo vemos contigo.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Si aún no sabes qué documentos vas a tener que traducir, puedes revisar la
            sección de{" "}
            <a
              href="/documentos-oficiales"
              className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
            >
              documentos oficiales
            </a>{" "}
            o ver{" "}
            <a
              href="/proceso"
              className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
            >
              cómo funciona nuestro proceso
            </a>
            .
          </p>
        </header>

        {/* LISTA FAQ */}
        <section className="mt-10 space-y-8">
          {/* 1 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Qué es una traducción jurada?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Una traducción jurada es una traducción realizada por un{" "}
              <strong>traductor jurado acreditado</strong>, que incorpora su
              firma, sello y una declaración de veracidad. No es un simple
              documento traducido, sino una traducción con{" "}
              <strong>validez oficial</strong> ante administraciones públicas,
              juzgados, notarías, universidades y otros organismos en España y en
              el extranjero.
            </p>
          </article>

          {/* 2 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Puedo enviar una foto del documento o tiene que ser un escaneo?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Para preparar el presupuesto basta con una{" "}
              <strong>foto clara o un escaneo</strong> donde se lea todo el
              contenido. Para la traducción jurada definitiva también solemos
              trabajar con imágenes nítidas en PDF o JPG. Lo importante es que
              no falten fragmentos de texto ni datos en los márgenes.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Puedes enviarnos tus documentos directamente por email o WhatsApp:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
              <li>
                Email:{" "}
                <a href={mailLink} className="text-emerald-700 underline">
                  hola@traduccionesjuradas.net
                </a>
              </li>
              <li>
                WhatsApp:{" "}
                <a href={whatsappLink} className="text-emerald-700 underline">
                  enviar mensaje por WhatsApp
                </a>
              </li>
            </ul>
          </article>

          {/* 3 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Cuánto tarda una traducción jurada?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Depende del tipo de documento, del idioma y del volumen. Como
              referencia general:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
              <li>
                Un certificado breve suele estar listo en{" "}
                <strong>24–48 horas laborables</strong>.
              </li>
              <li>
                Un expediente académico o varios documentos pueden requerir{" "}
                <strong>2–5 días laborables</strong>.
              </li>
            </ul>
            <p className="mt-2 text-sm text-slate-700">
              Si tienes una cita en extranjería, una firma notarial o un
              plazo universitario, indícalo al pedir presupuesto para valorar
              un <strong>servicio urgente</strong>.
            </p>
          </article>

          {/* 4 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿La traducción jurada se entrega en papel o en PDF?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Actualmente muchas administraciones y universidades aceptan la{" "}
              <strong>traducción jurada en PDF firmado digitalmente</strong>.
              Por ello, nuestra forma habitual de entrega es en PDF, que
              recibirás por email y podrás descargar o reenviar fácilmente.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Si el organismo te exige el original en papel, también podemos
              enviarte las <strong>copias en papel por mensajería</strong> a
              tu domicilio o despacho profesional en España.
            </p>
          </article>

          {/* 5 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Cuándo es necesaria la Apostilla de la Haya?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              La Apostilla de la Haya suele exigirse cuando un{" "}
              <strong>documento público</strong> (por ejemplo, un certificado
              del Registro Civil, antecedentes penales o un documento
              mercantil) va a surtir efecto en otro país firmante del Convenio
              de La Haya.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              En muchos casos hay que presentar el documento original
              apostillado y su <strong>traducción jurada</strong>, incluyendo
              también la apostilla. Puedes ampliar información en nuestra
              sección de{" "}
              <a
                href="/documentos-oficiales/apostilla-haya"
                className="text-emerald-700 underline"
              >
                Apostilla de la Haya
              </a>
              .
            </p>
          </article>

          {/* 6 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Mis traducciones juradas son válidas en España si el documento
              es extranjero?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Sí, siempre que la traducción la firme un{" "}
              <strong>traductor jurado acreditado</strong> y el documento
              original cumpla las condiciones que exige la administración,
              consulado, notaría o universidad donde lo vas a presentar.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              En trámites sensibles (extranjería, nacionalidad, procesos
              judiciales…) es recomendable consultar antes con el organismo
              receptor para confirmar si requieren originales, copias
              compulsadas, apostilla, etc.
            </p>
          </article>

          {/* 7 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Hacéis traducciones juradas urgentes?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              En función del idioma y del volumen, podemos asumir{" "}
              <strong>encargos urgentes</strong>. Es habitual en casos de
              citas de extranjería, trámites notariales o plazos de matrícula.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Indícanos siempre la <strong>fecha límite</strong> al solicitar
              tu presupuesto para que podamos confirmar la disponibilidad del
              equipo.
            </p>
          </article>

          {/* 8 */}
          <article>
            <h2 className="text-base font-semibold text-slate-900">
              ¿Cuánto cuesta una traducción jurada?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              El precio depende del tipo de documento, el idioma, la extensión
              y la urgencia. No es lo mismo un certificado breve que un
              expediente académico completo o un conjunto de documentos
              mercantiles.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Puedes consultar una tabla de{" "}
              <a
                href="/precios-traduccion-jurada"
                className="text-emerald-700 underline"
              >
                precios de traducción jurada orientativos
              </a>{" "}
              o enviarnos directamente los documentos para recibir un{" "}
              <strong>presupuesto cerrado</strong>.
            </p>
          </article>
        </section>

        {/* CTA FINAL */}
        <section className="mt-12 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 text-sm">
          <h2 className="text-lg font-semibold text-emerald-900">
            ¿No has encontrado tu pregunta en esta lista?
          </h2>
          <p className="mt-1 text-slate-800">
            Cuéntanos tu caso y te orientamos sin compromiso. Puedes adjuntar
            los documentos directamente o explicarnos para qué trámite
            necesitas la traducción jurada.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={mailLink}
              className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Enviar una consulta por email
            </a>
            <a
              href={whatsappLink}
              className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              Escribir por WhatsApp
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
