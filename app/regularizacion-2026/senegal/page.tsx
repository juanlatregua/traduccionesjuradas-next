import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Regularización 2026 · Senegal · Traducción jurada de casier judiciaire y extrait de naissance",
  description:
    "Documentos senegaleses traducidos al español para la regularización extraordinaria 2026 (RD 316/2026). Casier judiciaire, extrait d'acte de naissance, apostilla (Hague desde 23-03-2023). Traductor jurado MAEC nº 3850.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/regularizacion-2026/senegal",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Senegal aplica la Apostilla de La Haya?",
    answer:
      "Sí, desde el 23 de marzo de 2023. Antes de esa fecha se aplicaba la legalización consular tradicional. Para los documentos emitidos hoy, basta con la apostilla en Senegal y la traducción jurada al español por traductor MAEC.",
  },
  {
    question: "¿Qué autoridad emite la apostilla en Senegal?",
    answer:
      "La autoridad competente es la Cour Suprême del Senegal. Verifica los pasos en el consulado de España en Dakar o con tu abogado en Senegal antes de planificar el envío de documentos.",
  },
  {
    question: "¿El casier judiciaire senegalés se solicita igual que en Francia?",
    answer:
      "El sistema senegalés hereda el modelo francés con tres tipos de bulletin. El bulletin nº 3 es el que se entrega al interesado y se usa para trámites en el extranjero. Lo emite el Tribunal de Grande Instance del lugar de nacimiento.",
  },
  {
    question: "¿Cuántos años de antecedentes pide Extranjería?",
    answer:
      "El RD 316/2026 exige certificado de antecedentes penales de los países en los que el solicitante haya residido durante los 5 años anteriores a su entrada en España. Si has residido en varios países antes de llegar, necesitas un certificado por cada uno.",
  },
  {
    question: "¿Tradúcis también del wolof o francés africano?",
    answer:
      "Los documentos oficiales senegaleses están redactados en francés (lengua oficial del país). Como traductor jurado de francés (MAEC nº 3850), traducimos directamente al español sin pasar por intermediarios.",
  },
];

