import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Traducción jurada de francés en Málaga | Servicio local oficial",
  description:
    "Servicio local de traducción jurada de francés en Málaga para trámites oficiales. Gestión online, validez legal y plazos habituales de 24-72h según documento.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traduccion-jurada-frances-malaga",
  },
};

export default function TraduccionJuradaFrancesMalagaPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12 text-encre">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Malaga · Frances jurado
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Traduccion jurada de frances en Malaga
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Servicio de <strong>traductor jurado de frances</strong> para clientes de Malaga y de toda
          Espana. Gestion online, validez oficial y entrega en PDF firmado digitalmente. Si necesitas
          copia en papel, la enviamos por mensajeria.
        </p>
        <p className="mt-2 text-xs text-sepia">
          Para información general (precio, plazos y documentos), revisa la{" "}
          <Link href="/traductor-jurado-frances" className="font-semibold text-bleu hover:underline">
            guía principal del servicio oficial de francés
          </Link>
          .
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-bleu px-5 py-2 font-semibold text-white hover:bg-bleu-dark"
          >
            Pedir presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-cream px-4 py-2 font-medium text-encre hover:bg-cream"
          >
            Enviar por WhatsApp
          </a>
          <a
            href={MAIL_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar por email
          </a>
        </div>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold">Tramites frecuentes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
            <li>Extranjeria y nacionalidad.</li>
            <li>Universidades y homologaciones.</li>
            <li>Notarias, herencias y poderes.</li>
            <li>Contratos laborales y mercantiles.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold">Precio y plazo orientativos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
            <li>Documento 1 hoja: desde 40 EUR.</li>
            <li>Documento 2 hojas: desde 50-60 EUR segun apostilla.</li>
            <li>Documentos extensos: calculo por palabras.</li>
            <li>Plazo habitual: 24-72h segun volumen e idioma.</li>
          </ul>
        </article>
      </section>

      <section className="mt-10 rounded-3xl border border-cream bg-parchment p-6">
        <h2 className="text-xl font-semibold">Cobertura Malaga y toda Espana</h2>
        <p className="mt-2 text-sm text-sepia">
          Aunque gran parte de los encargos se gestionan online, atendemos de forma prioritaria
          solicitudes de Malaga para clientes particulares, despachos y empresas. Tambien trabajamos
          a diario con tramites para otras provincias de Espana y destinos francofonos.
        </p>
        <p className="mt-2 text-sm text-sepia">
          Si buscas informacion general de combinaciones y documentos, consulta la pagina principal de{" "}
          <Link href="/traductor-jurado-frances" className="font-semibold text-bleu hover:underline">
            traduccion jurada en frances
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
