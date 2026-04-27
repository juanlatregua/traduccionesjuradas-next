// app/page.tsx — Home 2.0
import Link from "next/link";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { WHATSAPP_LINK } from "@/lib/contact";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";

const PresupuestoInstantaneoClient = dynamic(
  () => import("@/app/presupuesto-instantaneo/PresupuestoInstantaneoClient"),
  { ssr: false }
);

const HOME_FAQ_ITEMS = [
  {
    question: "¿Qué es una traducción jurada?",
    answer:
      "Una traducción jurada es una traducción realizada y firmada por un traductor jurado acreditado, que añade su sello y una declaración de veracidad. Tiene validez oficial ante administraciones, juzgados, notarías, universidades y otros organismos.",
  },
  {
    question: "¿Cuánto tarda una traducción jurada?",
    answer:
      "El plazo habitual para una traducción jurada sencilla es de 24 a 72 horas laborables. En el caso de documentos extensos o varios idiomas, el plazo se ajusta al volumen.",
  },
  {
    question: "¿La traducción jurada se entrega en papel o en PDF?",
    answer:
      "Cada vez más organismos aceptan la traducción jurada en PDF firmado digitalmente. Nosotros solemos entregar en PDF firmado y, si lo necesitas, también podemos enviarte el original en papel por mensajería.",
  },
  {
    question: "¿Cuánto cuesta una traducción jurada?",
    answer:
      "El precio depende del tipo de documento, el idioma, la extensión y la urgencia. Trabajamos con tarifas ajustadas y te indicamos siempre un precio cerrado antes de empezar.",
  },
  {
    question: "¿Hacéis traducciones juradas urgentes?",
    answer:
      "En muchos casos podemos ofrecer traducción jurada urgente, dependiendo del volumen y del idioma. Indícalo al pedir presupuesto para revisar la disponibilidad.",
  },
];

const IDIOMAS = [
  { href: "/traductor-jurado-frances", label: "Francés", flag: "\u{1F1EB}\u{1F1F7}" },
  { href: "/traductor-jurado-ingles", label: "Inglés", flag: "\u{1F1EC}\u{1F1E7}" },
  { href: "/traductor-jurado-aleman", label: "Alemán", flag: "\u{1F1E9}\u{1F1EA}" },
  { href: "/traductor-jurado-neerlandes", label: "Neerlandés", flag: "\u{1F1F3}\u{1F1F1}" },
  { href: "/traductor-jurado-italiano", label: "Italiano", flag: "\u{1F1EE}\u{1F1F9}" },
  { href: "/traductor-jurado-portugues", label: "Portugués", flag: "\u{1F1F5}\u{1F1F9}" },
  { href: "/traductor-jurado-rumano", label: "Rumano", flag: "\u{1F1F7}\u{1F1F4}", isNew: true },
  { href: "/traductor-jurado-catalan", label: "Catalán", flag: "\u{1F3F4}" },
  { href: "/traductor-jurado-sueco", label: "Sueco", flag: "\u{1F1F8}\u{1F1EA}" },
  { href: "/traductor-jurado-noruego", label: "Noruego", flag: "\u{1F1F3}\u{1F1F4}" },
];

const DOCUMENTOS = [
  { href: "/documentos-oficiales/certificados-registro-civil", label: "Registro Civil" },
  { href: "/documentos-oficiales/antecedentes-penales", label: "Antecedentes penales" },
  { href: "/documentos-oficiales/documentos-academicos", label: "Títulos académicos" },
  { href: "/documentos-oficiales/documentos-laborales", label: "Documentos laborales" },
  { href: "/documentos-oficiales/documentos-juridicos", label: "Documentos notariales" },
  { href: "/documentos-oficiales/apostilla-haya", label: "Apostilla de la Haya" },
  { href: "/documentos-oficiales/documentos-mercantiles", label: "Empresariales" },
];