export default function RegularizacionSenegalPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-regularizacion-2026-senegal"
        serviceName="Traducción jurada de documentos senegaleses para la regularización 2026"
        serviceDescription="Traducción jurada francés-español de casier judiciaire, extrait d'acte de naissance y otros documentos senegaleses para la regularización extraordinaria abierta hasta el 30 de junio de 2026."
        serviceUrl="https://www.traduccionesjuradas.net/regularizacion-2026/senegal"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-regularizacion-2026-senegal"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Regularización extraordinaria 2026",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026",
          },
          {
            name: "Senegal",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026/senegal",
          },
        ]}
      />
      <SchemaFAQ id="faq-regularizacion-2026-senegal" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Senegal · Regularización 2026
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Documentos senegaleses para la regularización extraordinaria 2026
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
          , esta página explica qué documentos senegaleses necesitas, cómo
          obtenerlos y cómo los traducimos al español como traductor jurado de
          francés (MAEC nº 3850).
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">
          Qué documentos senegaleses te van a pedir
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
            <strong>Acte de mariage</strong> — si invocas arraigo familiar.
          </li>
          <li>
            <strong>Apostilla de La Haya</strong> emitida en Senegal sobre cada
            documento.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          1 · Casier judiciaire (bulletin nº 3)
        </h2>
        <p>
          Senegal hereda del derecho francés el sistema de tres bulletins. El{" "}
          <strong>bulletin nº 3</strong> es el único entregable al interesado y
          el que se usa para trámites en el extranjero, incluida la
          regularización en España.
        </p>
        <p>Cómo solicitarlo:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Presencial</strong> en el Tribunal de Grande Instance del
            lugar de nacimiento o de residencia en Senegal.
          </li>
          <li>
            <strong>Por mandatario</strong> con poder específico, si estás en
            España.
          </li>
        </ul>
        <p className="text-xs">
          Después de obtenerlo, hay que apostillarlo en la Cour Suprême antes
          de enviarlo a España para la traducción jurada. Conserva el
          justificante de solicitud por si la administración tarda y el
          certificado caduca.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          2 · Apostilla en Senegal
        </h2>
        <p>
          Senegal es parte del Convenio de La Haya{" "}
          <strong>desde el 23 de marzo de 2023</strong>. Antes de esa fecha se
          aplicaba la legalización consular en cadena (Ministerio de Asuntos
          Exteriores senegalés + Embajada de España). Para los documentos
          emitidos hoy, la apostilla sustituye toda esa cadena.
        </p>
        <p>
          La autoridad competente para apostillar en Senegal es la{" "}
          <strong>Cour Suprême</strong>. Si tu documento es muy antiguo (anterior
          a 2023) y todavía lleva legalización consular, también lo aceptamos
          para la traducción jurada.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          3 · Acta de nacimiento (extrait d&apos;acte de naissance)
        </h2>
        <p>
          Lo emite el <em>Centre d&apos;État Civil</em> de la comuna de
          nacimiento. En Senegal hay dos formatos habituales:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Copie littérale</strong> — copia literal del registro,
            preferida por la administración española.
          </li>
          <li>
            <strong>Extrait</strong> — extracto resumido, válido en muchos
            casos.
          </li>
        </ul>
        <p>
          Para la regularización 2026, ambos formatos deben ir{" "}
          <strong>apostillados</strong> antes de la traducción jurada al
          español.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          4 · Cómo trabajamos tu expediente
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Nos envías por WhatsApp o por el formulario el PDF o la foto del
            bulletin nº 3 y los documentos civiles, ya apostillados en Senegal.
          </li>
          <li>
            Te confirmamos precio cerrado y plazo realista (24-48h habituales).
          </li>
          <li>
            Traducimos al español, incluyendo apostilla y sellos. Firma
            manuscrita y sello de traductor jurado MAEC nº 3850.
          </li>
          <li>
            Te enviamos el PDF firmado y, si lo necesitas, original en papel
            por mensajería.
          </li>
        </ol>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Tarifa regularización 2026 · 25 € por documento
        </h2>
        <p className="mt-2 text-sepia">
          Tarifa especial para expedientes de regularización extraordinaria 2026
          de países francófonos.
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Casier judiciaire bulletin nº 3 (francés):</strong> 25 € —
            entrega 24h
          </li>
          <li>
            <strong>Extrait d&apos;acte de naissance:</strong> 25 € — entrega
            24h
          </li>
          <li>
            <strong>Acte de mariage:</strong> 25 € — entrega 24-48h
          </li>
          <li>
            <strong>Pack expediente</strong> (varios documentos): mismo precio
            unitario, sin recargo
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
          Sube tus documentos senegaleses y obtén presupuesto
        </h2>
        <p className="mt-1 text-encre">
          Adjunta el bulletin nº 3, el extrait d&apos;acte de naissance y
          cualquier otro documento. Te respondemos con un precio cerrado y un
          plazo realista para que llegues a tu cita en Extranjería con todo
          preparado.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/start?p=regularizacion-2026"
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
          href="/blog/documentos-senegaleses-espana"
          className="font-semibold text-bleu hover:underline"
        >
          Guía documentos senegaleses
        </Link>
        {" · "}
        <Link
          href="/traduccion-jurada-antecedentes-penales"
          className="font-semibold text-bleu hover:underline"
        >
          Antecedentes penales (general)
        </Link>
      </p>

      <section className="mt-10 rounded-2xl border border-sepia/20 bg-parchment p-4 text-xs text-sepia">
        <p>
          <strong>Aviso legal.</strong> Página informativa basada en el Real
          Decreto 316/2026 (BOE-A-2026-8284), el Reglamento de Extranjería (RD
          1155/2024) y la información oficial de la HCCH sobre la adhesión de
          Senegal al Convenio de La Haya. No constituye asesoramiento jurídico.
          Consulta con un abogado de extranjería o con tu Subdelegación del
          Gobierno antes de presentar tu solicitud.
        </p>
      </section>
    </main>
  );
}
