import Link from "next/link";
import dynamic from "next/dynamic";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaProduct } from "@/components/SchemaProduct";
import { getWordRateForLangOrPair } from "@/lib/pricing";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";

const PresupuestoInstantaneoClient = dynamic(
  () => import("@/app/presupuesto-instantaneo/PresupuestoInstantaneoClient"),
  { ssr: false }
);

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
  langCode?: string;
  combinaciones?: string[];
  tituloH1: string;
  descripcion: string;
  documentosHabituales: DocHabitual[];
  faqItems: FAQItem[];
};

export default function PaginaIdioma({
  idioma,
  idiomaSlug,
  langCode,
  tituloH1,
  descripcion,
  documentosHabituales,
  faqItems,
}: Props) {
  const canonicalUrl = `https://www.traduccionesjuradas.net/traductor-jurado-${idiomaSlug}`;
  const breadcrumbName = `Traductor jurado de ${idioma}`;

  // Precios dinámicos para SchemaProduct
  const lang = langCode || LANGUAGE_CONFIGS[idiomaSlug]?.langCode || idiomaSlug;
  const rate = getWordRateForLangOrPair(lang);
  const priceDoc = (300 * rate * 1.1).toFixed(2);  // certificado breve ~300 palabras
  const priceStd = (800 * rate * 1.1).toFixed(2);  // documento estándar ~800 palabras
  const priceExp = (2000 * rate * 1.1).toFixed(2); // expediente ~2000 palabras

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
      <SchemaProduct
        name={`Traducción jurada de ${idioma}`}
        description={`Traducción jurada oficial de ${idioma} realizada por traductor jurado acreditado. Entrega en 24-48h. Válida para trámites oficiales en España y en el extranjero.`}
        sku={`tj-${idiomaSlug}`}
        offers={[
          {
            price: priceDoc,
            priceCurrency: "EUR",
            url: canonicalUrl,
          },
          {
            price: priceStd,
            priceCurrency: "EUR",
            url: canonicalUrl,
          },
          {
            price: priceExp,
            priceCurrency: "EUR",
            url: canonicalUrl,
          },
        ]}
      />

      {/* 1. HERO */}
      <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
        Traductor jurado de {idioma}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre">
        {tituloH1}
      </h1>
      <p className="mt-3 text-base text-sepia">{descripcion}</p>

      {/* 2. PRESUPUESTO INSTANTÁNEO */}
      <section className="mt-8">
        <div className="rounded-xl border border-cream bg-card p-5 shadow-paper">
          <h2 className="font-baskerville text-xl font-bold text-encre">
            Presupuesto instantáneo de {idioma}
          </h2>
          <p className="mt-1 text-sm text-sepia">
            Sube tu documento y recibe precio cerrado al instante.
          </p>
          <div className="mt-4">
            <PresupuestoInstantaneoClient />
          </div>
        </div>
      </section>

      {/* 3. DOCUMENTOS HABITUALES */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">
          Documentos habituales en {idioma}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {documentosHabituales.map((doc) => (
            <div
              key={doc.titulo}
              className="rounded-doc border border-cream bg-card p-4 shadow-paper"
            >
              <h3 className="font-semibold text-encre">{doc.titulo}</h3>
              <p className="mt-1 text-sm text-sepia">{doc.descripcion}</p>
              <Link
                href={doc.enlace}
                className="mt-2 inline-block text-sm text-bleu hover:underline"
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
