// app/marruecos/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Traducciones juradas Marruecos – España | Documentos y apostilla",
  description:
    "Traducción jurada de documentos marroquíes para usarlos en España: casier judiciaire, actas de nacimiento y matrimonio, salarios CNSS, chiffre d'affaires, Registre du Commerce, estatutos y poderes. Información sobre apostilla y requisitos habituales.",
};

export default function MarruecosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Marruecos · España
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traducciones juradas de documentos marroquíes para España
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Te ayudamos a preparar tus documentos marroquíes para que sean
          aceptados en España: traducción jurada oficial, información sobre
          apostilla y asesoramiento básico sobre qué suele pedir Extranjería,
          notarías, bancos y otros organismos.
        </p>
      </header>

      {/* PRINCIPALES DOCUMENTOS */}
      <section className="mt-10 space-y-6 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
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
      <section className="mt-10 space-y-4 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
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
        <p className="text-xs text-slate-600">
          La traducción jurada debe incluir siempre la página de la apostilla.
          Si todavía no has apostillado tu documento, es recomendable preguntar
          en el consulado español o en la administración donde vas a presentar
          el expediente.
        </p>
      </section>

      {/* RELACIÓN CON TELETRABAJO */}
      <section className="mt-10 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">
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
            className="font-semibold text-emerald-700 hover:underline"
          >
            Ver traducciones juradas para teletrabajar en España →
          </Link>
        </p>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-sm">
        <h2 className="text-lg font-semibold text-emerald-900">
          Envíanos tus documentos marroquíes para un presupuesto sin compromiso
        </h2>
        <p className="mt-1 text-slate-800">
          Puedes adjuntar fotos claras o PDFs de tus documentos (casier,
          certificados de nacimiento, salarios, Registre du Commerce, etc.) y
          te responderemos con un precio cerrado y un plazo estimado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Traducciones%20juradas%20Marruecos%20-%20Espa%C3%B1a"
            className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            O enviar documentos por email
          </a>
        </div>
      </section>
    </main>
  );
}