const CIUDADES_TOP = [
  { slug: "madrid", label: "Madrid" },
  { slug: "barcelona", label: "Barcelona" },
  { slug: "valencia", label: "Valencia" },
  { slug: "sevilla", label: "Sevilla" },
  { slug: "malaga", label: "Málaga" },
  { slug: "bilbao", label: "Bilbao" },
  { slug: "zaragoza", label: "Zaragoza" },
  { slug: "murcia", label: "Murcia" },
  { slug: "palma", label: "Palma" },
  { slug: "las-palmas", label: "Las Palmas" },
  { slug: "alicante", label: "Alicante" },
  { slug: "granada", label: "Granada" },
  { slug: "marbella", label: "Marbella" },
  { slug: "vigo", label: "Vigo" },
  { slug: "santander", label: "Santander" },
];

const REVIEWS = [
  {
    author: "Lucía G.",
    text: "Todo el trámite fue muy rápido y sencillo. En menos de una semana ya tenía los documentos traducidos y certificados.",
    date: "mayo 2024",
  },
  {
    author: "Pedro V.",
    text: "Necesitábamos con urgencia una traducción jurada del francés y el servicio fue fantástico. Muy profesionales.",
    date: "abril 2024",
  },
  {
    author: "Paula P.",
    text: "Mi hijo se iba a EEUU y necesitaba traducir muchos papeles. Perfecto y a muy buen precio.",
    date: "julio 2022",
  },
];

