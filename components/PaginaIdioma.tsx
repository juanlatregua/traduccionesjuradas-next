import Link from "next/link";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import EstimadorCarrito from "@/components/EstimadorCarrito";

type DocHabitual = {
  titulo: string;
  descripcion: string;
  enlace: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type Props = {
  idioma: string;
  idiomaSlug: string;
  combinaciones: string[];
  tituloH1: string;
  descripcion: string;
  documentosHabituales: DocHabitual[];
  faqItems: FAQItem[];
};

export default function PaginaIdioma({
  idioma,
  idiomaSlug,
  combinaciones,
  tituloH1,
  descripcion,
  documentosHabituales,
  faqItems,
}: Props) {
  const canonicalUrl = `https://www.traduccionesjuradas.net/traductor-jurado-${idiomaSlug}`;
  const breadcrumbName = `Traductor jurado de ${idioma}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id={`breadcrumbs-traductor-jurado-${idiomaSlug}`}
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: breadcrumbName, url: canonicalUrl },
        ]}
      />
      <SchemaFAQ
        id={`faq-traductor-jurado-${idiomaSlug}`}
        items={faqItems}
      />

      {/* 1. HERO */}
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Traductor jurado de {idioma}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {tituloH1}
      </h1>
      <p className="mt-3 text-base text-slate-600">{descripcion}</p>

      {/* 2. ESTIMADOR CARRITO */}
      <EstimadorCarrito
        idioma={idioma}
        combinaciones={combinaciones}
      />

      {/* 3. DOCUMENTOS HABITUALES */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">
          Documentos habituales en {idioma}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {documentosHabituales.map((doc) => (
            <div
              key={doc.titulo}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="font-semibold text-slate-900">{doc.titulo}</h3>
              <p className="mt-1 text-sm text-slate-600">{doc.descripcion}</p>
              <Link
                href={doc.enlace}
                className="mt-2 inline-block text-sm text-emerald-700 hover:underline"
              >
                Ver más →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
