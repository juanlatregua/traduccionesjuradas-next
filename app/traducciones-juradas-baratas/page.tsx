// app/traducciones-juradas-baratas/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traducciones juradas con precio ajustado | Desde 40 €",
  description:
    "Traducciones juradas oficiales con precio ajustado y validez legal. Sin intermediarios. Precio mínimo orientativo: 40 € por documento. Presupuesto personalizado.",
};

export default function TraduccionesJuradasBaratas() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-slate-900">
      {/* TÍTULO */}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Traducciones juradas con precio ajustado
      </h1>

      <p className="mt-4 text-lg text-slate-700">
        Muchas personas buscan <strong>traducciones juradas baratas</strong>, pero
        es importante aclarar una cuestión fundamental:{" "}
        <strong>
          una traducción jurada oficial tiene un coste mínimo real
        </strong>{" "}
        debido a la responsabilidad legal que conlleva.
      </p>

      {/* BLOQUE CLARIDAD */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold">
          ¿Existen traducciones juradas “muy baratas”?
        </h2>
        <p className="mt-3 text-slate-700">
          No. Una traducción jurada válida debe estar realizada y firmada por un
          <strong> traductor jurado nombrado oficialmente</strong>, y tiene plena
          validez legal ante administraciones, universidades y organismos
          oficiales.
        </p>
        <p className="mt-3 text-slate-700">
          Por este motivo, <strong>no es realista</strong> encontrar traducciones
          juradas legales a precios extremadamente bajos sin intermediarios,
          automatismos o riesgos de invalidez.
        </p>
      </section>

      {/* PRECIO */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">
          ¿Cuál es el precio de una traducción jurada?
        </h2>
        <p className="mt-3 text-slate-700">
          El precio de una traducción jurada depende del idioma, el tipo de
          documento, la extensión y el plazo de entrega. Como referencia:
        </p>
        <p className="mt-4 text-lg font-semibold text-slate-900">
          💶 El precio mínimo orientativo de una traducción jurada es de{" "}
          <strong>40 € por documento</strong>.
        </p>
        <p className="mt-3 text-slate-700">
          Este precio puede ser más ajustado en algunos idiomas, como el
          <strong> francés</strong>, cuando la traducción la realiza directamente
          el traductor jurado sin intermediarios.
        </p>
      </section>

      {/* POR QUÉ AJUSTADO */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">
          ¿Por qué podemos ofrecer precios ajustados?
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
          <li>Trabajamos directamente con traductores jurados oficiales.</li>
          <li>No utilizamos intermediarios ni plataformas automáticas.</li>
          <li>Entrega habitual en PDF firmado digitalmente.</li>
          <li>Gestión online que reduce costes innecesarios.</li>
        </ul>
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
          <Link
            href="/traductor-jurado-frances"
            className="rounded-2xl border border-slate-400 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Traducciones juradas de francés
          </Link>
        </div>
      </section>
    </main>
  );
}
