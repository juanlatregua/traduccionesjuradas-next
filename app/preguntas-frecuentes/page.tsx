// app/preguntas-frecuentes/page.tsx
import type { Metadata } from "next";
import { WHATSAPP_LINK } from "@/lib/contact";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { faqItems } from "@/lib/knowledge/faq-cliente";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre traducción jurada",
  description:
    "Resolvemos las dudas más frecuentes sobre la traducción jurada: plazos, formato de los documentos, apostilla de La Haya, validez legal, envío en PDF firmado, urgencias y precios.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/preguntas-frecuentes" },
};

const whatsappLink = WHATSAPP_LINK;
const mailLink = "mailto:hola@traduccionesjuradas.net";

const FAQ_ITEMS = faqItems("es");

// Enlaza URLs, rutas /blog/… , VALIDe y el email dentro de las respuestas de la fuente única.
const LINKS = /(https?:\/\/[^\s)]*[^\s).,;:]|\/blog\/[a-z0-9-]+|valide\.redsara\.es|[\w.]+@traduccionesjuradas\.net)/g;
function linkify(text: string) {
  return text.split(LINKS).map((part, i) => {
    if (i % 2 === 0) return part;
    const href = part.includes("@") ? `mailto:${part}` : part.startsWith("/") || part.startsWith("http") ? part : `https://${part}`;
    const external = href.startsWith("http");
    return (
      <a key={i} href={href} className="text-bleu underline" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {part}
      </a>
    );
  });
}

export default function PreguntasFrecuentesPage() {
  return (
    <>
      {/* SCHEMA FAQ — server-render para que lo lean crawlers y bots de IA
          sin ejecutar JS (AEO). */}
      <SchemaFAQ id="faq-preguntas-frecuentes" items={FAQ_ITEMS} />

      <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
        {/* CABECERA */}
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            Preguntas frecuentes
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
            Preguntas frecuentes sobre traducción jurada
          </h1>
          <p className="mt-3 text-sm text-sepia sm:text-base">
            Hemos reunido las dudas más habituales sobre la{" "}
            <strong>traducción jurada de documentos oficiales extranjeros</strong>:
            plazos, envío de documentos, validez legal, Apostilla de la Haya, formato
            de entrega y urgencias. Si no encuentras tu caso, puedes escribirnos
            y lo vemos contigo.
          </p>
          <p className="mt-2 text-xs text-sepia">
            Si aún no sabes qué documentos vas a tener que traducir, puedes revisar la
            sección de{" "}
            <a
              href="/documentos-oficiales"
              className="font-semibold text-bleu underline-offset-2 hover:underline"
            >
              documentos oficiales
            </a>{" "}
            o ver{" "}
            <a
              href="/proceso"
              className="font-semibold text-bleu underline-offset-2 hover:underline"
            >
              cómo funciona nuestro proceso
            </a>
            .
          </p>
        </header>

        {/* LISTA FAQ */}
        <section className="mt-10 space-y-8">
          {FAQ_ITEMS.map((item) => (
            <article key={item.id} id={item.id}>
              <h2 className="text-base font-semibold text-encre">{item.question}</h2>
              <p className="mt-2 text-sm text-sepia">{linkify(item.answer)}</p>
            </article>
          ))}

          {/* 5 */}
          <article>
            <h2 className="text-base font-semibold text-encre">
              ¿Es válida una traducción jurada en PDF con firma digital?
            </h2>
            <p className="mt-2 text-sm text-sepia">
              Sí, una <strong>traducción jurada en PDF firmada digitalmente</strong> es válida
              en muchos trámites administrativos, siempre que el organismo receptor acepte
              documentación electrónica. Administraciones, universidades y entidades extranjeras
              suelen admitirla si el traductor jurado está habilitado por el Ministerio de Asuntos
              Exteriores de España.
            </p>

            <h3 className="mt-3 text-sm font-semibold text-encre">
              ¿Cuándo no es suficiente el PDF?
            </h3>
            <p className="mt-1 text-sm text-sepia">
              Cuando el trámite exige <strong>legalización o apostilla</strong>, el PDF no basta,
              aunque esté firmado digitalmente. El MAEC solo legaliza traducciones juradas
              en papel, con firma manuscrita y sello original. Un PDF impreso no puede legalizarse.
            </p>
            <p className="mt-2 text-sm text-sepia">
              Consulta la guía oficial del Ministerio de Asuntos Exteriores sobre{" "}
              <a
                href="https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Legalizacion-y-apostilla.aspx"
                className="text-bleu underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                legalización y apostilla
              </a>
              .
            </p>

            <h3 className="mt-3 text-sm font-semibold text-encre">
              ¿Por qué se legaliza una traducción jurada?
            </h3>
            <p className="mt-1 text-sm text-sepia">
              La traducción jurada certifica la fidelidad lingüística, pero la legalización/apostilla
              sirve para:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
              <li>Confirmar oficialmente que el traductor jurado está habilitado.</li>
              <li>Autenticar la firma y el sello del traductor jurado.</li>
              <li>Garantizar el reconocimiento del documento por autoridades extranjeras.</li>
            </ul>

            <h3 className="mt-3 text-sm font-semibold text-encre">
              Orden correcto del trámite
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-sepia">
              <li>Emisión del documento original.</li>
              <li>Apostilla o legalización del documento original (si el país de destino lo exige).</li>
              <li>Traducción jurada del documento y de la apostilla.</li>
              <li>Si procede: legalización de la traducción jurada en papel.</li>
            </ol>

            <h3 className="mt-3 text-sm font-semibold text-encre">
              Resumen rápido
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
              <li>Traducción jurada en PDF: válida para muchos trámites.</li>
              <li>Traducción jurada en PDF: no se puede legalizar.</li>
              <li>Traducción jurada en papel: necesaria si exigen apostilla o legalización; la enviamos por mensajería y el envío se cobra aparte (el importe figura en el presupuesto).</li>
            </ul>

            <h3 className="mt-3 text-sm font-semibold text-encre">
              ¿Dudas sobre tu caso?
            </h3>
            <p className="mt-1 text-sm text-encre">
              Cada organismo aplica requisitos distintos. Si no sabes si necesitas PDF o papel,
              o si deben apostillar/legalizar, consúltanos antes de iniciar el trámite. Te ayudamos
              a elegir el formato correcto y evitar retrasos o rechazos.
            </p>
          </article>
        </section>

        {/* CTA FINAL */}
        <section className="mt-12 rounded-3xl border border-cream bg-cream/70 p-6 text-sm">
          <h2 className="text-lg font-semibold text-bleu">
            ¿No has encontrado tu pregunta en esta lista?
          </h2>
        <p className="mt-1 text-encre">
          Cuéntanos tu caso y te orientamos sin compromiso. Puedes adjuntar
          los documentos directamente o explicarnos para qué trámite
          necesitas la traducción jurada.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={mailLink}
              className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
            >
              Enviar una consulta por email
            </a>
            <a
              href={whatsappLink}
              className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
            >
              Escribir por WhatsApp
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
