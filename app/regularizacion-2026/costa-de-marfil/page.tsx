import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Regularización 2026 · Costa de Marfil · Traducción jurada francés-español · MAEC nº 3850",
  description:
    "Documentos marfileños en francés traducidos al español para la regularización extraordinaria 2026 (RD 316/2026). Casier judiciaire Bulletin nº 3, extrait d'acte de naissance, legalización consular. Entrega 24h.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/regularizacion-2026/costa-de-marfil",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Costa de Marfil aplica la Apostilla de La Haya?",
    answer:
      "No. Costa de Marfil no es parte del Convenio de La Haya (status HCCH a 31-XII-2025). Los documentos deben legalizarse mediante el procedimiento consular: sello del Ministère des Affaires Étrangères marfileño y posterior sello del Consulado/Embajada de España en Abiyán antes de presentarlos en España.",
  },
  {
    question: "¿Cómo solicito el Bulletin nº 3 en Costa de Marfil?",
    answer:
      "El Bulletin nº 3 del Casier Judiciaire se gestiona a través de la plataforma oficial e-justice.ci o presencialmente en el Tribunal de Première Instance del lugar de nacimiento. Se entrega al interesado y es el único formato admisible para trámites en el extranjero.",
  },
  {
    question: "¿Cuánto tarda la legalización consular?",
    answer:
      "La legalización en cadena (Affaires Étrangères marfileño + Embajada de España) suele tardar varias semanas dependiendo de citas y carga de trabajo. Recomendamos iniciar el ciclo con margen suficiente antes del 30 de junio de 2026.",
  },
  {
    question: "¿Tradúcis directamente del francés?",
    answer:
      "Sí. El francés es lengua oficial en Costa de Marfil y todos los documentos del estado civil y judicial se emiten en francés. Como traductor jurado oficial de francés (MAEC nº 3850), traducimos directamente sin intermediarios. Plazo habitual de 24h una vez tenemos el documento legalizado.",
  },
  {
    question: "¿Qué documentos pide Extranjería para la regularización?",
    answer:
      "Casier judiciaire Bulletin nº 3 + acta de nacimiento (extrait d'acte de naissance) + acta de matrimonio si invocas arraigo familiar. Todos legalizados en Costa de Marfil y traducidos al español por traductor jurado MAEC.",
  },
];

export default function RegularizacionCostaDeMarfilPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-regularizacion-2026-costa-de-marfil"
        serviceName="Traducción jurada francés-español de documentos marfileños para la regularización 2026"
        serviceDescription="Traducción jurada francés-español de Casier Judiciaire Bulletin nº 3, extrait d'acte de naissance y otros documentos de Costa de Marfil para la regularización extraordinaria abierta hasta el 30 de junio de 2026. Entrega 24h."
        serviceUrl="https://www.traduccionesjuradas.net/regularizacion-2026/costa-de-marfil"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-regularizacion-2026-costa-de-marfil"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Regularización extraordinaria 2026",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026",
          },
          {
            name: "Costa de Marfil",
            url: "https://www.traduccionesjuradas.net/regularizacion-2026/costa-de-marfil",
          },
        ]}
      />
      <SchemaFAQ id="faq-regularizacion-2026-costa-de-marfil" items={FAQ_ITEMS} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Costa de Marfil · Regularización 2026
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Documentos marfileños para la regularización extraordinaria 2026
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
          , esta página explica qué documentos marfileños necesitas, cómo
          obtenerlos y cómo los traducimos al español como traductor jurado de
          francés (MAEC nº 3850). Costa de Marfil <strong>no es parte del
          Convenio de La Haya</strong>: requiere legalización consular en cadena
          antes de la traducción.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-or/30 bg-or/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-or">
          Atención: legalización consular, no apostilla
        </h2>
        <p className="mt-2 text-sepia">
          Los documentos marfileños deben pasar por la legalización consular
          completa <em>antes</em> de la traducción jurada. Este trámite suele
          durar varias semanas. Si tu cita en Extranjería es en menos de 6
          semanas, planifica el envío y consulta con un abogado de extranjería.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">
          Qué documentos marfileños te van a pedir
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sepia">
          <li>
            <strong>Casier judiciaire — Bulletin nº 3</strong> (antecedentes
            penales).
          </li>
          <li>
            <strong>Extrait d&apos;acte de naissance</strong> (acta de nacimiento)
            si acreditas vínculo familiar con menores o cónyuge.
          </li>
          <li>
            <strong>Acte de mariage</strong> (acta de matrimonio) si invocas
            arraigo familiar.
          </li>
          <li>
            <strong>Legalización consular</strong> (no apostilla) sobre cada
            documento.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          1 · Casier judiciaire (Bulletin nº 3)
        </h2>
        <p>
          Costa de Marfil hereda del derecho francés el sistema de tres bulletins.
          El <strong>Bulletin nº 3</strong> es el único que se entrega al
          interesado y el que se acepta para trámites en el extranjero.
        </p>
        <p>Cómo solicitarlo:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Online</strong> a través de la Plataforma de Digitalización y
            Seguridad de los Actos de Justicia:{" "}
            <a
              href="https://e-justice.ci"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bleu hover:underline"
            >
              e-justice.ci
            </a>
            .
          </li>
          <li>
            <strong>Presencial</strong> en el Tribunal de Première Instance del
            lugar de nacimiento.
          </li>
          <li>
            <strong>Por mandatario</strong> con poder específico, si te
            encuentras ya en España.
          </li>
        </ul>
        <p className="text-xs">
          Conserva el justificante de solicitud: el reglamento prevé que si
          pasado un mes no has recibido el certificado, la administración
          española puede reclamarlo por vía diplomática.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          2 · Legalización consular en cadena
        </h2>
        <p>
          Como Costa de Marfil no aplica la Apostilla de La Haya, cada documento
          debe pasar por una <strong>cadena de legalización</strong> antes de
          ser traducido al español:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Sello del <strong>Ministère des Affaires Étrangères</strong> de
            Costa de Marfil sobre el documento original.
          </li>
          <li>
            Sello del <strong>Consulado / Embajada de España en Abiyán</strong>{" "}
            sobre el documento ya legalizado por las autoridades marfileñas.
          </li>
          <li>
            En algunos casos, sello adicional del Ministerio de Asuntos
            Exteriores de España (MAEUEC) en Madrid. Verifica con tu abogado o
            Subdelegación si tu expediente lo exige.
          </li>
        </ol>
        <p className="text-xs">
          Plazo realista: varias semanas, dependiendo de la disponibilidad de
          citas en cada paso. Inicia el trámite cuanto antes si quieres llegar
          al cierre del 30 de junio.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          3 · Acta de nacimiento (extrait d&apos;acte de naissance)
        </h2>
        <p>
          Lo emite el <em>Centre d&apos;État Civil</em> de la comuna de
          nacimiento. Para los efectos de la regularización 2026 también debe
          pasar por la cadena de legalización consular antes de la traducción
          jurada al español.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          4 · Cómo trabajamos tu expediente
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Una vez tengas el documento legalizado consularmente, nos lo envías
            por WhatsApp o por el formulario en PDF o foto legible.
          </li>
          <li>
            Te confirmamos precio cerrado y plazo de entrega (24h habitual).
          </li>
          <li>
            Traducimos al español incluyendo todos los sellos y la cadena de
            legalización. Firma manuscrita y sello de traductor jurado MAEC nº
            3850.
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
            <strong>Casier judiciaire Bulletin nº 3 (francés):</strong> 25 € —
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
          Entrega de la traducción jurada en PDF firmado digitalmente (válido
          oficialmente) <strong>incluida</strong>. Envío del original en papel
          por mensajería: a coste de mensajería. Las tasas consulares en Costa
          de Marfil y en la Embajada de España no están incluidas.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-bleu/30 bg-bleu/5 p-5 text-sm text-encre">
        <h2 className="text-lg font-semibold text-bleu">
          Pago fácil: Bizum, tarjeta o transferencia
        </h2>
        <p className="mt-2 text-sepia">
          Aceptamos pago con <strong>Bizum</strong>, tarjeta (Stripe / Redsys),
          PayPal o transferencia bancaria. Recibo electrónico inmediato. Empiezas
          a tramitar en cuanto recibimos el pago.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          Sube tus documentos marfileños y obtén presupuesto
        </h2>
        <p className="mt-1 text-encre">
          Adjunta el Bulletin nº 3, el extrait d&apos;acte de naissance y
          cualquier otro documento ya legalizado consularmente. Te respondemos
          con un presupuesto cerrado y plazo realista para tu cita en
          Extranjería.
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
          1155/2024), el portal oficial e-justice.ci y la información de la
          HCCH sobre el estatus de Costa de Marfil respecto al Convenio de La
          Haya. No constituye asesoramiento jurídico. Consulta con un abogado
          de extranjería o con tu Subdelegación del Gobierno antes de presentar
          tu solicitud.
        </p>
      </section>
    </main>
  );
}
