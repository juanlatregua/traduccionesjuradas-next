// app/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SelloMinisterio } from "@/components/SelloMinisterio";

const HOME_FAQ_ITEMS = [
  {
    question: "¿Qué es una traducción jurada?",
    answer:
      "Una traducción jurada es una traducción realizada y firmada por un traductor jurado acreditado, que añade su sello y una declaración de veracidad. Tiene validez oficial ante administraciones, juzgados, notarías, universidades y otros organismos.",
  },
  {
    question: "¿Cuánto tarda una traducción jurada?",
    answer:
      "El plazo habitual para una traducción jurada sencilla es de 24 a 72 horas laborables. En el caso de documentos extensos o varios idiomas, el plazo se ajusta al volumen. Si tienes una cita o plazo concreto, puedes indicarlo al pedir presupuesto para valorar la urgencia.",
  },
  {
    question: "¿La traducción jurada se entrega en papel o en PDF?",
    answer:
      "Cada vez más organismos aceptan la traducción jurada en PDF firmado digitalmente. Nosotros solemos entregar en PDF firmado y, si lo necesitas, también podemos enviarte el original en papel por mensajería a tu dirección en España.",
  },
  {
    question: "¿Cuánto cuesta una traducción jurada?",
    answer:
      "El precio depende del tipo de documento, el idioma, la extensión y la urgencia. Trabajamos con tarifas ajustadas y te indicamos siempre un precio cerrado antes de empezar. Puedes consultar una tabla de precios orientativos en nuestra página de precios o pedir un presupuesto personalizado.",
  },
  {
    question: "¿Hacéis traducciones juradas urgentes?",
    answer:
      "En muchos casos podemos ofrecer traducción jurada urgente, dependiendo del volumen y del idioma. Si tienes una cita de extranjería, una firma notarial o un plazo universitario, indícalo al pedir presupuesto para revisar la disponibilidad del equipo.",
  },
];

const PriceEstimator = dynamic(() => import("@/components/PriceEstimator"), {
  ssr: false,
});

type LanguageQuickLink = {
  href: string;
  label: string;
  flag?: string;
  flagSrc?: string;
  flagAlt?: string;
};

const LANGUAGE_QUICK_LINKS: LanguageQuickLink[] = [
  { href: "/traductor-jurado-frances", flag: "\u{1F1EB}\u{1F1F7}", label: "Francés" },
  { href: "/traductor-jurado-ingles", flag: "\u{1F1EC}\u{1F1E7}", label: "Inglés" },
  { href: "/traductor-jurado-aleman", flag: "\u{1F1E9}\u{1F1EA}", label: "Alemán" },
  { href: "/traductor-jurado-neerlandes", flag: "\u{1F1F3}\u{1F1F1}", label: "Neerlandés" },
  { href: "/traductor-jurado-italiano", flag: "\u{1F1EE}\u{1F1F9}", label: "Italiano" },
  { href: "/traductor-jurado-portugues", flag: "\u{1F1F5}\u{1F1F9}", label: "Portugués" },
];

