import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Regularización 2026 · Marruecos · Traducción jurada francés-español · MAEC nº 3850",
  description:
    "Documentos marroquíes en francés (o bilingüe árabe/francés) traducidos al español para la regularización extraordinaria 2026 (RD 316/2026). Casier judiciaire bulletin nº 3, extrait d'acte de naissance, apostilla. Entrega 24h.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/regularizacion-2026/marruecos",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Marruecos aplica la Apostilla de La Haya?",
    answer:
      "Sí, desde el 14 de agosto de 2016. La apostilla la gestiona el portal oficial apostille.ma. Antes de esa fecha se aplicaba la legalización consular tradicional.",
  },
  {
    question: "¿Qué certificado de antecedentes penales pide Extranjería?",
    answer:
      "El bulletin nº 3 (extrait du casier judiciaire) emitido por el Ministerio de Justicia marroquí, apostillado y traducido al español por traductor jurado MAEC. El bulletin nº 1 y el nº 2 son de uso interno judicial y no se aceptan.",
  },
  {
    question: "¿El acta de nacimiento marroquí en árabe sirve o necesito la versión en francés?",
    answer:
      "Pide a la comuna la versión bilingüe árabe/francés o el extrait d'acte de naissance en francés. Es la opción más rápida y económica: traducimos del francés directamente con plazo de 24h. Si solo tienes el original exclusivamente en árabe, derivamos a colaborador jurado externo (plazos y precios distintos al flujo automatizado francés).",
  },
  {
    question: "¿Cuánto tarda obtener el bulletin nº 3 en Marruecos?",
    answer:
      "La solicitud puede hacerse online a través del portal del Ministerio de Justicia o presencialmente en el Tribunal de Première Instance del lugar de nacimiento. Los plazos varían según la oficina; verifica en el portal oficial antes de planificar el expediente.",
  },
  {
    question: "¿Tradúcis también la apostilla?",
    answer:
      "Sí. La apostilla forma parte del documento y se traduce siempre junto con el certificado original. No incrementa el precio en la mayoría de los casos.",
  },
];

