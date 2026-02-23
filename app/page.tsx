// app/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { DocumentChecklist } from "@/components/DocumentChecklist";

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
  {
    href: "/traductor-jurado-catalan",
    flagSrc: "/flags/catalan.svg",
    flagAlt: "Bandera de Cataluña",
    label: "Catalán",
  },
  { href: "/traductor-jurado-sueco", flag: "\u{1F1F8}\u{1F1EA}", label: "Sueco" },
  { href: "/traductor-jurado-noruego", flag: "\u{1F1F3}\u{1F1F4}", label: "Noruego" },
];

export const metadata: Metadata = {
  title: "Traducción jurada oficial en España | Traductores jurados online",
  description:
    "Traducciones juradas realizadas por traductores jurados oficiales. Envío online en PDF firmado digitalmente. Especialistas en documentos personales, académicos, laborales, jurídicos y mercantiles. Servicio para España y extranjeros (incluido Marruecos → España).",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:py-14 lg:flex-row lg:items-center lg:py-20">
          <div className="flex-1 space-y-6">
            <p className="inline rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Traducción jurada oficial · Rápido y online
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Sube tu documento,
              <span className="block text-blue-700">calcula precio y paga en minutos.</span>
            </h1>
            <p className="max-w-xl text-base text-slate-600 sm:text-lg">
              Flujo simple para cliente: elige idioma, adjunta PDF/foto, obtén estimación y confirma el pago.
              Traductores jurados reales y entrega en PDF firmado.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Elige traductor jurado por idioma (empieza por francés)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGE_QUICK_LINKS.map((item, idx) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl border px-3 py-3 text-left ${
                      idx === 0
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {item.flagSrc ? (
                      <Image
                        src={item.flagSrc}
                        alt={item.flagAlt || `Bandera ${item.label}`}
                        width={34}
                        height={24}
                        className="h-6 w-[34px] rounded-sm border border-slate-200 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <p className="text-2xl leading-none" aria-hidden="true">{item.flag}</p>
                    )}
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500">Traducción jurada</p>
                  </Link>
                ))}
              </div>
              <Link
                href="/traductores-jurados"
                className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
              >
                Ver todos los idiomas disponibles →
              </Link>
            </div>

            {/* CTA principal */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="#calculadora-rapida"
                className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                style={{
                  background:
                    "linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 50%, #22c55e 100%)",
                  color: "white",
                }}
              >
                Calcular precio ahora
              </Link>

              <Link
                href="/presupuesto"
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Enviar documentos para presupuesto
              </Link>

              <a
                href={WHATSAPP_LINK}
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Consultar por WhatsApp
              </a>
            </div>

            {/* Mini confianza */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>Precio orientativo en menos de 30 segundos</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Pago online seguro y confirmación inmediata</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Entrega habitual 24-72h</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <Link
                href="/traduccion-jurada-online"
                className="text-emerald-700 font-semibold hover:underline"
              >
                Ver proceso completo
              </Link>
            </div>
          </div>

          {/* Box de proceso 3 pasos */}
          <div className="hidden flex-1 lg:block">
            <div className="rounded-3xl border border-slate-200 bg-slate-900/95 p-6 text-slate-100 shadow-xl lg:ml-8">
              <h2 className="mb-4 text-lg font-semibold">
                Tu traducción jurada en 3 pasos
              </h2>
              <ol className="space-y-4 text-sm">
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-blue-500 text-center text-xs font-bold leading-6">
                    1
                  </span>
                  <div>
                    <p className="font-semibold">
                      Envíanos tus documentos para presupuesto
                    </p>
                    <p className="text-slate-300">
                      Adjunta una foto o escaneo por email o WhatsApp, o
                      utiliza el formulario de presupuesto. Te respondemos con
                      precio y plazo estimado.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-blue-500 text-center text-xs font-bold leading-6">
                    2
                  </span>
                  <div>
                    <p className="font-semibold">Confirmas el encargo</p>
                    <p className="text-slate-300">
                      Aceptas el presupuesto, realizas el pago por los medios
                      indicados y asignamos tu traducción al traductor jurado
                      especialista en el idioma que corresponda.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-blue-500 text-center text-xs font-bold leading-6">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">
                      Recibes la traducción jurada lista para usar
                    </p>
                    <p className="text-slate-300">
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
                  className="text-xs font-medium text-blue-300 hover:underline"
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
        <div className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 shadow-[0_18px_50px_-28px_rgba(2,132,199,0.35)] sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />

          <div className="relative">
            <p className="inline-flex items-center rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
              Calculadora rápida
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Precio orientativo en menos de 30 segundos
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Elige combinación de idioma, documento y sube tu PDF. Para documentos con precio prefijado,
              el cálculo sale al instante.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">1. Idioma</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">2. Documento</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">3. PDF</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">4. Precio</span>
            </div>
            <PriceEstimator />
          </div>
        </div>
      </section>

      {/* ATAJOS MÓVIL */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:hidden">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">¿Qué necesitas hacer ahora?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Link
              href="/traductores-jurados"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700"
            >
              Ver idiomas
            </Link>
            <Link
              href="/documentos-oficiales"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700"
            >
              Ver documentos
            </Link>
            <Link
              href="/presupuesto"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700"
            >
              Presupuesto cerrado
            </Link>
            <Link
              href="/consulta"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700"
            >
              Estado pedido
            </Link>
          </div>
        </div>
      </section>

      {/* TARIFAS ORIENTATIVAS */}
      <section className="mx-auto hidden max-w-6xl px-4 py-10 sm:block">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Tarifas orientativas por idioma
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Estos son nuestros precios de referencia. El precio final depende del tipo de documento,
          su extension y la urgencia. Te confirmamos un precio cerrado al ver tus documentos.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { lang: "Frances", flag: "\u{1F1EB}\u{1F1F7}", rate: "0,08", note: "Certificados desde 35 EUR" },
            { lang: "Ingles", flag: "\u{1F1EC}\u{1F1E7}", rate: "0,10", note: "Certificados desde 40 EUR" },
            { lang: "Aleman", flag: "\u{1F1E9}\u{1F1EA}", rate: "0,12", note: "Certificados desde 45 EUR" },
            { lang: "Neerlandes", flag: "\u{1F1F3}\u{1F1F1}", rate: "0,14", note: "Certificados desde 50 EUR" },
          ].map((item) => (
            <div
              key={item.lang}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
            >
              <p className="text-2xl">{item.flag}</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">{item.lang}</h3>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{item.rate} EUR<span className="text-sm font-normal text-slate-500">/palabra</span></p>
              <p className="mt-1 text-xs text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>IVA exento (art. 20.1.26 LIVA)</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Urgencia +25%</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <Link href="/precios-traduccion-jurada" className="font-semibold text-emerald-700 hover:underline">
            Ver mas sobre precios →
          </Link>
        </div>
      </section>

      {/* BLOQUE PRINCIPALES DOCUMENTOS */}
      <section className="mx-auto hidden max-w-6xl px-4 py-12 sm:block">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Principales documentos que traducimos
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
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
            },
            {
              title: "Documentos de identidad y pasaportes",
              desc: "DNI, NIE, pasaporte, libro de familia u otros documentos equivalentes.",
              href: "/documentos-oficiales/certificados-registro-civil",
            },
            {
              title: "Títulos y expedientes académicos",
              desc: "Títulos universitarios, certificados de notas, diplomas y programas de estudios.",
              href: "/documentos-oficiales/documentos-academicos",
            },
            {
              title: "Contratos y documentos legales",
              desc: "Contratos de trabajo, alquiler, compraventa, escrituras notariales.",
              href: "/documentos-oficiales/documentos-juridicos",
            },
            {
              title: "Documentos financieros y comerciales",
              desc: "Cuentas anuales, balances, escrituras societarias, poderes mercantiles.",
              href: "/documentos-oficiales/documentos-mercantiles",
            },
            {
              title: "Apostillas y legalizaciones",
              desc: "Traducción de Apostilla de la Haya y otros sellos de legalización.",
              href: "/documentos-oficiales/apostilla-haya",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
            >
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-1 text-slate-600">{item.desc}</p>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-xs">
                <Link
                  href={item.href}
                  className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                >
                  Ver más sobre {item.title} →
                </Link>
                <Link
                  href="/presupuesto"
                  className="inline-flex w-fit items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Pedir presupuesto para {item.title.toLowerCase()} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* BLOQUE IDIOMAS PRINCIPALES */}
      <section className="mx-auto hidden max-w-6xl px-4 pb-4 sm:block">
        <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Traducciones juradas por idioma
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Contamos con traductores jurados de{" "}
          <strong>francés, alemán, inglés</strong> y otros idiomas europeos
          para que puedas presentar tus documentos en España y en el extranjero
          con todas las garantías.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {/* FRANCÉS */}
          <Link
            href="/traductor-jurado-frances"
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-emerald-500 hover:shadow-md"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Traductor jurado de francés
            </h3>
            <p className="mt-1 text-slate-600">
              Documentos de Francia, Bélgica, Suiza, Canadá y países francófonos
              para trámites en España.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-emerald-700">
              Ver traducciones juradas de francés →
            </span>
          </Link>

          {/* ALEMÁN */}
          <Link
            href="/traductor-jurado-aleman"
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-emerald-500 hover:shadow-md"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Traductor jurado de alemán
            </h3>
            <p className="mt-1 text-slate-600">
              Documentos de Alemania, Austria y Suiza para empleo, estudios,
              residencia o herencias.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-emerald-700">
              Ver traducciones juradas de alemán →
            </span>
          </Link>

          {/* INGLÉS */}
          <Link
            href="/traductor-jurado-ingles"
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-emerald-500 hover:shadow-md"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Traductor jurado de inglés
            </h3>
            <p className="mt-1 text-slate-600">
              Documentos de Reino Unido, Irlanda, EE. UU., Canadá y otros países de
              habla inglesa.
            </p>
            <span className="mt-3 inline-block text-xs font-semibold text-emerald-700">
              Ver traducciones juradas de inglés →
            </span>
          </Link>
        </div>

        {/* Mención al resto de idiomas */}
        <p className="mt-4 text-xs text-slate-500">
          También gestionamos traducciones juradas de{" "}
          <Link href="/traductor-jurado-italiano" className="text-emerald-700 underline">
            italiano
          </Link>
          ,{" "}
          <Link href="/traductor-jurado-portugues" className="text-emerald-700 underline">
            portugués
          </Link>
          ,{" "}
          <Link href="/traductor-jurado-neerlandes" className="text-emerald-700 underline">
            neerlandés
          </Link>
          ,{" "}
          <Link href="/traductor-jurado-sueco" className="text-emerald-700 underline">
            sueco
          </Link>{" "}
          y{" "}
          <Link href="/traductor-jurado-noruego" className="text-emerald-700 underline">
            noruego
          </Link>
          .
        </p>
      </section>

      {/* BLOQUE CONFIANZA */}
      <section className="mx-auto hidden max-w-6xl px-4 py-12 sm:block">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-emerald-900 sm:text-2xl">
            Por que confiar en traduccionesjuradas.net
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-700">MAEC</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Nombrados por el Ministerio</p>
              <p className="mt-1 text-xs text-slate-600">
                Traductores jurados acreditados por el Ministerio de Asuntos Exteriores de Espana. No intermediarios.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-700">N.3850</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Traductor jurado de frances</p>
              <p className="mt-1 text-xs text-slate-600">
                Juan Silva Moreno, traductor jurado de frances nombrado por el MAEC con numero 3850.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-700">PDF</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Firma digital oficial</p>
              <p className="mt-1 text-xs text-slate-600">
                Entrega habitual en PDF firmado digitalmente, aceptado por administraciones y universidades.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-700">24-72h</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Entrega rapida</p>
              <p className="mt-1 text-xs text-slate-600">
                Certificados sencillos en 24-48h. Documentos extensos en 2-5 dias. Urgencias disponibles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE ESPECIAL TELETRABAJO MARRUECOS */}
      <section className="hidden border-y border-slate-200 bg-slate-100/60 sm:block">
        <div className="mx-auto max-w-6xl px-4 py-10 lg:py-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                ¿Eres de Marruecos y quieres teletrabajar en España?
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                Si necesitas preparar un expediente de{" "}
                <strong>teletrabajo o residencia en España</strong> con
                documentos marroquíes (salarios, CNSS, Registro Mercantil,
                antecedentes penales, EM 30, certificados de nacimiento y
                matrimonio, etc.), hemos creado una guía específica donde
                explicamos el paquete de documentos más habitual y qué debe
                traducirse.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Trabajamos cada día con <strong>clientes de Marruecos</strong>{" "}
                y con <strong>empresas que desplazan trabajadores</strong> para
                que sus traducciones juradas cumplan los requisitos de extranjería
                y consulados españoles.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/teletrabajo"
                  className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Ver guía de documentos para teletrabajo Marruecos → España
                </Link>
                <a
                  href={WHATSAPP_LINK}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  Consultar mi caso por WhatsApp
                </a>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Qué suele incluir el paquete de documentos?
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                <li>Certificados de nacimiento y matrimonio con apostilla.</li>
                <li>Certificado de antecedentes penales (Bulletin n°3).</li>
                <li>Contrato de trabajo y autorización de teletrabajo.</li>
                <li>Tres últimas nóminas y attestations de salaires.</li>
                <li>Registro Mercantil, estatutos y poderes de la empresa.</li>
                <li>Formularios consulares como el EM 30.</li>
              </ul>
              <p className="mt-2 text-xs text-slate-600">
                En la guía de{" "}
                <Link
                  href="/teletrabajo"
                  className="text-emerald-700 underline"
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
      <section className="hidden border-b border-slate-200 bg-slate-100/60 sm:block">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                Apostilla de la Haya y firma digital
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                Te ayudamos a que tus documentos con Apostilla de la Haya y
                otras legalizaciones sean válidos en el país de destino gracias
                a una traducción jurada precisa y fiel al original.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Nuestras traducciones juradas se entregan habitualmente en{" "}
                <strong>formato PDF firmado digitalmente</strong>, cada vez más
                aceptado por las Administraciones Públicas, colegios oficiales y
                universidades, tanto en España como en otros países.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Si tienes dudas sobre si tu documento necesita apostilla antes
                de traducirlo, puedes consultar nuestra página sobre{" "}
                <Link
                  href="/documentos-oficiales/apostilla-haya"
                  className="text-emerald-700 underline"
                >
                  Apostilla de la Haya
                </Link>{" "}
                o preguntarnos directamente.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Tienes dudas sobre apostilla o requisitos en el país de
                destino?
              </h3>
              <p className="text-slate-700">
                Cada consulado, universidad o administración puede exigir
                requisitos distintos. Lo más seguro es consultar directamente
                con el organismo donde vas a presentar la documentación. Si lo
                necesitas, puedes contarnos tu caso y te orientamos.
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <a
                  href={WHATSAPP_LINK}
                  className="rounded-2xl border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  Preguntar por WhatsApp
                </a>
                <a
                  href={MAIL_LINK}
                  className="font-medium text-blue-700 hover:underline"
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
        <div className="rounded-3xl bg-slate-900 px-6 py-8 text-slate-50 shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                ¿Necesitas una traducción jurada urgente?
              </h2>
              <p className="mt-2 text-sm text-slate-200">
                Envíanos el documento y te responderemos con un presupuesto y
                plazo aproximado lo antes posible. Trabajamos con traductores
                jurados de francés, alemán, inglés, neerlandés, italiano,
                portugués, catalán, sueco y noruego.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <a
                href={WHATSAPP_LINK}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-center font-semibold text-white hover:bg-emerald-600"
              >
                Escribir por WhatsApp
              </a>
              <a
              href={MAIL_LINK}
                className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg"
              >
                Pedir presupuesto por email
              </a>

              <p className="text-center text-[11px] text-slate-300">
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