export const metadata: Metadata = {
  title: "Traducción jurada oficial en España | Traductores jurados online",
  description:
    "Traducciones juradas realizadas por traductores jurados oficiales. Envío online en PDF firmado digitalmente. Especialistas en documentos personales, académicos, laborales, jurídicos y mercantiles. Servicio para España y extranjeros (incluido Marruecos → España).",
  alternates: { canonical: "https://www.traduccionesjuradas.net" },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-parchment text-sepia">
      <SchemaFAQ items={HOME_FAQ_ITEMS} id="schema-faq-home" />
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-cream bg-parchment">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:py-14 lg:flex-row lg:items-center lg:py-20">
          <div className="flex-1 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-encre sm:text-4xl lg:text-5xl">
              Traducción jurada online:
              <span className="block text-bleu">sube tu documento y recíbela en 24 h</span>
            </h1>
            <p className="max-w-xl text-base text-sepia sm:text-lg">
              Así de fácil: elige idioma, adjunta PDF/foto, obtén estimación y confirma el pago.
              Traductores jurados reales y entrega en PDF firmado.
            </p>
            <div className="rounded-2xl border border-cream bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sepia">
                Elige idioma
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGE_QUICK_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl border border-cream bg-card px-3 py-3 text-left transition-colors hover:border-bleu hover:bg-cream/50"
                  >
                    {item.flagSrc ? (
                      <Image
                        src={item.flagSrc}
                        alt={item.flagAlt || `Bandera ${item.label}`}
                        width={34}
                        height={24}
                        className="h-6 w-[34px] rounded-sm border border-cream object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <p className="text-2xl leading-none" aria-hidden="true">{item.flag}</p>
                    )}
                    <p className="mt-2 text-sm font-semibold text-encre">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-graphite">Traducción jurada</p>
                  </Link>
                ))}
              </div>
              <Link
                href="/traductores-jurados"
                className="mt-2 inline-block text-xs font-semibold text-bleu hover:underline"
              >
                Ver todos los idiomas disponibles →
              </Link>
              <p className="mt-2 text-xs text-sepia">
                Si tu trámite es en francés, accede directamente al{" "}
                <Link
                  href="/traductor-jurado-frances"
                  className="font-semibold text-bleu hover:underline"
                >
                  servicio oficial de francés
                </Link>{" "}
                con información de precio, plazos y validez.
              </p>
            </div>

            {/* CTA principal */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="#calculadora-rapida"
                className="rounded-2xl bg-bleu text-parchment hover:bg-bleu-dark px-6 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu focus-visible:ring-offset-2"
              >
                Calcular precio ahora
              </Link>

              <Link
                href="/presupuesto"
                className="rounded-2xl border border-bleu px-4 py-2 text-sm font-medium text-bleu hover:bg-cream"
              >
                Enviar documentos para presupuesto
              </Link>

              <a
                href={WHATSAPP_LINK}
                className="text-sm font-medium text-[#25D366] hover:underline"
              >
                Consultar por WhatsApp
              </a>
            </div>

            {/* Mini confianza */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-graphite">
              <span>Precio orientativo en menos de 30 segundos</span>
              <span className="h-1 w-1 rounded-full bg-graphite/30" />
              <span>Pago online seguro y confirmación inmediata</span>
              <span className="h-1 w-1 rounded-full bg-graphite/30" />
              <span>Entrega habitual 24-72h</span>
              <span className="h-1 w-1 rounded-full bg-graphite/30" />
              <Link
                href="/traduccion-jurada-online"
                className="text-bleu font-semibold hover:underline"
              >
                Ver proceso completo
              </Link>
            </div>
          </div>

          {/* Box de proceso 3 pasos + Sello */}
          <div className="hidden flex-1 lg:block">
            <div className="flex justify-center mb-6">
              <SelloMinisterio size="lg" />
            </div>
            <div className="rounded-3xl border border-cream bg-bleu p-6 text-parchment shadow-paper lg:ml-8">
              <h2 className="mb-4 text-lg font-semibold">
                Tu traducción jurada en 3 pasos
              </h2>
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-or text-center text-xs font-bold leading-6 text-encre">
                    1
                  </span>
                  <div>
                    <p className="font-semibold">
                      Envíanos tus documentos para presupuesto
                    </p>
                    <p className="text-cream/80">
                      Adjunta una foto o escaneo por email o WhatsApp, o
                      utiliza el formulario de presupuesto. Te respondemos con
                      precio y plazo estimado.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-or text-center text-xs font-bold leading-6 text-encre">
                    2
                  </span>
                  <div>
                    <p className="font-semibold">Confirmas el encargo</p>
                    <p className="text-cream/80">
                      Aceptas el presupuesto, realizas el pago por los medios
                      indicados y asignamos tu traducción al traductor jurado
                      especialista en el idioma que corresponda.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-or text-center text-xs font-bold leading-6 text-encre">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">
                      Recibes la traducción jurada lista para usar
                    </p>
                    <p className="text-cream/80">
                      Te enviamos la traducción jurada en PDF firmado y sellado.
                      Si lo necesitas en papel, podemos enviarla por mensajería
                      a tu domicilio o despacho profesional.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="mt-6">
                <Link
                  href="/proceso"
                  className="text-xs font-medium text-or-light hover:underline"
                >
                  Ver el proceso completo →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULADORA RÁPIDA */}
      <section id="calculadora-rapida" className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-[2rem] border border-cream bg-cream p-5 shadow-paper sm:p-7">
          <div className="relative">
            <p className="inline-flex items-center rounded-full border border-bleu/20 bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-bleu">
              Calculadora rápida
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-encre sm:text-2xl">
              Precio orientativo en menos de 30 segundos
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-sepia">
              Elige combinación de idioma, documento y sube tu PDF. Para documentos con precio prefijado,
              el cálculo sale al instante.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-sepia">
              <span className="rounded-full border border-cream bg-card px-3 py-1">1. Idioma</span>
              <span className="rounded-full border border-cream bg-card px-3 py-1">2. Documento</span>
              <span className="rounded-full border border-cream bg-card px-3 py-1">3. PDF</span>
              <span className="rounded-full border border-cream bg-card px-3 py-1">4. Precio</span>
            </div>
            <PriceEstimator />
          </div>
        </div>
      </section>

      {/* ATAJOS MÓVIL */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:hidden">
        <div className="rounded-2xl border border-cream bg-card p-4 shadow-paper">
          <h2 className="text-base font-semibold text-encre">¿Qué necesitas hacer ahora?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Link
              href="/traductores-jurados"
              className="rounded-xl border border-cream bg-cream px-3 py-2 font-medium text-sepia"
            >
              Ver idiomas
            </Link>
            <Link
              href="/documentos-oficiales"
              className="rounded-xl border border-cream bg-cream px-3 py-2 font-medium text-sepia"
            >
              Ver documentos
            </Link>
            <Link
              href="/presupuesto"
              className="rounded-xl border border-cream bg-cream px-3 py-2 font-medium text-sepia"
            >
              Solicitar presupuesto
            </Link>
            <Link
              href="/consulta"
              className="rounded-xl border border-cream bg-cream px-3 py-2 font-medium text-sepia"
            >
              Estado pedido
            </Link>
          </div>
        </div>
      </section>

      {/* TARIFAS ORIENTATIVAS */}
      <section className="mx-auto hidden max-w-6xl px-4 py-10 sm:block">
        <div className="rounded-2xl border border-cream bg-card p-6 shadow-paper">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Tarifas de traducción jurada
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-sepia">
            Nuestros precios dependen del idioma, el tipo de documento, su extensión y la urgencia.
            Te confirmamos un <strong>precio cerrado</strong> al ver tus documentos.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-cream px-4 py-2 text-lg font-bold text-bleu">
              Desde 0,08 €<span className="text-sm font-normal text-graphite">/palabra</span>
            </span>
            <span className="text-sm text-graphite">·</span>
            <span className="text-sm text-sepia">Certificados sencillos desde 42 €</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-graphite">
            <span>IVA incluido</span>
            <span className="h-1 w-1 rounded-full bg-graphite/30" />
            <span>Urgencia +25 %</span>
            <span className="h-1 w-1 rounded-full bg-graphite/30" />
            <span>Consulta el precio exacto en cada idioma</span>
            <span className="h-1 w-1 rounded-full bg-graphite/30" />
            <Link href="/precios-traduccion-jurada" className="font-semibold text-bleu hover:underline">
              Ver más sobre precios →
            </Link>
          </div>
        </div>
      </section>

      {/* BLOQUE PRINCIPALES DOCUMENTOS — "El Archivo" */}
      <section className="mx-auto hidden max-w-6xl px-4 py-12 sm:block">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Principales documentos que traducimos
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-sepia">
          A diario gestionamos traducciones juradas de documentos personales,
          académicos y profesionales para trámites de extranjería, estudios,
          oposiciones, nacionalidad, herencias y otros procedimientos en España
          y fuera de España.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Certificados del Registro Civil",
              desc: "Nacimiento, matrimonio, divorcio, defunción, fe de vida, etc.",
              href: "/documentos-oficiales/certificados-registro-civil",
              accent: "border-l-bleu",
            },
            {
              title: "Documentos de identidad y pasaportes",
              desc: "DNI, NIE, pasaporte, libro de familia u otros documentos equivalentes.",
              href: "/documentos-oficiales/certificados-registro-civil",
              accent: "border-l-bleu",
            },
            {
              title: "Títulos y expedientes académicos",
              desc: "Títulos universitarios, certificados de notas, diplomas y programas de estudios.",
              href: "/documentos-oficiales/documentos-academicos",
              accent: "border-l-or",
            },
            {
              title: "Contratos y documentos legales",
              desc: "Contratos de trabajo, alquiler, compraventa, escrituras notariales.",
              href: "/documentos-oficiales/documentos-juridicos",
              accent: "border-l-rouge",
            },
            {
              title: "Documentos financieros y comerciales",
              desc: "Cuentas anuales, balances, escrituras societarias, poderes mercantiles.",
              href: "/documentos-oficiales/documentos-mercantiles",
              accent: "border-l-vert",
            },
            {
              title: "Apostillas y legalizaciones",
              desc: "Traducción de Apostilla de la Haya y otros sellos de legalización.",
              href: "/documentos-oficiales/apostilla-haya",
              accent: "border-l-or",
            },
          ].map((item) => (
            <div
              key={item.title}
              className={`flex flex-col justify-between rounded-doc border border-cream ${item.accent} border-l-4 bg-card p-4 text-sm shadow-paper transition hover:-translate-y-[3px] hover:shadow-paper-hover`}
            >
              <div>
                <h3 className="text-base font-semibold text-encre">
                  {item.title}
                </h3>
                <p className="mt-1 text-sepia">{item.desc}</p>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-xs">
                <Link
                  href={item.href}
                  className="font-semibold text-encre underline-offset-2 hover:underline"
                >
                  Ver más sobre {item.title} →
                </Link>
                <Link
                  href="/presupuesto"
                  className="inline-flex w-fit items-center gap-1 rounded-lg bg-bleu px-3 py-2 font-semibold text-parchment shadow-sm hover:bg-bleu-dark"
                >
                  Pedir presupuesto para {item.title.toLowerCase()} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BLOQUE IDIOMAS PRINCIPALES — "Los Especialistas" */}
      <section className="mx-auto hidden max-w-6xl px-4 pb-4 sm:block">
        <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Traducciones juradas por idioma
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-sepia">
          Contamos con traductores jurados de{" "}
          <strong>francés, alemán, inglés</strong> y otros idiomas europeos
          para que puedas presentar tus documentos en España y en el extranjero
          con todas las garantías.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {/* FRANCÉS */}
          <Link
            href="/traductor-jurado-frances"
            className="rounded-doc border border-cream border-l-4 border-l-bleu bg-card p-4 text-sm shadow-paper transition hover:border-bleu hover:shadow-paper-hover"
          >
            <h3 className="text-base font-semibold text-encre">
              Traductor jurado de francés
            </h3>
            <p className="mt-1 text-sepia">
              Documentos de Francia, Bélgica, Suiza, Canadá y países francófonos
              para trámites en España.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-bleu">
              Ver traducciones juradas de francés →
            </span>
          </Link>

          {/* ALEMÁN */}
          <Link
            href="/traductor-jurado-aleman"
            className="rounded-doc border border-cream border-l-4 border-l-encre bg-card p-4 text-sm shadow-paper transition hover:border-bleu hover:shadow-paper-hover"
          >
            <h3 className="text-base font-semibold text-encre">
              Traductor jurado de alemán
            </h3>
            <p className="mt-1 text-sepia">
              Documentos de Alemania, Austria y Suiza para empleo, estudios,
              residencia o herencias.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-bleu">
              Ver traducciones juradas de alemán →
            </span>
          </Link>

          {/* INGLÉS */}
          <Link
            href="/traductor-jurado-ingles"
            className="rounded-doc border border-cream border-l-4 border-l-rouge bg-card p-4 text-sm shadow-paper transition hover:border-bleu hover:shadow-paper-hover"
          >
            <h3 className="text-base font-semibold text-encre">
              Traductor jurado de inglés
            </h3>
            <p className="mt-1 text-sepia">
              Documentos de Reino Unido, Irlanda, EE. UU., Canadá y otros países de
              habla inglesa.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-bleu">
              Ver traducciones juradas de inglés →
            </span>
          </Link>
        </div>

        {/* Mención al resto de idiomas */}
        <p className="mt-4 text-xs text-graphite">
          También gestionamos traducciones juradas de{" "}
          <Link href="/traductor-jurado-italiano" className="text-bleu underline">
            italiano
          </Link>
          ,{" "}
          <Link href="/traductor-jurado-portugues" className="text-bleu underline">
            portugués
          </Link>
          ,{" "}
          <Link href="/traductor-jurado-neerlandes" className="text-bleu underline">
            neerlandés
          </Link>
          ,{" "}
          <Link href="/traductor-jurado-sueco" className="text-bleu underline">
            sueco
          </Link>{" "}
          y{" "}
          <Link href="/traductor-jurado-noruego" className="text-bleu underline">
            noruego
          </Link>
          .
        </p>
      </section>

      {/* BLOQUE CONFIANZA — Sección oscura */}
      <section className="mx-auto hidden max-w-6xl px-4 py-12 sm:block">
        <div className="rounded-3xl bg-bleu p-6 text-parchment sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Por qué confiar en traduccionesjuradas.net
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <p className="text-xl font-bold text-or leading-tight">Ministerio de Asuntos Exteriores</p>
              <p className="mt-1 text-sm font-semibold text-parchment">Nombrados por el Ministerio</p>
              <p className="mt-1 text-xs text-cream/70">
                Traductores jurados acreditados por el Ministerio de Asuntos Exteriores de España. No intermediarios.
              </p>
            </div>
            <div className="text-center">
              <SelloMinisterio size="sm" className="mx-auto mb-2" />
              <p className="text-3xl font-bold text-or">N.3850</p>
              <p className="mt-1 text-sm font-semibold text-parchment">Traductor jurado de francés</p>
              <p className="mt-1 text-xs text-cream/70">
                Juan Silva Moreno, traductor jurado de francés nombrado por el Ministerio de Asuntos Exteriores con número 3850.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-or">PDF</p>
              <p className="mt-1 text-sm font-semibold text-parchment">Firma digital oficial</p>
              <p className="mt-1 text-xs text-cream/70">
                Entrega habitual en PDF firmado digitalmente, aceptado por administraciones y universidades.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-or">24-72h</p>
              <p className="mt-1 text-sm font-semibold text-parchment">Entrega rápida</p>
              <p className="mt-1 text-xs text-cream/70">
                Certificados sencillos en 24-48h. Documentos extensos en 2-5 días. Urgencias disponibles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE RESEÑAS GOOGLE */}
      <section className="mx-auto hidden max-w-6xl px-4 py-12 sm:block">
        <div className="rounded-3xl border border-cream bg-cream p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <p className="text-3xl font-bold text-or">5,0 ★★★★★</p>
            <p className="mt-1 text-sm font-semibold text-encre">en Google · 19 reseñas</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                author: "Lucía Garzón",
                text: "Todo el trámite ha sido muy rápido y sencillo. En menos de una semana ya tenía los documentos traducidos.",
                date: "mayo 2024",
              },
              {
                author: "Pedro Vicente",
                text: "Necesitábamos con urgencia una traducción jurada y el servicio fue fantástico. Muy profesionales y rápidos.",
                date: "abril 2024",
              },
              {
                author: "Ángela Negrón",
                text: "He solicitado la traducción de certificados oficiales y la respuesta ha sido rápida y muy profesional.",
                date: "mayo 2023",
              },
              {
                author: "Pabola Pabola",
                text: "Mi hijo se va a estudiar a EEUU y necesitaba la traducción de muchos papeles. El trabajo estaba perfecto.",
                date: "julio 2022",
              },
              {
                author: "Glenn Angell",
                text: "Sofia delivered exceptional document translations. She was very responsive and professional throughout the process.",
                date: "julio 2024",
              },
              {
                author: "Serg Martin",
                text: "Muy buen trabajo con mi traducción. Y muy rápido también.",
                date: "febrero 2026",
              },
            ].map((review) => (
              <div
                key={review.author}
                className="rounded-doc border border-cream bg-card p-4 text-sm shadow-paper"
              >
                <p className="text-sepia">
                  <span className="text-or">&ldquo;</span>
                  {review.text}
                  <span className="text-or">&rdquo;</span>
                </p>
                <p className="mt-3 text-xs font-semibold text-encre">{review.author}</p>
                <p className="text-[11px] text-graphite">{review.date}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <a
              href="https://www.google.com/maps/search/HBTJ+Consultores+Ling%C3%BC%C3%ADsticos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-bleu hover:underline"
            >
              Ver todas las reseñas en Google →
            </a>
          </div>
        </div>
      </section>

      {/* BLOQUE ESPECIAL TELETRABAJO MARRUECOS */}
      <section className="hidden border-y border-cream bg-cream sm:block">
        <div className="mx-auto max-w-6xl px-4 py-10 lg:py-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                ¿Eres de Marruecos y quieres teletrabajar en España?
              </h2>
              <p className="mt-2 text-sm text-sepia">
                Si necesitas preparar un expediente de{" "}
                <strong>teletrabajo o residencia en España</strong> con
                documentos marroquíes (salarios, CNSS, Registro Mercantil,
                antecedentes penales, EM 30, certificados de nacimiento y
                matrimonio, etc.), hemos creado una guía específica donde
                explicamos el paquete de documentos más habitual y qué debe
                traducirse.
              </p>
              <p className="mt-2 text-sm text-sepia">
                Trabajamos cada día con <strong>clientes de Marruecos</strong>{" "}
                y con <strong>empresas que desplazan trabajadores</strong> para
                que sus traducciones juradas cumplan los requisitos de extranjería
                y consulados españoles.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/teletrabajo"
                  className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-parchment hover:bg-bleu-dark"
                >
                  Ver guía de documentos para teletrabajo Marruecos → España
                </Link>
                <a
                  href={WHATSAPP_LINK}
                  className="rounded-2xl border border-cream px-4 py-2 text-xs font-medium text-encre hover:bg-parchment"
                >
                  Consultar mi caso por WhatsApp
                </a>
              </div>
            </div>
            <div className="space-y-3 rounded-doc bg-card p-4 text-sm shadow-paper">
              <h3 className="text-sm font-semibold text-encre">
                ¿Qué suele incluir el paquete de documentos?
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sepia">
                <li>Certificados de nacimiento y matrimonio con apostilla.</li>
                <li>Certificado de antecedentes penales (Bulletin n°3).</li>
                <li>Contrato de trabajo y autorización de teletrabajo.</li>
                <li>Tres últimas nóminas y attestations de salaires.</li>
                <li>Registro Mercantil, estatutos y poderes de la empresa.</li>
                <li>Formularios consulares como el EM 30.</li>
              </ul>
              <p className="mt-2 text-xs text-sepia">
                En la guía de{" "}
                <Link
                  href="/teletrabajo"
                  className="text-bleu underline"
                >
                  teletrabajo Marruecos → España
                </Link>{" "}
                encontrarás el detalle completo y ejemplos de cada tipo de
                documento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE APOSTILLA / FIRMA DIGITAL */}
      <section className="hidden border-b border-cream bg-cream sm:block">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                Apostilla de la Haya y firma digital
              </h2>
              <p className="mt-2 text-sm text-sepia">
                Te ayudamos a que tus documentos con Apostilla de la Haya y
                otras legalizaciones sean válidos en el país de destino gracias
                a una traducción jurada precisa y fiel al original.
              </p>
              <p className="mt-2 text-sm text-sepia">
                Nuestras traducciones juradas se entregan habitualmente en{" "}
                <strong>formato PDF firmado digitalmente</strong>, cada vez más
                aceptado por las Administraciones Públicas, colegios oficiales y
                universidades, tanto en España como en otros países.
              </p>
              <p className="mt-2 text-xs text-sepia">
                Si tienes dudas sobre si tu documento necesita apostilla antes
                de traducirlo, puedes consultar nuestra página sobre{" "}
                <Link
                  href="/documentos-oficiales/apostilla-haya"
                  className="text-bleu underline"
                >
                  Apostilla de la Haya
                </Link>{" "}
                o preguntarnos directamente.
              </p>
            </div>
            <div className="space-y-3 rounded-doc bg-card p-4 text-sm shadow-paper">
              <h3 className="text-sm font-semibold text-encre">
                ¿Tienes dudas sobre apostilla o requisitos en el país de
                destino?
              </h3>
              <p className="text-sepia">
                Cada consulado, universidad o administración puede exigir
                requisitos distintos. Lo más seguro es consultar directamente
                con el organismo donde vas a presentar la documentación. Si lo
                necesitas, puedes contarnos tu caso y te orientamos.
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <a
                  href={WHATSAPP_LINK}
                  className="rounded-2xl border border-cream px-3 py-2 font-medium text-sepia hover:bg-parchment"
                >
                  Preguntar por WhatsApp
                </a>
                <a
                  href={MAIL_LINK}
                  className="font-medium text-bleu hover:underline"
                >
                  Enviar una consulta por email
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CHECKLIST DESTACADA */}
      <section className="mx-auto hidden max-w-6xl px-4 pb-12 sm:block">
        <DocumentChecklist slug="certificados-registro-civil" />
      </section>

      {/* BLOQUE CONTACTO RÁPIDO */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-3xl bg-encre px-6 py-8 text-parchment shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                ¿Necesitas una traducción jurada urgente?
              </h2>
              <p className="mt-2 text-sm text-cream/80">
                Envíanos el documento y te responderemos con un presupuesto y
                plazo aproximado lo antes posible. Trabajamos con traductores
                jurados de francés, alemán, inglés, neerlandés, italiano,
                portugués, catalán, sueco y noruego.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <a
                href={WHATSAPP_LINK}
                className="rounded-2xl bg-[#25D366] px-4 py-2 text-center font-semibold text-white hover:bg-[#20BD5A]"
              >
                Escribir por WhatsApp
              </a>
              <a
              href={MAIL_LINK}
                className="rounded-2xl border border-cream text-parchment hover:bg-encre/80 px-6 py-3 text-sm font-semibold shadow-lg"
              >
                Pedir presupuesto por email
              </a>

              <p className="text-center text-[11px] text-cream/60">
                Damos prioridad a las consultas por email y WhatsApp para poder
                revisar tus documentos con calma y ofrecerte un presupuesto
                ajustado.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
