import type { Metadata } from "next";
import Link from "next/link";
import { WHATSAPP_LINK } from "@/lib/contact";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net" },
          { name: "Página no encontrada", url: "https://www.traduccionesjuradas.net/404" },
        ]}
      />

      <section className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-6xl font-bold text-bleu/20">404</p>
        <h1 className="mt-4 font-baskerville text-3xl font-bold text-bleu sm:text-4xl">
          Página no encontrada
        </h1>
        <p className="mt-3 text-graphite">
          La página que buscas no existe o ha sido trasladada. Puedes volver al
          inicio o pedirnos un presupuesto.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-2xl bg-bleu px-5 py-2.5 text-sm font-semibold text-white hover:bg-bleu-dark"
          >
            Ir al inicio
          </Link>
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-or px-5 py-2.5 text-sm font-semibold text-encre hover:bg-or-dark"
          >
            Presupuesto instantáneo
          </Link>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-green-600 px-5 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            WhatsApp
          </a>
        </div>
      </section>
    </>
  );
}
