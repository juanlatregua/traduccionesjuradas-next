import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaLocalBusiness } from "@/components/SchemaLocalBusiness";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CIUDADES, type Ciudad } from "@/src/data/ciudades";
import { LANGUAGE_CONFIGS, type LanguageConfig } from "@/lib/language-config";

const ciudadBySlug = new Map<string, Ciudad>(
  CIUDADES.map((c) => [c.slug, c])
);

export async function generateStaticParams() {
  return CIUDADES.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}): Promise<Metadata> {
  const { ciudad: slug } = await params;
  const ciudad = ciudadBySlug.get(slug);
  if (!ciudad) return {};

  const consuladoNote = ciudad.tieneConsulado ? " · Consulado de Francia" : "";
  return {
    title: `Traductor Jurado en ${ciudad.nombre} (${ciudad.provincia})${consuladoNote} · MAEC`,
    description: `Traductor jurado oficial para ${ciudad.nombre}, ${ciudad.provincia}. Traducción jurada online con validez ante Registro Civil, Extranjería y Consulado. Entrega en 24-48h, sin desplazamientos. Desde 35€.`,
    alternates: {
      canonical: `https://www.traduccionesjuradas.net/traductor-jurado/${ciudad.slug}`,
    },
    // Cola consolidada: noindex para no diluir crawl budget (sigue accesible).
    ...(ciudad.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

const DOCUMENTOS_BASE = [
  "Certificado de nacimiento",
  "Certificado de matrimonio",
  "Antecedentes penales",
  "Título universitario y expediente académico",
  "Permiso de residencia y NIE",
  "Contrato de trabajo",
  "Poderes notariales",
  "Documentos mercantiles",
];

const DOCUMENTOS_MARRUECOS = [
  "Documentos del Registro Civil de Marruecos",
  "Acta de nacimiento marroquí",
  "Certificado de soltería marroquí",
];

// FAQ por ciudad → FAQPage server-side (AEO) + sección visible (texto único).
// Respuestas verificables y honestas: servicio online, validez MAEC en toda
// España, plazo 24-48 h (coincide con el resto de la copia). Sin datos inventados.
function cityFaq(ciudad: Ciudad): { question: string; answer: string }[] {
  const faq = [
    {
      question: `¿Hay que ir en persona a ${ciudad.nombre} para una traducción jurada?`,
      answer: `No. El servicio es 100% online: envías el documento desde ${ciudad.nombre} y recibes la traducción jurada firmada y sellada por email (y en papel por mensajería si lo necesitas). No hay que desplazarse ni pedir cita.`,
    },
    {
      question: `¿La traducción jurada vale para la Administración de ${ciudad.provincia}?`,
      answer: `Sí. Una traducción jurada de un traductor nombrado por el MAEC tiene validez oficial en toda España, incluidos el Registro Civil, la Oficina de Extranjería y los organismos de ${ciudad.provincia}.`,
    },
    {
      question: `¿Cuánto tarda una traducción jurada en ${ciudad.nombre}?`,
      answer: `La entrega habitual es de 24-48 horas por email desde ${ciudad.nombre}, según el volumen. Recibes un presupuesto cerrado al instante antes de confirmar.`,
    },
  ];
  if (ciudad.altaInmigracionMarroqui) {
    faq.push({
      question: `¿Traducís documentos marroquíes (francés/árabe) para trámites en ${ciudad.nombre}?`,
      answer: `Sí. En ${ciudad.nombre} es muy frecuente la traducción jurada de documentos del registro civil marroquí (acta de nacimiento, certificado de matrimonio, antecedentes penales) para reagrupación familiar, residencia y nacionalidad. En documentos bilingües francés-árabe se traduce desde el francés.`,
    });
  }
  return faq;
}

export default async function PaginaCiudad({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad: slug } = await params;
  const ciudad = ciudadBySlug.get(slug);
  if (!ciudad) notFound();

  const canonicalUrl = `https://www.traduccionesjuradas.net/traductor-jurado/${ciudad.slug}`;
  const faq = cityFaq(ciudad);

  // Use city-specific documents if available, otherwise fallback to generic list
  const documentosCiudad = ciudad.documentosMasFrecuentes?.length
    ? ciudad.documentosMasFrecuentes
    : [];
  const documentosGenericos = ciudad.altaInmigracionMarroqui
    ? [...DOCUMENTOS_BASE, ...DOCUMENTOS_MARRUECOS]
    : DOCUMENTOS_BASE;

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Traductor Jurado de Francés — traduccionesjuradas.net",
    url: "https://www.traduccionesjuradas.net",
    serviceArea: {
      "@type": "City",
      name: ciudad.nombre,
    },
    areaServed: ciudad.nombre,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id={`breadcrumbs-traductor-jurado-${ciudad.slug}`}
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: `Traductor jurado en ${ciudad.nombre}`,
            url: canonicalUrl,
          },
        ]}
      />
      {/* Schema server-side (en el HTML), no por JS, para bots de cita IA y Google sin-JS. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <SchemaFAQ id={`faq-city-${ciudad.slug}`} items={faq} />
      {/* LocalBusiness solo en Málaga: es la sede física real (Calle Esperanto, 9).
          En el resto de ciudades el servicio es online (ProfessionalService con
          serviceArea), sin sede local → no se afirma presencia física. */}
      {ciudad.slug === "malaga" && (
        <SchemaLocalBusiness id="https://www.traduccionesjuradas.net/traductor-jurado/malaga#localbusiness" />
      )}

      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          {
            name: `Traductor jurado en ${ciudad.nombre}`,
            href: `/traductor-jurado/${ciudad.slug}`,
          },
        ]}
      />

      {/* ═══════════════ SECCIÓN 1: HERO ═══════════════ */}
      <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
        Traductor jurado oficial
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre">
        Traductor Jurado Oficial en {ciudad.nombre}
      </h1>
      <p className="mt-3 text-base text-sepia">
        Servicio online con validez oficial ante cualquier organismo público en
        España. Sin desplazamientos.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/presupuesto-instantaneo"
          className="rounded-lg bg-bleu px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bleu/90 transition-colors"
        >
          Pedir presupuesto instantáneo
        </Link>
        <Link
          href="/precios-traduccion-jurada"
          className="rounded-lg border border-cream bg-card px-5 py-2.5 text-sm font-semibold text-encre shadow-sm hover:border-bleu hover:text-bleu transition-colors"
        >
          Ver precios
        </Link>
      </div>

      {/* ═══════════════ SECCIÓN 2: INTRO LOCAL ═══════════════ */}
      <section className="mt-10">
        <div className="rounded-xl border border-cream bg-card p-5 shadow-paper">
          <h2 className="font-baskerville text-xl font-bold text-encre">
            Traducción jurada en {ciudad.nombre}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-sepia">
            Si necesitas una traducción jurada en {ciudad.nombre}, nuestro
            servicio online te permite enviar tus documentos desde{" "}
            {ciudad.nombre} y recibirlos por email en 24-48 horas. La traducción
            tiene plena validez oficial ante el Registro Civil, la
            Administración General del Estado, universidades y cualquier
            organismo público en España.
          </p>
          {ciudad.slug === "malaga" && (
            <p className="mt-3 text-sm leading-relaxed text-sepia">
              Somos una empresa de traducción jurada con sede en Málaga (Calle
              Esperanto, 9). El servicio es online, pero al estar basados aquí
              conocemos de primera mano los trámites ante el Registro Civil, la
              Oficina de Extranjería y los juzgados de Málaga.
            </p>
          )}
          {/* City-specific unique paragraphs */}
          {ciudad.datosUnicos?.map((dato, i) => (
            <p key={i} className="mt-3 text-sm leading-relaxed text-sepia">
              {dato}
            </p>
          ))}
          {ciudad.tieneConsulado && !ciudad.consuladoFrances && (
            <p className="mt-3 text-sm leading-relaxed text-sepia">
              En {ciudad.nombre} hay Consulado de Francia — si necesitas
              presentar documentos en el consulado, nuestras traducciones juradas
              al francés tienen validez oficial.
            </p>
          )}
          {ciudad.altaInmigracionMarroqui && (
            <p className="mt-3 text-sm leading-relaxed text-sepia">
              En {ciudad.nombre} tramitamos frecuentemente documentos marroquíes:
              partidas de nacimiento, certificados de matrimonio, antecedentes
              penales y documentos del registro civil de Marruecos.
            </p>
          )}
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 2B: CONSULADO ═══════════════ */}
      {ciudad.consuladoFrances && (
        <section className="mt-6">
          <div className="rounded-xl border border-bleu/20 bg-bleu/5 p-5">
            <h3 className="font-baskerville text-lg font-bold text-bleu">
              Consulado de Francia en {ciudad.nombre}
            </h3>
            <p className="mt-2 text-sm text-sepia">
              Si necesitas presentar documentos traducidos ante el Consulado de
              Francia en {ciudad.nombre}, nuestras traducciones juradas al
              francés tienen plena validez oficial.
            </p>
            <div className="mt-3 space-y-1 text-sm text-encre">
              <p>
                <span className="font-semibold">Dirección:</span>{" "}
                {ciudad.consuladoFrances.direccion}
              </p>
              <p>
                <span className="font-semibold">Teléfono:</span>{" "}
                <a
                  href={`tel:${ciudad.consuladoFrances.telefono.replace(/\s/g, "")}`}
                  className="text-bleu hover:underline"
                >
                  {ciudad.consuladoFrances.telefono}
                </a>
              </p>
              <p>
                <span className="font-semibold">Web:</span>{" "}
                <a
                  href={ciudad.consuladoFrances.web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bleu hover:underline"
                >
                  {ciudad.consuladoFrances.web.replace(/^https?:\/\//, "")}
                </a>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ SECCIÓN 2C: OFICINAS ÚTILES ═══════════════ */}
      {(ciudad.registroCivil || ciudad.extranjeria) && (
        <section className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {ciudad.registroCivil && (
              <div className="rounded-xl border border-cream bg-card p-4 shadow-paper">
                <h3 className="text-sm font-bold text-encre">
                  Registro Civil
                </h3>
                <p className="mt-1 text-sm text-sepia">
                  {ciudad.registroCivil.nombre}
                </p>
                <p className="text-xs text-graphite">
                  {ciudad.registroCivil.direccion}
                </p>
              </div>
            )}
            {ciudad.extranjeria && (
              <div className="rounded-xl border border-cream bg-card p-4 shadow-paper">
                <h3 className="text-sm font-bold text-encre">
                  Oficina de Extranjería
                </h3>
                <p className="mt-1 text-sm text-sepia">
                  {ciudad.extranjeria.nombre}
                </p>
                <p className="text-xs text-graphite">
                  {ciudad.extranjeria.direccion}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════ SECCIÓN 3: DOCUMENTOS FRECUENTES ═══════════════ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">
          Documentos que traducimos para clientes en {ciudad.nombre}
        </h2>

        {/* City-specific documents first */}
        {documentosCiudad.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-bleu">
              Los más solicitados en {ciudad.nombre}
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {documentosCiudad.map((doc) => (
                <div
                  key={doc}
                  className="flex items-start gap-2 rounded-doc border border-bleu/20 bg-bleu/5 p-3"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bleu" />
                  <span className="text-sm font-medium text-encre">{doc}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Generic documents */}
        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-graphite">
          Otros documentos habituales
        </h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {documentosGenericos.map((doc) => (
            <div
              key={doc}
              className="flex items-start gap-2 rounded-doc border border-cream bg-card p-3 shadow-paper"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bleu" />
              <span className="text-sm text-encre">{doc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 4: CÓMO FUNCIONA ═══════════════ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">
          Cómo funciona
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Sube tu documento",
              desc: `Foto o PDF desde ${ciudad.nombre}`,
            },
            {
              step: "2",
              title: "Recibe presupuesto en minutos",
              desc: "Precio exacto al instante",
            },
            {
              step: "3",
              title: "Recibe la traducción por email en 24-48h",
              desc: "Con validez oficial en toda España",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-doc border border-cream bg-card p-4 shadow-paper text-center"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bleu text-sm font-bold text-white">
                {item.step}
              </span>
              <h3 className="mt-3 font-semibold text-encre">{item.title}</h3>
              <p className="mt-1 text-sm text-sepia">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 text-center">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-lg bg-bleu px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bleu/90 transition-colors"
          >
            Empezar ahora
          </Link>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 5: TRUST SIGNALS ═══════════════ */}
      <section className="mt-10">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Traductor Jurado acreditado por el MAEC",
              desc: "Ministerio de Asuntos Exteriores, Unión Europea y Cooperación",
            },
            {
              title: "Número de acreditación N.3850",
              desc: "Registro oficial de Traductores-Intérpretes Jurados",
            },
            {
              title: "Validez oficial en toda España",
              desc: "Aceptada por el Registro Civil, universidades, juzgados y administración pública",
            },
            {
              title: "Más de 10 años de experiencia",
              desc: "Servicio profesional desde 2014",
            },
          ].map((badge) => (
            <div
              key={badge.title}
              className="flex items-start gap-3 rounded-doc border border-cream bg-card p-4 shadow-paper"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-or" />
              <div>
                <p className="text-sm font-semibold text-encre">
                  {badge.title}
                </p>
                <p className="mt-0.5 text-xs text-sepia">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 6: IDIOMAS DISPONIBLES ═══════════════ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">
          Idiomas disponibles
        </h2>
        <p className="mt-2 text-sm text-sepia">
          Ofrecemos traducción jurada online en {ciudad.nombre} en los siguientes idiomas:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.values(LANGUAGE_CONFIGS).map((lang: LanguageConfig) => (
            <Link
              key={lang.slug}
              href={`/traductor-jurado-${lang.slug}`}
              className="rounded-full border border-cream bg-card px-3 py-1.5 text-xs font-medium text-encre hover:border-bleu hover:text-bleu transition-colors"
            >
              {lang.name.charAt(0).toUpperCase() + lang.name.slice(1)}
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 7: PREGUNTAS FRECUENTES ═══════════════ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-encre">
          Preguntas frecuentes — traductor jurado en {ciudad.nombre}
        </h2>
        <div className="mt-4 space-y-3">
          {faq.map((qa) => (
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

      {/* Enlace al hub de ciudades (descubrimiento + autoridad interna) */}
      <p className="mt-10 text-sm text-sepia">
        ¿Estás en otra ciudad?{" "}
        <Link href="/traductor-jurado" className="font-semibold text-bleu hover:underline">
          Ver todas las ciudades donde damos traducción jurada
        </Link>
        .
      </p>
    </main>
  );
}
