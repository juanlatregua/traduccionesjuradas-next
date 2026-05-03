// app/marruecos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Traducci\u00F3n Jurada Documentos Marroqu\u00EDes \u00B7 Franc\u00E9s\u2194Espa\u00F1ol \u00B7 MAEC",
  description:
    "Traducci\u00F3n jurada de documentos marroqu\u00EDes: casier judiciaire, acta de nacimiento, diplomas, n\u00F3minas CNSS, certificados de matrimonio. Traductor jurado oficial MAEC n\u00BA 3850. Desde 35\u20AC.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/marruecos" },
};

export default function MarruecosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      {/* BANNER REGULARIZACIÓN 2026 */}
      <div className="mb-6 rounded-2xl border border-bleu/30 bg-bleu/5 p-4 text-sm text-encre">
        <p className="font-semibold text-bleu">
          ¿Tramitas la regularización extraordinaria 2026?
        </p>
        <p className="mt-1 text-sepia">
          Plazo improrrogable hasta el 30 de junio (RD 316/2026). Tenemos página
          específica con los documentos marroquíes, apostilla y plazos:{" "}
          <Link
            href="/regularizacion-2026/marruecos"
            className="font-semibold text-bleu hover:underline"
          >
            ver guía Marruecos →
          </Link>
        </p>
      </div>

      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Marruecos · España
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducciones juradas de documentos marroquíes para España
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Te ayudamos a preparar tus documentos marroquíes para que sean
          aceptados en España: traducción jurada oficial, información sobre
          apostilla y asesoramiento básico sobre qué suele pedir Extranjería,
          notarías, bancos y otros organismos. La mayoría de estos documentos
          están en francés —{" "}
          <Link
            href="/traductor-jurado-frances"
            className="font-semibold text-bleu hover:underline"
          >
            somos especialistas en traducción jurada de francés
          </Link>.
        </p>
      </header>

      {/* PRINCIPALES DOCUMENTOS */}
      <section className="mt-10 space-y-6 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Principales documentos marroquíes que traducimos
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Casier Judiciaire</strong> y otros certificados de antecedentes
            penales.
          </li>
          <li>
            <strong>Extraits d&apos;Acte de Naissance</strong>, certificados de matrimonio,
            certificados de divorcio y composición familiar.
          </li>
          <li>
            <strong>Certificados de salarios</strong> (Attestations de Salaire, CNSS).
          </li>
          <li>
            <strong>Attestation du Chiffre d&apos;Affaires Déclaré</strong> para
            auto-entrepreneurs o trabajadores por cuenta propia.
          </li>
          <li>
            <strong>Registre du Commerce</strong>, patente, identifiant fiscal y otros
            documentos mercantiles.
          </li>
          <li>
            Estatutos de sociedades, poderes notariales, actas y contratos.
          </li>
          <li>
            Documentación para teletrabajo, visados, residencia, estudios o compra
            de vivienda en España.
          </li>
        </ul>
      </section>

      {/* APOSTILLA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Apostilla de La Haya en documentos marroquíes
        </h2>
        <p>
          Para que un documento público marroquí sea válido en España, en la
          mayoría de los casos debe llevar la Apostilla de La Haya colocada por
          las autoridades marroquíes antes de la traducción jurada.
        </p>
        <p>Algunos documentos que casi siempre deben ir apostillados son:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Casier Judiciaire (antecedentes penales).</li>
          <li>Certificados de nacimiento y matrimonio.</li>
          <li>Certificados de salarios y otras attestations oficiales.</li>
          <li>Attestation du Chiffre d&apos;Affaires Déclaré.</li>
          <li>Certificados del Registre du Commerce y documentos notariales.</li>
        </ul>
        <p className="text-xs text-sepia">
          La traducción jurada debe incluir siempre la página de la apostilla.
          Si todavía no has apostillado tu documento, es recomendable preguntar
          en el consulado español o en la administración donde vas a presentar
          el expediente.
        </p>
      </section>

      {/* RELACIÓN CON TELETRABAJO */}
      <section className="mt-10 space-y-4 rounded-2xl border border-cream bg-card p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Vas a teletrabajar desde España para una empresa en Marruecos?
        </h2>
        <p>
          Muchos clientes marroquíes nos piden la traducción jurada de un
          paquete completo de documentos para teletrabajo: contrato, nóminas,
          certificados de salarios, Registre du Commerce, antecedentes penales y
          documentos familiares.
        </p>
        <p>
          Hemos creado una página específica donde explicamos con más detalle
          este tipo de expedientes:
        </p>
        <p>
          <Link
            href="/teletrabajo"
            className="font-semibold text-bleu hover:underline"
          >
            Ver traducciones juradas para teletrabajar en España →
          </Link>
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          Envíanos tus documentos marroquíes para un presupuesto sin compromiso
        </h2>
        <p className="mt-1 text-encre">
          Puedes adjuntar fotos claras o PDFs de tus documentos (casier,
          certificados de nacimiento, salarios, Registre du Commerce, etc.) y
          te responderemos con un precio cerrado y un plazo estimado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Traducciones%20juradas%20Marruecos%20-%20Espa%C3%B1a"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar documentos por email
          </a>
        </div>
      </section>
    </main>
  );
}
