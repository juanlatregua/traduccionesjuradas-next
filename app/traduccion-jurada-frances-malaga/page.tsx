import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Traduccion jurada frances Malaga | Traductor jurado oficial",
  description:
    "Traduccion jurada de frances en Malaga para tramites en Espana y en el extranjero. Precio orientativo desde 40 EUR y entrega habitual en 24-72h segun documento.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traduccion-jurada-frances-malaga",
  },
};

export default function TraduccionJuradaFrancesMalagaPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12 text-slate-900">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Malaga · Frances jurado
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Traduccion jurada de frances en Malaga
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Servicio de <strong>traductor jurado de frances</strong> para clientes de Malaga y de toda
          Espana. Gestion online, validez oficial y entrega en PDF firmado digitalmente. Si necesitas
          copia en papel, la enviamos por mensajeria.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Pedir presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-slate-300 px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
          >
            Enviar por WhatsApp
          </a>
          <a
            href={MAIL_LINK}
            className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Enviar por email
          </a>
        </div>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">Tramites frecuentes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Extranjeria y nacionalidad.</li>
            <li>Universidades y homologaciones.</li>
            <li>Notarias, herencias y poderes.</li>
            <li>Contratos laborales y mercantiles.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">Precio y plazo orientativos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Documento 1 hoja: desde 40 EUR.</li>
            <li>Documento 2 hojas: desde 50-60 EUR segun apostilla.</li>
            <li>Documentos extensos: calculo por palabras.</li>
            <li>Plazo habitual: 24-72h segun volumen e idioma.</li>
          </ul>
        </article>
      </section>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold">Cobertura Malaga y toda Espana</h2>
        <p className="mt-2 text-sm text-slate-700">
          Aunque gran parte de los encargos se gestionan online, atendemos de forma prioritaria
          solicitudes de Malaga para clientes particulares, despachos y empresas. Tambien trabajamos
          a diario con tramites para otras provincias de Espana y destinos francofonos.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Si buscas informacion general de combinaciones y documentos, consulta la pagina principal de{" "}
          <Link href="/traductor-jurado-frances" className="font-semibold text-emerald-700 hover:underline">
            traductor jurado de frances
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
