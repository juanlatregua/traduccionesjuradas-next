// app/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";

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
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 lg:flex-row lg:items-center lg:py-20">
          <div className="flex-1 space-y-6">
            <p className="inline rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Traducciones juradas oficiales · Traductores jurados, no
              intermediarios
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Traducciones juradas para trámites en España
              <span className="block text-blue-700">
                y en el extranjero, con traductores jurados reales.
              </span>
            </h1>
            <p className="max-w-xl text-base text-slate-600 sm:text-lg">
              Coordinamos un equipo de traductores jurados nombrados por el
              MAEC para que puedas presentar tus documentos ante
              administraciones, universidades, juzgados y organismos oficiales
              en España y en otros países. Trabajamos sobre todo online, con
              entrega en PDF firmado digitalmente.
            </p>
            <p className="max-w-xl text-xs text-slate-500 sm:text-sm">
              También ayudamos a muchos clientes de{" "}
              <strong>Marruecos</strong> a preparar el paquete completo de
              documentos para <strong>teletrabajar en España</strong> (salarios,
              antecedentes penales, Registro Mercantil, EM 30, etc.). Más
              información en nuestra{" "}
              <Link
                href="/teletrabajo"
                className="font-semibold text-emerald-700 hover:underline"
              >
                guía para teletrabajo Marruecos → España
              </Link>
              .
            </p>

            {/* CTA principal */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={MAIL_LINK}
                className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                style={{
                  background:
                    "linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 50%, #22c55e 100%)",
                  color: "white",
                }}
              >
                Pedir presupuesto por email
              </a>

              <a
                href={WHATSAPP_LINK}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Enviar documentos por WhatsApp
              </a>

              <Link
                href="/presupuesto"
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                O rellenar el formulario de presupuesto
              </Link>
            </div>

            <div className="mt-3">
              <AvailabilityBadge />
            </div>

            {/* Mini confianza */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>Traducciones juradas firmadas por traductores jurados</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Servicio online para toda España y países de destino</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>
                Especialistas en francés, alemán, inglés y otros idiomas
              </span>
            </div>
          </div>

          {/* Box de proceso 3 pasos */}
          <div className="flex-1">
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

      {/* BLOQUE PRINCIPALES DOCUMENTOS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
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
      <section className="mx-auto max-w-6xl px-4 pb-4">
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

      {/* BLOQUE ESPECIAL TELETRABAJO MARRUECOS */}
      <section className="border-y border-slate-200 bg-slate-100/60">
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
      <section className="border-b border-slate-200 bg-slate-100/60">
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
      <section className="mx-auto max-w-6xl px-4 pb-12">
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
