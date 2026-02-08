// app/traducciones-juradas-baratas/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Traducciones juradas con precio ajustado | Desde 40 € por documento",
  description:
    "Traducciones juradas oficiales con validez legal. Sin intermediarios. Precio mínimo orientativo desde 40 € por documento (según idioma, extensión y plazo). Presupuesto rápido y personalizado.",
};

export default function TraduccionesJuradasBaratas() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-slate-900">
      {/* TÍTULO */}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Traducciones juradas con precio ajustado
      </h1>

      <p className="mt-4 text-lg text-slate-700">
        Muchas personas buscan <strong>traducciones juradas baratas</strong>.
        Nuestro enfoque es diferente: ofrecer{" "}
        <strong>un precio ajustado y transparente</strong>, sin intermediarios,
        manteniendo siempre la <strong>validez legal</strong> de la traducción.
      </p>

      {/* BLOQUE CLARIDAD */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold">
          ¿Qué significa “precio ajustado” en una traducción jurada?
        </h2>
        <p className="mt-3 text-slate-700">
          Una traducción jurada válida debe estar realizada y firmada por un{" "}
          <strong>traductor jurado nombrado oficialmente</strong>. Por eso, hay
          un coste mínimo real asociado a la responsabilidad legal, el formato y
          la fidelidad del documento.
        </p>
        <p className="mt-3 text-slate-700">
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
        <p className="mt-3 text-slate-700">
          El precio depende del idioma, el tipo de documento, la extensión y el
          plazo de entrega. Como referencia orientativa:
        </p>

        <p className="mt-4 text-lg font-semibold text-slate-900">
          💶 Precio mínimo orientativo: <strong>desde 40 € por documento</strong>.
        </p>

        <p className="mt-3 text-slate-700">
          En algunos casos (por ejemplo <strong>francés</strong>), podemos
          ofrecer un precio más ajustado cuando el encargo se gestiona{" "}
          <strong>directamente</strong> con el traductor jurado, sin
          intermediarios.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/documentos-oficiales/certificado-de-nacimiento"
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm hover:shadow-md"
          >
            <p className="font-semibold text-slate-900">
              Traducción jurada de certificado de nacimiento
            </p>
            <p className="mt-1 text-slate-600">
              Ejemplos, requisitos y cómo pedir presupuesto.
            </p>
          </Link>

          <Link
            href="/documentos-oficiales/documentos-academicos"
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm hover:shadow-md"
          >
            <p className="font-semibold text-slate-900">
              Traducción jurada de título universitario
            </p>
            <p className="mt-1 text-slate-600">
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
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">
              ¿Una traducción jurada “barata” puede ser válida?
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              Puede ser válida si está realizada por un traductor jurado oficial
              y cumple formato, fidelidad y requisitos del organismo de destino.
              Lo importante no es el adjetivo, sino la{" "}
              <strong>validez legal</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">
              ¿Qué necesitáis para dar precio exacto?
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              Una foto o escaneo legible del documento, el idioma de destino, y
              si lo necesitas urgente. Con eso te damos un{" "}
              <strong>presupuesto personalizado</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">
              ¿Entregáis en papel o en PDF?
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              Normalmente entregamos en <strong>PDF firmado digitalmente</strong>.
              Si necesitas copia en papel, podemos gestionarla según el caso.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 rounded-3xl bg-slate-900 p-6 text-slate-50">
        <h2 className="text-xl font-semibold">
          Solicita tu presupuesto personalizado
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Envíanos tu documento y te indicaremos el precio exacto y el plazo de
          entrega, sin compromiso.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Pedir presupuesto
          </Link>

          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-slate-400 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Consultar por WhatsApp
          </a>

          <Link
            href="/traductor-jurado-frances"
            className="rounded-2xl border border-slate-400 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Traducciones juradas de francés
          </Link>
        </div>

        <p className="mt-3 text-xs text-slate-300">
          Consejo: si adjuntas el documento (foto/escaneo) y nos indicas el país
          u organismo donde lo presentarás, podremos ajustar mejor el presupuesto.
        </p>
      </section>
    </main>
  );
}