export default function RegularizacionMarruecosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-regularizacion-2026-marruecos"
        serviceName="Traducción jurada francés-español de documentos marroquíes para la regularización 2026"
        serviceDescription="Traducción jurada francés-español de casier judiciaire (bulletin nº 3), extrait d'acte de naissance y otros documentos marroquíes en francés o bilingüe árabe/francés para la regularización extraordinaria abierta hasta el 30 de junio de 2026. Entrega 24h."
        serviceUrl="https://www.traduccionesjuradas.net/regularizacion-2026/marruecos"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-regularizacion-2026-marruecos"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Regularización extraordinaria 2026",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026",
          },
          {
            name: "Marruecos",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026/marruecos",
          },
        ]}
      />
      <SchemaFAQ id="faq-regularizacion-2026-marruecos" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Marruecos · Regularización 2026
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Documentos marroquíes para la regularización extraordinaria 2026
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Si vas a presentar tu solicitud antes del{" "}
          <strong>30 de junio de 2026</strong> al amparo del{" "}
          <a
            href="https://www.boe.es/buscar/doc.php?id=BOE-A-2026-8284"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bleu hover:underline"
          >
            RD 316/2026
          </a>
          , esta página explica qué documentos marroquíes necesitas, cómo
          obtenerlos y cómo los traducimos al español como traductor jurado de
          francés (MAEC nº 3850). Trabajamos con la versión en francés o
          bilingüe árabe/francés del documento: es el flujo más rápido (24h) y
          el más económico.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">
          Qué documentos marroquíes te van a pedir
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sepia">
          <li>
            <strong>Casier judiciaire — bulletin nº 3</strong> (antecedentes
            penales).
          </li>
          <li>
            <strong>Extrait d&apos;acte de naissance</strong> (acta de nacimiento)
            — si acreditas vínculo familiar con menores o cónyuge.
          </li>
          <li>
            <strong>Acte de mariage</strong> (acta de matrimonio) — si invocas
            arraigo familiar.
          </li>
          <li>
            <strong>Certificat de résidence</strong> u otros documentos solo si
            los exige tu Subdelegación.
          </li>
        </ul>
        <p className="mt-3 text-xs text-sepia">
          Todos deben ir apostillados en Marruecos antes de la traducción
          jurada.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          1 · Casier judiciaire (bulletin nº 3)
        </h2>
        <p>
          Es el certificado oficial de antecedentes penales en Marruecos, emitido
          por el Ministerio de Justicia (
          <em>Ministère de la Justice</em>) a través de los Tribunales de Primera
          Instancia. Hay tres tipos de bulletin; el que se usa para trámites en
          el extranjero es el <strong>bulletin nº 3</strong>.
        </p>
        <p>Cómo solicitarlo:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Online</strong> a través del portal oficial del Ministerio
            de Justicia marroquí.
          </li>
          <li>
            <strong>Presencial</strong> en el Tribunal de Première Instance
            (محكمة الابتدائية) del lugar de nacimiento.
          </li>
          <li>
            <strong>Por mandatario</strong> (familiar o representante legal) con
            poder específico.
          </li>
        </ul>
        <p className="text-xs">
          Los plazos de emisión varían según la oficina y el canal de
          solicitud. Conserva el justificante: si Extranjería tarda en
          resolver y el certificado caduca (más de 3 meses desde emisión),
          tendrás que repetir el ciclo apostilla + traducción jurada.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          2 · Apostilla en Marruecos
        </h2>
        <p>
          Marruecos es parte del Convenio de La Haya desde el{" "}
          <strong>14 de agosto de 2016</strong>. Antes de la traducción jurada,
          el documento debe ir <strong>apostillado en Marruecos</strong>. La
          apostilla se gestiona a través del portal oficial{" "}
          <a
            href="https://www.apostille.ma"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bleu hover:underline"
          >
            apostille.ma
          </a>{" "}
          o presencialmente en las autoridades competentes designadas.
        </p>
        <p>
          La apostilla es una hoja o sello adicional que se adjunta al documento
          original. Incluye datos de la autoridad que firmó el documento y un
          número de registro verificable.
        </p>
        <p className="text-xs">
          Atención: si tu documento no tiene apostilla, no es válido en España
          aunque esté traducido. La apostilla se pone <em>antes</em> de
          traducir, no después.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          3 · Acta de nacimiento (extrait d&apos;acte de naissance)
        </h2>
        <p>
          Se emite en la comuna de inscripción del nacimiento (
          <em>Bureau d&apos;état civil</em>). Pide siempre la{" "}
          <strong>versión bilingüe árabe/francés</strong> o el{" "}
          <strong>extrait en francés</strong>: traducimos directamente del
          francés con plazo de 24h y precio cerrado desde 40 €.
        </p>
        <p className="text-xs">
          Si el documento que tienes está exclusivamente en árabe, deriva a
          colaborador jurado externo (consultar plazos y precios). Recomendamos
          siempre solicitar la versión bilingüe en la comuna: es gratis y
          ahorra costes y tiempo.
        </p>
        <p>
          Algunas comunas permiten solicitarlo online a través del portal
          watiqa.ma. Para los efectos de la regularización 2026 también debe ir{" "}
          <strong>apostillado</strong>.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          4 · Cómo trabajamos tu expediente
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Nos envías por WhatsApp o por el formulario de presupuesto el PDF o
            la foto legible del documento original (con apostilla).
          </li>
          <li>
            Te confirmamos precio cerrado y plazo de entrega adaptado a tu cita
            en Extranjería.
          </li>
          <li>
            Traducimos al español, incluyendo apostilla y sellos. Firma
            manuscrita y sello de traductor jurado MAEC nº 3850.
          </li>
          <li>
            Te enviamos el PDF firmado y, si lo necesitas, original en papel por
            mensajería.
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Tarifa regularización 2026 · 25 € por documento
        </h2>
        <p className="mt-2 text-sepia">
          Tarifa especial para expedientes de regularización extraordinaria 2026.
          Aplica a la versión en francés o bilingüe árabe-francés del documento
          (flujo automatizado, entrega 24h).
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Casier judiciaire bulletin nº 3 (francés):</strong> 25 € —
            entrega 24h
          </li>
          <li>
            <strong>Acta de nacimiento bilingüe árabe/francés:</strong> 25 € —
            entrega 24h
          </li>
          <li>
            <strong>Acta de matrimonio (francés o bilingüe):</strong> 25 € —
            entrega 24-48h
          </li>
          <li>
            <strong>Pack expediente</strong> (varios documentos): mismo precio
            unitario, sin recargo
          </li>
          <li className="text-xs">
            <strong>Documento exclusivamente en árabe:</strong> consultar.
            Trabajo derivado a colaborador jurado externo, plazos y precios
            distintos al flujo automatizado francés.
          </li>
        </ul>
        <p className="mt-3 text-xs">
          Entrega en PDF firmado digitalmente <strong>incluida</strong>. Envío
          del original en papel por mensajería: a coste de mensajería.
          Traducimos también la apostilla cuando va adjunta al documento, sin
          coste adicional.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">
          Pago fácil: Bizum, tarjeta o transferencia
        </h2>
        <p className="mt-2 text-sepia">
          Aceptamos pago con <strong>Bizum</strong>, tarjeta (Stripe / Redsys),
          PayPal o transferencia bancaria. Recibo electrónico inmediato. Empezamos
          a tramitar en cuanto recibimos el pago.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          Sube tus documentos marroquíes y obtén presupuesto
        </h2>
        <p className="mt-1 text-encre">
          Adjunta el bulletin nº 3, el acta de nacimiento y cualquier otro
          documento marroquí. Te respondemos con un presupuesto cerrado y un
          plazo realista para que llegues a tu cita en Extranjería con todo
          listo.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </section>

      <p className="mt-6 text-xs text-sepia">
        Ver también:{" "}
        <Link
          href="/regularizacion-2026"
          className="font-semibold text-bleu hover:underline"
        >
          Hub regularización 2026
        </Link>
        {" · "}
        <Link
          href="/marruecos"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos marroquíes (general)
        </Link>
        {" · "}
        <Link
          href="/blog/documentos-marroquies-guia-completa"
          className="font-semibold text-bleu hover:underline"
        >
          Guía documentos marroquíes
        </Link>
      </p>

      <section className="mt-10 rounded-2xl border border-sepia/20 bg-parchment p-4 text-xs text-sepia">
        <p>
          <strong>Aviso legal.</strong> Página informativa basada en el Real
          Decreto 316/2026 (BOE-A-2026-8284), el Reglamento de Extranjería (RD
          1155/2024) y el portal oficial apostille.ma. No constituye
          asesoramiento jurídico. Para la tramitación de tu expediente,
          consulta con un abogado de extranjería o con tu Subdelegación del
          Gobierno.
        </p>
      </section>
    </main>
  );
}