export const metadata: Metadata = {
  title: "Traductor Jurado Oficial MAEC n\u00BA 3850 \u00B7 Franc\u00E9s, Ingl\u00E9s, Alem\u00E1n \u00B7 Desde 35\u20AC",
  description:
    "Traducciones juradas online por traductor jurado oficial MAEC. Franc\u00E9s, ingl\u00E9s, alem\u00E1n y 7 idiomas m\u00E1s. Presupuesto gratis en minutos, entrega en 24h. Desde 35\u20AC.",
  alternates: { canonical: "https://www.traduccionesjuradas.net" },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="breadcrumbs-home"
        items={[{ name: "Inicio", url: "https://www.traduccionesjuradas.net/" }]}
      />
      <SchemaFAQ items={HOME_FAQ_ITEMS} id="schema-faq-home" />

      {/* ═══════════════ SECCIÓN 1: HERO + UPLOAD ═══════════════ */}
      <section id="hero" className="border-b border-cream bg-parchment">
        <div className="mx-auto max-w-5xl px-4 pt-10 pb-8 text-center sm:pt-14">
          {/* Eyebrow */}
          <span className="inline-flex items-center gap-2 rounded-full bg-or px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Traductor jurado N.3850 · MAEC
          </span>

          {/* H1 */}
          <h1 className="mx-auto mt-5 max-w-2xl font-baskerville text-3xl font-bold tracking-tight text-encre sm:text-4xl lg:text-[42px] lg:leading-tight">
            Tu traducción jurada oficial{" "}
            <em className="text-or not-italic">en 60 segundos</em>
          </h1>

          {/* Subtítulo */}
          <p className="mx-auto mt-4 max-w-md text-base text-sepia sm:text-lg">
            Sube tu documento, recibe precio cerrado al instante y paga online.
            Sin esperas, sin intermediarios.
          </p>

          {/* Flujo completo IA */}
          <div className="mx-auto mt-10 max-w-xl">
            <PresupuestoInstantaneoClient />
          </div>

          {/* WhatsApp alternativo */}
          <p className="mt-4 text-xs text-graphite">
            ¿Prefieres que te ayudemos?{" "}
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#25D366] hover:underline"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Escríbenos por WhatsApp
            </a>
          </p>

          {/* Badges de confianza */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-graphite">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-or" />
              N.3850 MAEC
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-vert" />
              Precio cerrado
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-bleu" />
              Entrega 24-72h
            </span>
            <span className="flex items-center gap-1">
              <span className="text-or">★</span>
              5.0 Google · 19 reseñas
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 2: RESEÑAS GOOGLE ═══════════════ */}
      <section className="bg-cream py-14">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-or">★★★★★</p>
            <p className="mt-1 text-sm font-semibold text-encre">
              5,0 en Google · 19 reseñas
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {REVIEWS.map((r) => (
              <div
                key={r.author}
                className="rounded-doc border-t-[3px] border-t-or bg-card p-5 text-left shadow-paper"
              >
                <p className="text-sm text-sepia">
                  <span className="text-or">&ldquo;</span>
                  {r.text}
                  <span className="text-or">&rdquo;</span>
                </p>
                <p className="mt-3 text-xs font-semibold text-encre">
                  {r.author}
                </p>
                <p className="text-[11px] text-graphite">{r.date}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <a
              href="https://www.google.com/maps/search/HBTJ+Consultores+Ling%C3%BC%C3%ADsticos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-bleu hover:underline"
            >
              Ver todas las reseñas en Google →
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 3: CÓMO FUNCIONA ═══════════════ */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            Así de fácil
          </h2>

          <div className="relative mt-10 grid gap-8 sm:grid-cols-3">
            {/* Línea conectora (desktop) */}
            <div className="absolute top-8 left-[16.67%] right-[16.67%] hidden h-0.5 bg-cream sm:block">
              <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-cream to-or/30" />
              <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-r from-or/30 to-cream" />
            </div>

            {[
              {
                step: "1",
                color: "bg-bleu",
                title: "Sube tu documento",
                desc: "Arrastra un PDF, haz una foto con el móvil o selecciona el archivo.",
              },
              {
                step: "2",
                color: "bg-or",
                title: "Precio cerrado al instante",
                desc: "Analizamos tu documento automáticamente: idioma, tipo y extensión.",
              },
              {
                step: "3",
                color: "bg-vert",
                title: "Recibe tu traducción",
                desc: "PDF firmado digitalmente por traductor jurado oficial. Válido para cualquier trámite.",
              },
            ].map((s) => (
              <div key={s.step} className="relative text-center">
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${s.color} text-xl font-bold ${s.color === "bg-or" ? "text-encre" : "text-white"} shadow-md`}
                >
                  {s.step}
                </div>
                <h3 className="mt-4 font-baskerville text-lg font-bold text-encre">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-sepia">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 4: IDIOMAS + DOCUMENTOS ═══════════════ */}
      <section className="bg-cream py-14">
        <div className="mx-auto max-w-5xl px-4">
          {/* Idiomas */}
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            Traducción jurada en 10 idiomas
          </h2>
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-3">
            {IDIOMAS.map((lang) => (
              <Link
                key={lang.href}
                href={lang.href}
                className="group flex items-center gap-2 rounded-full border border-or bg-or-light/60 px-4 py-2 text-sm font-medium text-or-dark shadow-sm transition hover:bg-or-light hover:border-or-dark hover:shadow-paper"
              >
                <span className="text-base" aria-hidden="true">{lang.flag}</span>
                {lang.label}
                {lang.isNew && (
                  <span className="rounded bg-or px-1.5 py-0.5 text-[9px] font-bold text-encre">
                    NUEVO
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Separador dorado */}
          <div className="mx-auto my-10 h-0.5 w-10 rounded bg-or" />

          {/* Documentos */}
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            Documentos más traducidos
          </h2>
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-3">
            {DOCUMENTOS.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="rounded-full border border-or bg-or-light/60 px-4 py-2 text-sm font-medium text-or-dark shadow-sm transition hover:bg-or-light hover:border-or-dark hover:shadow-paper"
              >
                {doc.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 4B: COBERTURA NACIONAL ═══════════════ */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            Servicio en toda España
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-sepia">
            Trabajamos online con clientes de cualquier ciudad. Información local
            sobre Registro Civil, Extranjería y consulados:
          </p>
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2">
            {CIUDADES_TOP.map((c) => (
              <Link
                key={c.slug}
                href={`/traductor-jurado/${c.slug}`}
                className="rounded-full border border-cream bg-card px-3 py-1.5 text-xs font-medium text-encre shadow-sm transition hover:border-bleu hover:text-bleu hover:shadow-paper"
              >
                Traductor jurado en {c.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 5: NICHO MARRUECOS ═══════════════ */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-xl border border-cream bg-card p-6 shadow-paper sm:p-8">
            <div className="flex items-start gap-5">
              {/* Icono con gradiente marroquí */}
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C1272D] to-[#006233] shadow-md sm:flex">
                <span className="text-2xl text-white">🇲🇦</span>
              </div>
              <div className="flex-1">
                <h3 className="font-baskerville text-xl font-bold text-encre">
                  Traducciones juradas del árabe y francés marroquí
                </h3>
                <p className="mt-2 text-sm text-sepia">
                  Actas de nacimiento, antecedentes penales, certificados de
                  matrimonio y documentos del Registro Civil marroquí. Más de 500
                  documentos traducidos.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                  <Link href="/marruecos" className="text-bleu hover:underline">
                    Documentos marroquíes →
                  </Link>
                  <Link
                    href="/blog/documentos-marroquies-guia-completa"
                    className="text-bleu hover:underline"
                  >
                    Guía completa 2026 →
                  </Link>
                  <Link
                    href="/traductor-jurado-frances"
                    className="text-bleu hover:underline"
                  >
                    Francés-español →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 5B: GUÍAS Y RECURSOS ═══════════════ */}
      <section className="bg-parchment py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            Guías y recursos
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-sepia">
            Artículos prácticos sobre traducción jurada, trámites y documentación oficial en España.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                href: "/blog/documentos-marroquies-guia-completa",
                title: "Documentos marroquíes: guía completa",
                desc: "Qué documentos necesitas traducir de Marruecos y cómo preparar tu expediente.",
              },
              {
                href: "/blog/diferencia-traduccion-jurada-oficial-simple",
                title: "Traducción jurada vs. traducción simple",
                desc: "Cuándo necesitas una traducción jurada y cuándo basta con una traducción simple.",
              },
              {
                href: "/blog/traduccion-jurada-antecedentes-penales",
                title: "Traducción jurada de antecedentes penales",
                desc: "Todo sobre la traducción del certificado de antecedentes penales y el casier judiciaire.",
              },
              {
                href: "/blog/apostilla-haya-que-es",
                title: "¿Qué es la Apostilla de La Haya?",
                desc: "Qué es, cuándo se exige y cómo se combina con la traducción jurada.",
              },
            ].map((post) => (
              <Link
                key={post.href}
                href={post.href}
                className="group rounded-xl border border-cream bg-card p-5 shadow-paper transition hover:border-bleu hover:shadow-md"
              >
                <h3 className="font-semibold text-encre group-hover:text-bleu transition-colors">
                  {post.title}
                </h3>
                <p className="mt-1 text-sm text-sepia">{post.desc}</p>
                <span className="mt-2 inline-block text-xs font-semibold text-bleu">
                  Leer más →
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/blog"
              className="text-sm font-semibold text-bleu hover:underline"
            >
              Ver todos los artículos →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ SECCIÓN 6: CTA FINAL ═══════════════ */}
      <section className="bg-cream py-14">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="font-baskerville text-2xl font-bold text-encre sm:text-3xl">
            ¿Tienes dudas sobre tu documento?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-sepia">
            Escríbenos y te orientamos sin compromiso sobre tu trámite.{" "}
            <Link
              href="/traductores-jurados"
              className="text-bleu hover:underline"
            >
              Conoce a nuestro equipo
            </Link>.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#20BD5A]"
            >
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Escribir por WhatsApp
            </a>
            <a
              href="#hero"
              className="text-sm font-medium text-bleu hover:underline"
            >
              O sube tu documento directamente ↑
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
