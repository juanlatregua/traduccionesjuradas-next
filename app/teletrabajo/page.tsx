// app/teletrabajo/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Documentos para teletrabajar en España desde Marruecos | Traducción jurada",
  description:
    "Requisitos y documentos para teletrabajar en España desde Marruecos. Traducción jurada de certificados, antecedentes, nóminas, estatutos y documentos con apostilla.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/teletrabajo" },
};

export default function TeletrabajoMarruecosPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Teletrabajo Marruecos → España
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Documentos necesarios para teletrabajar en España desde Marruecos
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Si resides en <strong>Marruecos</strong> y quieres{" "}
          <strong>teletrabajar legalmente desde España</strong>, necesitarás
          presentar un expediente con varios documentos oficiales marroquíes,
          muchos de ellos con <strong>Apostilla de La Haya</strong> y{" "}
          <strong>traducción jurada al español</strong>.
        </p>
        <p className="mt-2 text-sm text-sepia sm:text-base">
          En <strong>traduccionesjuradas.net</strong> ayudamos cada día a
          trabajadores, familias y empresas marroquíes a preparar la
          documentación necesaria para visados, autorizaciones de residencia y
          teletrabajo en España, con traducciones juradas realizadas por{" "}
          <strong>traductores jurados oficiales</strong>.
        </p>

        {/* CTA PRINCIPAL */}
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-bleu px-5 py-2 font-semibold text-white shadow-sm hover:bg-bleu-dark"
          >
            Pedir presupuesto para mi paquete de documentos
          </a>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-cream px-4 py-2 font-medium text-encre hover:bg-cream"
          >
            Enviar documentos por WhatsApp
          </a>
          <Link
            href="/presupuesto-instantaneo"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O rellenar el formulario de presupuesto
          </Link>
        </div>
      </header>

      {/* SECCIÓN 2: DOCUMENTOS QUE DEBEN TRADUCIRSE */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-encre sm:text-2xl">
          Documentos que suelen exigir para teletrabajar en España desde
          Marruecos
        </h2>
        <p className="mt-2 text-sm text-sepia">
          Cada consulado, gestoría o despacho de extranjería puede pedir una
          combinación distinta, pero en la práctica vemos casi siempre{" "}
          <strong>el mismo paquete de documentos</strong>. Los más habituales
          son:
        </p>

        <div className="mt-6 space-y-6 text-sm text-sepia">
          {/* PERSONALES Y FAMILIA */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <h3 className="text-base font-semibold text-encre">
              1. Documentación personal y familiar
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Certificado de nacimiento</strong> (
                <em>Extrait d&apos;acte de naissance</em>) del solicitante.
              </li>
              <li>
                Certificados de nacimiento del <strong>cónyuge e hijos</strong>,
                si forman parte del expediente.
              </li>
              <li>
                <strong>Certificado de matrimonio</strong> o, en su caso,{" "}
                <strong>sentencia de divorcio</strong>.
              </li>
              <li>Pasaporte marroquí (páginas relevantes).</li>
            </ul>
            <p className="mt-2 text-xs text-sepia">
              Estos documentos suelen encajar dentro de los{" "}
              <Link
                href="/documentos-oficiales/certificados-registro-civil"
                className="text-bleu underline"
              >
                certificados del Registro Civil
              </Link>
              .
            </p>
          </div>

          {/* ANTECEDENTES */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <h3 className="text-base font-semibold text-encre">
              2. Antecedentes penales y buena conducta
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Certificado de antecedentes penales</strong> (
                <em>Bulletin n°3</em>) expedido en Marruecos.
              </li>
              <li>
                En algunos expedientes,{" "}
                <strong>certificados de buena conducta</strong> o informes
                policiales adicionales.
              </li>
            </ul>
            <p className="mt-2 text-xs text-sepia">
              Encontrarás más información general en la sección de{" "}
              <Link
                href="/documentos-oficiales/antecedentes-penales"
                className="text-bleu underline"
              >
                antecedentes penales y buena conducta
              </Link>
              .
            </p>
          </div>

          {/* MEDIOS ECONÓMICOS Y TRABAJO */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <h3 className="text-base font-semibold text-encre">
              3. Medios económicos y situación laboral
            </h3>
            <p className="mt-2">
              Este es uno de los puntos clave. Habitualmente se exige un
              conjunto de documentos que demuestren{" "}
              <strong>ingresos estables y trabajo real</strong>:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Contrato de trabajo</strong> actualizado, donde figure
                claramente la relación laboral.
              </li>
              <li>
                <strong>Autorización expresa de teletrabajo</strong> emitida por
                la empresa, si no aparece detallada en el contrato.
              </li>
              <li>
                <strong>Tres últimas nóminas</strong> (
                <em>bulletins de paie</em>).
              </li>
              <li>
                <strong>Certificados de salarios</strong> (
                <em>attestations de déclaration de salaires</em>).
              </li>
              <li>
                <strong>Attestation du chiffre d&apos;affaires déclaré</strong>,
                en casos de autónomos o gerentes de empresa.
              </li>
              <li>Certificados de afiliación o cotización a la CNSS.</li>
              <li>
                <strong>Currículum vitae</strong> actualizado (a menudo lo
                prefieren en español).
              </li>
            </ul>
            <p className="mt-2 text-xs text-sepia">
              Estos documentos se incluyen dentro de los{" "}
              <Link
                href="/documentos-oficiales/documentos-laborales"
                className="text-bleu underline"
              >
                documentos laborales
              </Link>{" "}
              y, en parte, de los{" "}
              <Link
                href="/documentos-oficiales/documentos-fiscales"
                className="text-bleu underline"
              >
                documentos fiscales
              </Link>
              .
            </p>
          </div>

          {/* DOCUMENTOS EMPRESA */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <h3 className="text-base font-semibold text-encre">
              4. Documentación de la empresa en Marruecos
            </h3>
            <p className="mt-2">
              Cuando se trata de una{" "}
              <strong>empresa marroquí que desplaza trabajadores</strong> o de
              un profesional vinculado a una sociedad, suelen pedir:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Certificado del Registro Mercantil</strong> (
                <em>Registre du Commerce</em>).
              </li>
              <li>
                <strong>Estatutos de la empresa</strong> y sus modificaciones
                más recientes.
              </li>
              <li>
                <strong>Poderes notariales</strong> del administrador o
                representante legal.
              </li>
              <li>
                Certificados de estar al corriente de obligaciones fiscales y
                sociales, si se requieren.
              </li>
            </ul>
            <p className="mt-2 text-xs text-sepia">
              Toda esta documentación se considera{" "}
              <Link
                href="/documentos-oficiales/documentos-mercantiles"
                className="text-bleu underline"
              >
                documentos mercantiles y empresariales
              </Link>
              .
            </p>
          </div>

          {/* DOCUMENTOS MIGRATORIOS */}
          <div className="rounded-2xl border border-cream bg-card p-4 shadow-sm">
            <h3 className="text-base font-semibold text-encre">
              5. Formularios y documentos migratorios
            </h3>
            <p className="mt-2">
              Además de los documentos civiles y laborales, suelen exigirse
              ciertos formularios específicos:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Formularios consulares como el <strong>EM 30</strong> u otros
                modelos actualizados.
              </li>
              <li>
                Comunicaciones con el consulado, citas y confirmaciones de
                trámite.
              </li>
              <li>En ocasiones, seguros médicos u otros anexos.</li>
            </ul>
            <p className="mt-2 text-xs text-sepia">
              Todo esto se enmarca dentro de los{" "}
              <Link
                href="/documentos-oficiales/documentos-migratorios"
                className="text-bleu underline"
              >
                documentos migratorios
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* APOSTILLA */}
      <section className="mt-12 rounded-3xl border border-cream bg-parchment p-6">
        <h2 className="text-lg font-semibold text-encre sm:text-xl">
          ¿Qué documentos marroquíes necesitan Apostilla de La Haya?
        </h2>
        <p className="mt-2 text-sm text-sepia">
          En la mayoría de expedientes, la regla general es que{" "}
          <strong>primero se legaliza el documento</strong> (con Apostilla de
          La Haya o el sistema que corresponda) y{" "}
          <strong>después se hace la traducción jurada</strong>.
        </p>
        <p className="mt-2 text-sm text-sepia">
          Suelen requerir apostilla, entre otros:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
          <li>Certificados de nacimiento y matrimonio.</li>
          <li>Certificados de antecedentes penales.</li>
          <li>Documentos notariales.</li>
          <li>
            Certificados del <strong>Registro Mercantil</strong> y otros
            certificados oficiales.
          </li>
        </ul>
        <p className="mt-2 text-sm text-sepia">
          En cambio, los documentos privados de empresa (nóminas, contratos,
          autorizaciones de teletrabajo) normalmente{" "}
          <strong>no se apostillan</strong>.
        </p>
        <p className="mt-2 text-sm text-sepia">
          Para una explicación más general puedes consultar{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-bleu underline"
          >
            nuestra página sobre la Apostilla de La Haya
          </Link>
          .
        </p>
      </section>

      {/* CÓMO TRABAJAMOS CON CLIENTES DE MARRUECOS */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-encre sm:text-2xl">
          Cómo trabajamos con clientes de Marruecos
        </h2>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-cream bg-card p-4">
            <h3 className="text-sm font-semibold text-encre">
              1. Envío digital de documentos
            </h3>
            <p className="mt-1 text-sepia">
              Puedes enviarnos <strong>fotos claras o escaneos</strong> por
              email o WhatsApp. No necesitas desplazarte a España para pedir
              presupuesto.
            </p>
          </div>
          <div className="rounded-2xl border border-cream bg-card p-4">
            <h3 className="text-sm font-semibold text-encre">
              2. Especialistas en documentación marroquí
            </h3>
            <p className="mt-1 text-sepia">
              Trabajamos a diario con documentos en{" "}
              <strong>francés y árabe de Marruecos</strong>. Entregamos
              traducciones juradas al español listas para presentar en España.
            </p>
          </div>
          <div className="rounded-2xl border border-cream bg-card p-4">
            <h3 className="text-sm font-semibold text-encre">
              3. Entrega en PDF firmado y, si hace falta, en papel
            </h3>
            <p className="mt-1 text-sepia">
              Recibirás la traducción en{" "}
              <strong>PDF firmado digitalmente</strong>. Si tu gestoría o
              consulado lo exige, también podemos organizar{" "}
              <strong>el envío en papel</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* CHECKLIST + CTA FINAL */}
      <section className="mt-12 rounded-3xl border border-cream bg-cream/70 p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          Checklist rápida antes de pedir presupuesto
        </h2>
        <p className="mt-2 text-encre">
          Para poder darte un presupuesto ajustado, intenta tener preparados:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-encre">
          <li>
            Copia de tus <strong>documentos de identidad</strong> (y de tu
            familia, si los incluyes en el expediente).
          </li>
          <li>
            <strong>Certificados de nacimiento y matrimonio</strong> que se
            vayan a presentar.
          </li>
          <li>
            <strong>Certificado de antecedentes penales</strong> y, si procede,
            de buena conducta.
          </li>
          <li>
            <strong>Contrato de trabajo</strong>, autorización de
            teletrabajo y <strong>tres últimas nóminas</strong>.
          </li>
          <li>
            Para empresas: <strong>Registro Mercantil, estatutos</strong>,
            poderes y certificados de situación fiscal.
          </li>
          <li>
            Formularios consulares relevantes (por ejemplo,{" "}
            <strong>EM 30</strong>).
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={MAIL_LINK}
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Enviar mi paquete de documentos por email
          </a>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-bleu px-4 py-2 text-xs font-medium text-bleu hover:bg-cream"
          >
            Enviar fotos por WhatsApp
          </a>
          <Link
            href="/presupuesto-instantaneo"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O rellenar el formulario de presupuesto
          </Link>
        </div>
      </section>
    </main>
  );
}

