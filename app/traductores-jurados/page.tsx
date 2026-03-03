import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Equipo de traductores jurados oficiales | Quiénes somos",
  description:
    "Equipo de traductores jurados oficiales para documentación personal, académica, jurídica y mercantil. Trabajamos por especialidad e idioma, sin intermediarios opacos.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/traductores-jurados" },
};

export default function TraductoresJuradosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Sobre nosotros
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Equipo de traductores jurados oficiales, sin intermediarios
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Detrás de traduccionesjuradas.net no hay una gran plataforma anónima,
          sino un equipo reducido de traductores jurados que trabaja de forma
          directa y cercana con cada cliente. Coordinamos encargos de
          traducción jurada para que tus documentos lleguen a tiempo y
          correctamente preparados al organismo donde los tienes que presentar.
        </p>
      </header>

      {/* QUIÉN ESTÁ DETRÁS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Quién está detrás de traduccionesjuradas.net?
        </h2>
        <p>
          El proyecto está impulsado por Juan Silva Moreno, traductor jurado
          de francés (n.º 3850, Ministerio de Asuntos Exteriores), con
          amplia experiencia en traducción jurada de documentos para extranjería,
          Registro Civil, universidades, notarías y procedimientos judiciales.
          Con los años, hemos creado una red de colaboradores traductores
          jurados de otros idiomas (alemán, inglés, neerlandés, italiano,
          portugués, catalán, sueco, noruego…) para poder dar respuesta a
          expedientes más complejos.
        </p>
        {/* Tarjeta E-E-A-T */}
        <div className="my-6 rounded-2xl border border-cream bg-cream/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            Datos clave del traductor jurado principal
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-bleu">2009</p>
              <p className="mt-1 text-xs font-semibold text-encre">Año de nombramiento</p>
              <p className="mt-0.5 text-[11px] text-sepia">Ministerio de Asuntos Exteriores</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-bleu">+15 años</p>
              <p className="mt-1 text-xs font-semibold text-encre">De experiencia</p>
              <p className="mt-0.5 text-[11px] text-sepia">Traducción jurada FR↔ES</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-bleu">+3.000</p>
              <p className="mt-1 text-xs font-semibold text-encre">Traducciones entregadas</p>
              <p className="mt-0.5 text-[11px] text-sepia">Particulares y empresas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-bleu">Lic. TeI</p>
              <p className="mt-1 text-xs font-semibold text-encre">Formación académica</p>
              <p className="mt-0.5 text-[11px] text-sepia">Traducción e Interpretación</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-sepia">
            Documentos más frecuentes: certificados del Registro Civil, documentos académicos, antecedentes penales y documentos mercantiles.
          </p>
        </div>

        <p>
          Si tu expediente está centrado en documentación en francés, consulta
          la página especializada del{" "}
          <Link
            href="/traductor-jurado-frances"
            className="font-semibold text-bleu hover:underline"
          >
            servicio oficial de francés
          </Link>
          .
        </p>
        <p>
          Nuestro trabajo consiste en coordinar cada encargo, asignarlo al
          traductor jurado más adecuado y acompañarte durante el proceso para
          evitar errores que puedan retrasar tus trámites.
        </p>
        <p className="text-xs text-sepia">
          Puedes verificar el nombramiento de Juan Silva Moreno como traductor-intérprete
          jurado en el{" "}
          <a
            href="https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bleu hover:underline"
          >
            listado oficial del Ministerio de Asuntos Exteriores
          </a>
          .
        </p>
      </section>

      {/* NO SOMOS INTERMEDIARIOS OPACOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          No somos una plataforma de intermediación cualquiera
        </h2>
        <p>
          Muchas páginas de traducción jurada funcionan como meros
          intermediarios: captan encargos y los reparten sin que el cliente
          sepa quién traduce realmente sus documentos. Nuestro enfoque es
          distinto:
        </p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>
            <strong>Trabajamos con traductores jurados reales</strong>, nombrados
            oficialmente para cada idioma.
          </li>
          <li>
            <strong>Revisamos tu caso</strong> y te orientamos si hay dudas
            sobre documentación, apostillas o requisitos específicos.
          </li>
          <li>
            <strong>Presupuestos claros</strong>, con precio cerrado y plazos
            realistas.
          </li>
          <li>
            <strong>Canales directos</strong>: email y WhatsApp, para que puedas
            enviarnos tus documentos con facilidad.
          </li>
        </ul>
      </section>

      {/* TIPOS DE CLIENTES Y EXPEDIENTES */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Tipos de clientes y expedientes con los que trabajamos
        </h2>
        <p>
          Atendemos tanto a particulares como a despachos profesionales:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Personas que preparan expedientes de{" "}
            <strong>extranjería, nacionalidad o reagrupación familiar</strong>.
          </li>
          <li>
            Estudiantes que necesitan traducir{" "}
            <strong>títulos, expedientes académicos y certificados de idiomas</strong>{" "}
            para universidades españolas o extranjeras.
          </li>
          <li>
            Profesionales y empresas que gestionan{" "}
            <strong>contratos, poderes, escrituras, estatutos y documentación mercantil</strong>{" "}
            para operar entre España y otros países.
          </li>
          <li>
            Familias que tramitan{" "}
            <strong>herencias, compraventas de inmuebles y otros procedimientos notariales</strong>{" "}
            con documentación en varios idiomas.
          </li>
        </ul>
        <p className="text-xs text-sepia">
          Una parte importante de nuestro trabajo está relacionada con expedientes
          que incluyen documentos de países francófonos (como Francia o
          Marruecos) y de países europeos como Alemania, Países Bajos o los
          países nórdicos.
        </p>
      </section>

      {/* CÓMO TRABAJAMOS (RESUMEN) */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Cómo trabajamos con tus documentos
        </h2>
        <p>
          Nuestro objetivo es que el proceso de traducción jurada sea lo más
          sencillo posible para ti:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Nos envías tus documentos escaneados o en foto clara.</li>
          <li>
            Te respondemos con un <strong>presupuesto cerrado</strong> y un
            plazo estimado.
          </li>
          <li>
            Asignamos la traducción al traductor jurado adecuado y revisamos el
            trabajo antes de la entrega.
          </li>
          <li>
            Te enviamos la traducción jurada en{" "}
            <strong>PDF firmado digitalmente</strong> y, si lo necesitas,
            también en papel.
          </li>
        </ol>
        <p>
          Puedes ver el detalle del proceso en la página de{" "}
          <Link
            href="/proceso"
            className="font-semibold text-bleu hover:underline"
          >
            cómo funciona la traducción jurada
          </Link>
          .
        </p>
      </section>

      {/* COMPROMISOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Nuestros compromisos contigo
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Confidencialidad</strong> absoluta sobre la información que
            contienen tus documentos.
          </li>
          <li>
            <strong>Claridad</strong> en los precios, sin suplementos inesperados.
          </li>
          <li>
            <strong>Realismo</strong> en los plazos: preferimos darte un plazo
            ajustado y cumplirlo.
          </li>
          <li>
            <strong>Orientación</strong> cuando tienes dudas sobre qué traducir
            o cómo presentar la documentación.
          </li>
        </ul>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-3xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Hablamos sobre tu caso concreto?
        </h2>
        <p className="mt-1 text-encre">
          Cada expediente es distinto. Puedes enviarnos tus documentos para que
          los revisemos y te propongamos la mejor forma de preparar la
          traducción jurada.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Rellenar el formulario de presupuesto
          </Link>
          <a
            href={MAIL_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar documentos por email
          </a>
          <a
            href={WHATSAPP_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar fotos por WhatsApp
          </a>
        </div>
        <p className="mt-2 text-[11px] text-sepia">
          Damos prioridad a las consultas por email y WhatsApp para poder
          revisar tus documentos con calma y ofrecerte un presupuesto ajustado.
        </p>
      </section>
    </main>
  );
}
