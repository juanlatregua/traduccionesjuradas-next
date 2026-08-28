import Link from "next/link";
import dynamic from "next/dynamic";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaProduct } from "@/components/SchemaProduct";
import { SchemaService } from "@/components/SchemaService";
import UploadHeroPlaceholder from "@/components/UploadHeroPlaceholder";
import { getWordRateForLangOrPair } from "@/lib/pricing";
import { getMinimum } from "@/lib/pricing-engine/rules";
import { LANGUAGE_CONFIGS, type LanguageConfig } from "@/lib/language-config";
import { CENSO_STIJ, CENSO_STIJ_FECHA } from "@/lib/censo-jurados";

const PuertaClient = dynamic(
  () => import("@/app/presupuesto-instantaneo/PuertaClient"),
  { ssr: false, loading: () => <UploadHeroPlaceholder /> }
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

export default async function PaginaIdioma({
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

  // Respuesta-arriba citable (AEO): definición concisa y atribuible para que los
  // motores de IA la extraigan. El nº 3850 es la credencial FRANCESA de Juan, así
  // que solo se cita en francés; el resto, "acreditado por el MAEC" (genérico).
  const credencial =
    idiomaSlug === "frances"
      ? "un traductor jurado de francés acreditado por el MAEC (nº 3850)"
      : `un traductor jurado de ${idioma} acreditado por el MAEC`;
  const respuestaAeo = `Una traducción jurada de ${idioma} es la traducción oficial de un documento, firmada y sellada por ${credencial}, con plena validez legal ante administraciones, notarías, universidades y juzgados de España y del extranjero. Se entrega en PDF firmado digitalmente.`;

  // Precios dinámicos para SchemaProduct (aplicando mínimo del idioma)
  const lang = langCode || LANGUAGE_CONFIGS[idiomaSlug]?.langCode || idiomaSlug;
  const rate = getWordRateForLangOrPair(lang);
  // Fuente única de mínimos (fr = suelos nuevos 24-ago: 35 el doc suelto).
  const minPrice = getMinimum("other", lang);

  // Dato citable (AEO 24-ago): el CENSO OFICIAL, que es verificable, con fuente
  // y con fecha. Eso es lo que hace que los motores de IA citen esta página; la
  // competencia sirve cifras de 2024 sin fuente.
  //
  // Aquí iba además "· M en la red de traduccionesjuradas.net, con respuesta en
  // el día", con la M pedida en vivo al padrón de otro sistema. Retirado el
  // 28-ago-2026 por tres razones, todas comprobadas:
  //   1. Un lector entiende "trabajamos con M traductores", y no es eso: es un
  //      grupo al que se le puede preguntar. De 15 solicitudes reales, 10
  //      recibieron precio.
  //   2. En italiano, sueco y noruego esa M valía 1. "1 en nuestra red" no
  //      impresiona a nadie y es justo el caso que más se atasca.
  //   3. "Con respuesta en el día" era una promesa hecha en nombre de gente que
  //      no la ha hecho; cuando uno no contesta, el que queda mal es él.
  // La promesa de plazo pasa a ser de la casa, que es quien puede cumplirla.
  const censoN = CENSO_STIJ[lang];
  const datoCitable = censoN
    ? `Traductores jurados de ${idioma.toLowerCase()} en activo en España: ${censoN} (lista oficial del Ministerio, ${CENSO_STIJ_FECHA}). Te respondemos en el día con el precio y el plazo.`
    : null;
  // FAQs de datos: se añaden solo si la página no trae ya una pregunta parecida
  // (las landings tienen FAQ propias de precio/plazo — no duplicar en el schema).
  const dataFaqs: FAQItem[] = [];
  if (datoCitable) {
    const has = (re: RegExp) => faqItems.some((f) => re.test(f.question));
    if (!has(/cu[aá]ntos traductores/i)) {
      dataFaqs.push({
        question: `¿Cuántos traductores jurados de ${idioma.toLowerCase()} hay en España?`,
        answer: `${censoN} en activo según la lista oficial del Ministerio (${CENSO_STIJ_FECHA}). En traduccionesjuradas.net te respondemos en el día con el precio y el plazo.`,
      });
    }
    if (!has(/tarda|plazo/i)) {
      dataFaqs.push({
        question: `¿Cuánto tarda una traducción jurada de ${idioma.toLowerCase()}?`,
        answer:
          lang === "fr"
            ? "Los documentos habituales se entregan en 24-48 h en PDF firmado digitalmente."
            : "Normalmente entre 2 y 5 días laborables. El plazo exacto te lo confirma tu traductor jurado junto con el precio, normalmente el mismo día.",
      });
    }
    if (!has(/cuesta|precio/i)) {
      dataFaqs.push({
        question: `¿Cuánto cuesta una traducción jurada de ${idioma.toLowerCase()}?`,
        answer:
          lang === "fr"
            ? "Desde 35 € + IVA por documento breve (40 € con apostilla). Sube el documento y recibes el precio cerrado al instante."
            : "Depende del documento. Súbelo y tu traductor jurado nombrado por el MAEC te confirma el precio hoy mismo, sin compromiso.",
      });
    }
  }
  const allFaqs = [...faqItems, ...dataFaqs];
  const priceDoc = Math.max(300 * rate * 1.1, minPrice).toFixed(2);  // certificado breve ~300 palabras
  const priceStd = Math.max(800 * rate * 1.1, minPrice).toFixed(2);  // documento estándar ~800 palabras
  const priceExp = Math.max(2000 * rate * 1.1, minPrice).toFixed(2); // expediente ~2000 palabras

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
        items={allFaqs}
      />
      <SchemaService
        id={`service-traductor-jurado-${idiomaSlug}`}
        serviceName={`Traducción jurada de ${idioma}`}
        serviceDescription={`Servicio de traducción jurada oficial de ${idioma} realizado por traductor jurado acreditado por el MAEC. Entrega online en PDF firmado digitalmente. Válida para trámites oficiales en España.`}
        serviceUrl={canonicalUrl}
      />
      <SchemaProduct
        name={`Traducción jurada de ${idioma}`}
        description={`Traducción jurada oficial de ${idioma} realizada por traductor jurado acreditado. ${idiomaSlug === "frances" || idiomaSlug === "ingles" ? "Entrega en 24-48h." : "Entrega en 3-5 días laborables."} Válida para trámites oficiales en España y en el extranjero.`}
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

      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: `Traductor jurado de ${idioma}`, href: `/traductor-jurado-${idiomaSlug}` },
      ]} />

      {/* 1. HERO */}
      <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
        Traductor jurado de {idioma}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre">
        {tituloH1}
      </h1>
      {/* Respuesta-arriba citable (AEO) — primera frase atribuible para IA. */}
      <p className="mt-3 text-base font-medium text-encre">{respuestaAeo}</p>
      {datoCitable && (
        <p className="mt-2 rounded-lg border border-bleu/15 bg-cream px-4 py-2.5 text-sm font-medium text-encre">
          {datoCitable}
        </p>
      )}
      <p className="mt-3 text-base text-sepia">{descripcion}</p>

      {/* 2. PRESUPUESTO INSTANTÁNEO */}
      <section className="mt-8">
        <div className="rounded-xl border border-cream bg-card p-5 shadow-paper">
          <h2 className="font-baskerville text-xl font-bold text-encre">
            Presupuesto instantáneo de {idioma}
          </h2>
          <p className="mt-1 text-sm text-sepia">
            {lang === "fr"
              ? "Sube tu documento y recibe precio cerrado al instante. "
              : "Sube tu documento: lo analizamos al instante y tu traductor jurado te confirma el precio, normalmente hoy mismo. "}
            Sin agencia de por medio: mira cómo conseguimos{" "}
            <Link
              href="/traducciones-juradas-baratas"
              className="font-medium text-bleu hover:underline"
            >
              traducciones juradas baratas
            </Link>{" "}
            sin renunciar a la validez legal.
          </p>
          <div className="mt-4">
            <PuertaClient purpose={null} />
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

      {/* 4. PREGUNTAS FRECUENTES — deben ser visibles: el SchemaFAQ de arriba las
          declara y la política de datos estructurados exige que el usuario las vea. */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">
          Preguntas frecuentes — traducción jurada de {idioma}
        </h2>
        <div className="mt-4 space-y-3">
          {allFaqs.map((qa) => (
            <details
              key={qa.question}
              className="rounded-doc border border-cream bg-card p-4 shadow-paper"
            >
              <summary className="cursor-pointer text-sm font-semibold text-encre">
                {qa.question}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-sepia">{qa.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 5. OTROS IDIOMAS */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-encre">
          Traducción jurada en otros idiomas
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.values(LANGUAGE_CONFIGS)
            .filter((c: LanguageConfig) => c.slug !== idiomaSlug)
            .map((c: LanguageConfig) => (
              <Link
                key={c.slug}
                href={`/traductor-jurado-${c.slug}`}
                className="rounded-full border border-cream bg-card px-3 py-1.5 text-xs font-medium text-encre hover:border-bleu hover:text-bleu transition-colors"
              >
                {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
              </Link>
            ))}
        </div>
      </section>

      {/* 6. CIUDADES PRINCIPALES */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-encre">
          Traductor jurado de {idioma} en las principales ciudades
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { slug: "madrid", name: "Madrid" },
            { slug: "barcelona", name: "Barcelona" },
            { slug: "valencia", name: "Valencia" },
            { slug: "sevilla", name: "Sevilla" },
            { slug: "malaga", name: "Málaga" },
            { slug: "bilbao", name: "Bilbao" },
          ].map((city) => (
            <Link
              key={city.slug}
              href={`/traductor-jurado/${city.slug}`}
              className="rounded-full border border-cream bg-card px-3 py-1.5 text-xs font-medium text-encre hover:border-bleu hover:text-bleu transition-colors"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
