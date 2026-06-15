// app/traducciones-juradas-baratas/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { WHATSAPP_LINK } from "@/lib/contact";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";

export const metadata: Metadata = {
  title: "Traductor jurado online barato \u00B7 desde 35\u20AC \u00B7 MAEC",
  description:
    "Traducci\u00F3n jurada online a precio ajustado, desde 35\u20AC: directo con el traductor jurado (MAEC n\u00BA 3850), sin agencias. Presupuesto al instante, 24-48h.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/traducciones-juradas-baratas" },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFUna traducci\u00F3n jurada \u201Cbarata\u201D puede ser v\u00E1lida?",
    answer:
      "S\u00ED, siempre que la realice y firme un traductor jurado nombrado por el MAEC (n\u00BA 3850). La validez no depende del precio, sino de que cumpla formato, fidelidad y los requisitos del organismo de destino. Un precio ajustado y honesto se consigue trabajando directamente con el traductor, sin agencias intermediarias.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta una traducci\u00F3n jurada online?",
    answer:
      "Desde 40\u20AC por documento. El precio exacto depende del idioma, el tipo de documento, la extensi\u00F3n y el plazo. En franc\u00E9s, al gestionarse directamente con el traductor jurado, el precio suele ser m\u00E1s ajustado. Recibes un presupuesto cerrado al instante antes de pagar nada.",
  },
  {
    question: "\u00BFCu\u00E1nto tarda la entrega?",
    answer:
      "La entrega habitual es de 24 a 48 horas para documentos est\u00E1ndar de una p\u00E1gina. Recibes la traducci\u00F3n jurada en PDF firmado digitalmente, con plena validez oficial. Si lo necesitas urgente, podemos priorizarlo.",
  },
  {
    question: "\u00BFQu\u00E9 necesit\u00E1is para dar precio exacto?",
    answer:
      "Una foto o escaneo legible del documento, el idioma de destino y el pa\u00EDs u organismo donde lo presentar\u00E1s. Con eso te damos un presupuesto cerrado al instante, sin compromiso.",
  },
];

export default function TraduccionesJuradasBaratas() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-encre">
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net" },
          {
            name: "Traductor jurado online barato",
            url: "https://www.traduccionesjuradas.net/traducciones-juradas-baratas",
          },
        ]}
      />
      <SchemaFAQ items={FAQ_ITEMS} />

      {/* TÍTULO */}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Traductor jurado online a precio ajustado
      </h1>

      {/* RESPUESTA-CITABLE (AEO) */}
      <p className="mt-4 text-lg text-sepia">
        Una <strong>traducción jurada online a precio ajustado cuesta desde 40 €
        por documento</strong> cuando se contrata directamente con el traductor
        jurado oficial (MAEC nº 3850), sin agencias intermediarias. Recibes un{" "}
        <strong>presupuesto cerrado al instante</strong>, entrega en{" "}
        <strong>24-48 h</strong> en PDF firmado y plena <strong>validez oficial</strong>.
      </p>

      <p className="mt-4 text-base text-sepia">
        Muchas personas buscan <strong>traducciones juradas baratas</strong>.
        Nuestro enfoque es ofrecer{" "}
        <strong>un precio ajustado y transparente</strong>, sin intermediarios,
        manteniendo siempre la <strong>validez legal</strong> de la traducción.
      </p>

      {/* BLOQUE CLARIDAD */}
      <section className="mt-8 rounded-2xl border border-cream bg-parchment p-6">
        <h2 className="text-xl font-semibold">
          ¿Qué significa “precio ajustado” en una traducción jurada?
        </h2>
        <p className="mt-3 text-sepia">
          Una traducción jurada válida debe estar realizada y firmada por un{" "}
          <strong>traductor jurado nombrado oficialmente</strong>. Por eso, hay
          un coste mínimo real asociado a la responsabilidad legal, el formato y
          la fidelidad del documento.
        </p>
        <p className="mt-3 text-sepia">
          Si encuentras precios extremadamente bajos, suele haber{" "}
          <strong>intermediación</strong>, automatismos o{" "}
          <strong>riesgo de que no sea aceptada</strong> por el organismo donde
          la presentes.
        </p>
      </section>

      {/* PRECIO */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">
          ¿Cuál es el precio de una traducción jurada?
        </h2>
        <p className="mt-3 text-sepia">
          El precio depende del idioma, el tipo de documento, la extensión y el
          plazo de entrega. Como referencia orientativa:
        </p>

        <p className="mt-4 text-lg font-semibold text-encre">
          💶 Precio mínimo orientativo: <strong>desde 40 € por documento</strong>.
        </p>

        <p className="mt-3 text-sepia">
          En algunos casos (por ejemplo <strong>francés</strong>), podemos
          ofrecer un precio más ajustado cuando el encargo se gestiona{" "}
          <strong>directamente</strong> con el traductor jurado, sin
          intermediarios.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/documentos-oficiales/certificado-de-nacimiento"
            className="rounded-2xl border border-cream bg-card p-4 text-sm shadow-sm hover:shadow-md"
          >
            <p className="font-semibold text-encre">
              Traducción jurada de certificado de nacimiento
            </p>
            <p className="mt-1 text-sepia">
              Ejemplos, requisitos y cómo pedir presupuesto.
            </p>
          </Link>

          <Link
            href="/documentos-oficiales/documentos-academicos"
            className="rounded-2xl border border-cream bg-card p-4 text-sm shadow-sm hover:shadow-md"
          >
            <p className="font-semibold text-encre">
              Traducción jurada de título universitario
            </p>
            <p className="mt-1 text-sepia">
              Qué suele incluir y cómo calcular el precio.
            </p>
          </Link>
        </div>
      </section>

      {/* POR QUÉ AJUSTADO */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">
          ¿Por qué podemos ofrecer precios ajustados?
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sepia">
          <li>Trabajamos directamente con traductores jurados oficiales.</li>
          <li>Sin intermediarios ni “plataformas” que encarecen el servicio.</li>
          <li>Entrega habitual en PDF firmado digitalmente.</li>
          <li>Gestión online ágil para reducir tiempos y costes innecesarios.</li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Preguntas frecuentes</h2>

        <div className="mt-4 space-y-4">
          {FAQ_ITEMS.map((qa) => (
            <div key={qa.question} className="rounded-2xl border border-cream bg-card p-5">
              <h3 className="font-semibold text-encre">{qa.question}</h3>
              <p className="mt-2 text-sm text-sepia">{qa.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 rounded-3xl bg-encre p-6 text-parchment">
        <h2 className="text-xl font-semibold">
          Solicita tu presupuesto personalizado
        </h2>
        <p className="mt-2 text-sm text-cream">
          Envíanos tu documento y te indicaremos el precio exacto y el plazo de
          entrega, sin compromiso.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-sm font-semibold text-white hover:bg-bleu"
          >
            Pedir presupuesto
          </Link>

          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-cream px-5 py-2 text-sm font-semibold text-parchment hover:bg-encre"
          >
            Consultar por WhatsApp
          </a>

          <Link
            href="/traductor-jurado-frances"
            className="rounded-2xl border border-cream px-5 py-2 text-sm font-semibold text-parchment hover:bg-encre"
          >
            Servicio oficial de francés
          </Link>
        </div>

        <p className="mt-3 text-xs text-cream">
          Consejo: si adjuntas el documento (foto/escaneo) y nos indicas el país
          u organismo donde lo presentarás, podremos ajustar mejor el presupuesto.
        </p>
      </section>
    </main>
  );
}
